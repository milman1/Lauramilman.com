import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { GOOGLE_LOOSE_FIELDS, GOOGLE_LOOSE_TAG, planGoogleLoose, reconcileGoogleLoose, shortlistHandles, type GoogleLooseProduct } from '../src/googleLoose.js';
import type { Publishable, StoneItem } from '../src/types.js';
import type { ShopifyClient } from '../src/shopify.js';

const item: StoneItem = { kind:'lab', stockRef:'100742831311', shape:'Oval', carat:2.02, color:'F', clarity:'VS1', lab:'IGI', certNumber:'LG764638091', costUsd:100, imageUrls:['https://example.com/stone.jpg'], videoUrls:[] };
const source: Publishable[] = [{item, priced:{retailUsd:475,marginPct:0.7}}];
const handle = 'lg-100742831311';
const selected = new Set([handle]);
function product(): GoogleLooseProduct { return {
  id:'gid://shopify/Product/1',handle,status:'ACTIVE',title:'2.02ct Oval Lab-Grown Diamond — F VS1, IGI Certified',descriptionHtml:'IGI certified oval lab-grown diamond.',
  onlineStoreUrl:`https://www.lauramilman.com/products/${handle}`,tags:[],publishedOnPublication:false,certificate:{value:item.certNumber!},
  media:{nodes:[{mediaContentType:'IMAGE',status:'READY'}]},variants:{nodes:[{sku:item.stockRef,price:'475.00',inventoryQuantity:0,inventoryPolicy:'CONTINUE',inventoryItem:{tracked:true}}]},google:{nodes:[]},
}; }
describe('Google loose eligibility',()=>{
  it('requires a well-formed nonempty lab shortlist',()=>{
    expect([...shortlistHandles('shape,size,handle\nOval,2,lg-123\n')]).toEqual(['lg-123']);
    expect(()=>shortlistHandles('shape,size,handle\nOval,2,w-123')).toThrow();
    expect(()=>shortlistHandles('shape,size,handle\n')).toThrow();
  });
  it('backfills an unchanged active stone without changing price or Uploadify inventory',()=>{
    const p=product(),before=structuredClone(p);
    expect(planGoogleLoose([p],source,selected)[0]).toMatchObject({action:'publish',reason:'eligible'});
    expect(p).toEqual(before);
    expect(GOOGLE_LOOSE_FIELDS.some(f=>/cost|price|uploadify|gtin|mpn/.test(f.key))).toBe(false);
  });
  it('withdraws a managed product missing from the healthy current supplier feed',()=>{
    const p={...product(),publishedOnPublication:true,tags:[GOOGLE_LOOSE_TAG]};
    expect(planGoogleLoose([p],[],selected)[0]).toMatchObject({action:'unpublish',reason:'not_in_current_publishable_supplier_feed'});
    expect(planGoogleLoose([p],source,new Set())[0]).toMatchObject({action:'unpublish',reason:'outside_shortlist'});
  });
  it.each(['draft','image','sku','certificate','price','inventory','hold'])('rejects an incomplete listing: %s',problem=>{
    const p=product();p.publishedOnPublication=true;
    if(problem==='draft')p.status='DRAFT';
    if(problem==='image')p.media.nodes[0]!.status='FAILED';
    if(problem==='sku')p.variants.nodes[0]!.sku='wrong';
    if(problem==='certificate')p.certificate=null;
    if(problem==='price')p.variants.nodes[0]!.price='0';
    if(problem==='inventory')p.variants.nodes[0]!.inventoryQuantity=1;
    if(problem==='hold')p.tags.push('pricing-review');
    expect(planGoogleLoose([p],source,selected)[0]!.action).toBe('unpublish');
  });
  it('is idempotent when publication, marker and attributes match',()=>{
    const p={...product(),publishedOnPublication:true,tags:[GOOGLE_LOOSE_TAG],google:{nodes:GOOGLE_LOOSE_FIELDS}};
    expect(planGoogleLoose([p],source,selected)[0]!.action).toBe('skip');
  });
});

function fakeClient(p: GoogleLooseProduct, failWrite=false) {
  const mutations: string[]=[];
  const client={
    publicationIdsByName:vi.fn(async()=>({ids:new Map([['Google & YouTube','gid://shopify/Publication/2']])})),
    gql:vi.fn(async(query:string)=>{
      if(query.startsWith('query'))return {products:{nodes:[structuredClone(p)],pageInfo:{hasNextPage:false,endCursor:null}}};
      mutations.push(query);
      if(query.includes('tagsAdd')){p.tags.push(GOOGLE_LOOSE_TAG);return {tagsAdd:{userErrors:[]}};}
      p.publishedOnPublication=false;return {publishableUnpublish:{userErrors:[]}};
    }),
    setMetafields:vi.fn(async()=>{mutations.push('metafieldsSet');if(failWrite)return ['write failed'];p.google.nodes=structuredClone(GOOGLE_LOOSE_FIELDS);return [];}),
    publishToChannels:vi.fn(async()=>{mutations.push('publish');p.publishedOnPublication=true;return [];}),
  };
  return {client:client as unknown as ShopifyClient,mutations};
}
describe('Google loose reconciliation',()=>{
  it('defers an outage or limited run without reading or mutating Google',async()=>{
    const {client,mutations}=fakeClient(product());
    expect(await reconcileGoogleLoose(client,[],[],{supplierHealthy:false,dryRun:false,outDir:'/unused'})).toContain('deferred');
    expect(client.gql).not.toHaveBeenCalled();expect(mutations).toEqual([]);
  });
  it('writes a sanitized dry-run plan and makes no mutations',async()=>{
    const dir=await mkdtemp(path.join(os.tmpdir(),'google-loose-'));
    try{const {client,mutations}=fakeClient(product());const output=path.join(dir,'new-output');await reconcileGoogleLoose(client,source,[],{supplierHealthy:true,dryRun:true,outDir:output});
      const plan=await readFile(path.join(output,'google-loose-plan.json'),'utf8');expect(plan).toContain('publish');expect(plan).not.toContain('cost');expect(mutations).toEqual([]);
    }finally{await rm(dir,{recursive:true,force:true});}
  });
  it('publishes only after attributes and ownership, then verifies with a fresh query',async()=>{
    const dir=await mkdtemp(path.join(os.tmpdir(),'google-loose-'));
    try{const {client,mutations}=fakeClient(product());await reconcileGoogleLoose(client,source,[],{supplierHealthy:true,dryRun:false,outDir:dir});
      expect(mutations[0]).toBe('metafieldsSet');expect(mutations[1]).toContain('tagsAdd');expect(mutations[2]).toBe('publish');
      const report=JSON.parse(await readFile(path.join(dir,'google-loose-verification.json'),'utf8'));expect(report.remaining).toEqual([]);expect(report.products[0].published).toBe(true);
    }finally{await rm(dir,{recursive:true,force:true});}
  });
  it('does not publish when attributes fail and reports failed verification',async()=>{
    const dir=await mkdtemp(path.join(os.tmpdir(),'google-loose-'));
    try{const {client,mutations}=fakeClient(product(),true);await expect(reconcileGoogleLoose(client,source,[],{supplierHealthy:true,dryRun:false,outDir:dir})).rejects.toThrow('reconciliation failed');expect(mutations).toEqual(['metafieldsSet']);
    }finally{await rm(dir,{recursive:true,force:true});}
  });
});
