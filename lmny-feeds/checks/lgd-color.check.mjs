import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRow, normalizeFeed, payloadFor, fetchInventory, FEED_TAG, snapshotHash } from '../src/lgd-color/catalog.mjs';
import { planFor, mediaReady, requestShopify } from '../src/lgd-color/sync.mjs';
import { main, OPS, withdrawalLimit } from '../src/lgd-color/sync.mjs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const fixture = (override={}) => ({Stock_No:'TEST1',Shape:'RADIANT',Color:'BLUE',Fancy_Color_Intensity:'Fancy Vivid',Clarity:'VS1',Weight:'2',Buy_Price:'100',Buy_Price_Total:'200',Diamond_Type:'Lab Grown',Lab:'IGI',Availability:'Available',ImageLink:'https://example.com/stone.jpg',Video_HTML:'https://example.com/stone.mp4',CertificateLink:'https://example.com/LG12345678.pdf',...override});
test('prices from total cost, never per-carat price',()=>{const s=normalizeRow(fixture()).stone;assert.equal(s.retail,550);assert.equal(s.cost,200);assert.equal(s.certificate,'LG12345678');});
test('normalizes uppercase supplier intensity',()=>{assert.equal(normalizeRow(fixture({Fancy_Color_Intensity:'FANCY VIVID'})).stone.intensity,'Fancy Vivid');});
test('excludes jewelry, white stones, memo and unknown grading',()=>{for(const changes of [{Shape:'RING'},{Color:'WHITE'},{Availability:'Memo'},{Clarity:'I1'},{Fancy_Color_Intensity:''},{Diamond_Type:'Natural'}])assert.ok(normalizeRow(fixture(changes)).reason);});
test('requires both photo and video, HTTPS URLs and recognized certificate',()=>{for(const changes of [{ImageLink:''},{Video_HTML:''},{Video_HTML:'https://example.com/viewer'},{ImageLink:'http://example.com/stone.jpg'},{CertificateLink:'https://example.com/certificate.pdf'}])assert.ok(normalizeRow(fixture(changes)).reason);});
test('rejects total-cost discrepancies and invalid numeric values',()=>{for(const changes of [{Buy_Price_Total:'100'},{Weight:'Infinity'},{Buy_Price_Total:'0'}])assert.equal(normalizeRow(fixture(changes)).reason,'cost_mismatch');});
test('rejects duplicate stocks and certificates',()=>{assert.throws(()=>normalizeFeed([fixture(),fixture()]));assert.throws(()=>normalizeFeed([fixture(),fixture({Stock_No:'TEST2'})]));});
test('payload is draft, source-isolated, marketplace-excluded and cost-private',()=>{const s=normalizeRow(fixture()).stone;const p=payloadFor(s,undefined,'DRAFT','gid://shopify/Location/1');assert.equal(p.status,'DRAFT');assert.ok(p.tags.includes(FEED_TAG));assert.ok(!p.tags.includes('lmny-feed'));assert.ok(!p.tags.includes('ebay'));assert.equal(p.variants[0].inventoryQuantities[0].quantity,0);assert.equal(p.variants[0].inventoryItem.cost,'200.00');assert.ok(!p.metafields.some(m=>m.key.includes('cost')));assert.equal(p.metafields.find(m=>m.key==='video_url').value,s.video);assert.ok(p.seo.title.length<=60&&p.seo.description.length<=160);assert.ok(!p.descriptionHtml.includes('<video'));assert.throws(()=>payloadFor(s,null,'ACTIVE'));});
test('existing variant identity retained and archived items never reactivated',()=>{const s=normalizeRow(fixture()).stone;const existing={id:'p',variantId:'v',variantCount:1,handle:s.handle,tags:[FEED_TAG],status:'DRAFT',readyImage:true};assert.equal(payloadFor(s,existing).variants[0].id,'v');assert.equal(planFor([s],[{...existing,status:'ARCHIVED'}],{activate:true}).writes.length,0);});
test('certificate collision with another supplier skips creation',()=>{const s=normalizeRow(fixture()).stone;assert.equal(planFor([s],[{handle:'lg-other',certificate:s.certificate,tags:['lmny-feed']}]).writes.length,0);});
test('preview and targeted activation never withdraw unrelated stones',()=>{const s=normalizeRow(fixture()).stone;const other={id:'other',handle:'lg-color-other',tags:[FEED_TAG],status:'ACTIVE'};assert.equal(planFor([s],[other],{limit:5}).holds.length,0);assert.equal(planFor([s],[other],{activate:true}).holds.length,0);assert.equal(planFor([s],[{...other,tags:['lmny-feed']}]).holds.length,0);});
test('complete pagination required before availability writes',async()=>{let n=0;const rows=await fetchInventory('secret',async()=>({ok:true,json:async()=>({page_no:++n,total_page:2,total_results:2,data:[fixture({Stock_No:'TEST'+n})]})}));assert.equal(rows.length,2);await assert.rejects(()=>fetchInventory('secret',async()=>({ok:true,json:async()=>({page_no:1,total_page:1,total_results:2,data:[fixture()]})})));await assert.rejects(()=>fetchInventory('secret',async()=>{throw new Error('secret-url');}),e=>!e.message.includes('secret-url'));});
test('HTML errors disguised as media cannot pass',async()=>{const s=normalizeRow(fixture()).stone;assert.equal(await mediaReady(s,async()=>new Response('<html>missing</html>',{headers:{'content-type':'text/html'}})),false);});
test('updates identify the original product separately from its input',()=>{const s=normalizeRow(fixture()).stone;const p={id:'p',variantId:'v',variantCount:1,handle:s.handle,tags:[FEED_TAG],status:'DRAFT',readyImage:true};const line=planFor([s],[p]).writes[0];assert.deepEqual(line.identifier,{id:'p'});assert.equal(line.input.id,undefined);assert.equal(line.input.variants[0].id,'v');});
test('large inventory withdrawals fail closed',()=>{const s=normalizeRow(fixture()).stone;const catalog=Array.from({length:10},(_,i)=>({id:'p'+i,handle:'lg-color-gone'+i,tags:[FEED_TAG],status:'ACTIVE'}));assert.throws(()=>planFor([s],catalog),/withdrawal_limit_exceeded/);});
test('throttled Shopify reads retry the same request after recovery',async()=>{let calls=0;const delays=[];const fetcher=async()=>new Response(JSON.stringify(++calls<3?{errors:[{extensions:{code:'THROTTLED'}}],extensions:{cost:{requestedQueryCost:137,throttleStatus:{currentlyAvailable:37,restoreRate:50}}}}:{data:{ok:true}}));assert.deepEqual(await requestShopify('test.myshopify.com','secret','query {}',{},fetcher,async ms=>delays.push(ms)),{ok:true});assert.equal(calls,3);assert.deepEqual(delays,[2250,2250]);});
test('Shopify failures without throttling are never retried',async()=>{let calls=0;await assert.rejects(()=>requestShopify('test.myshopify.com','secret','query {}',{},async()=>{calls++;return new Response('{}',{status:500});},async()=>{}));assert.equal(calls,1);});

const product = (handle,status='ACTIVE')=>({id:'gid://shopify/Product/'+handle,handle,status,tags:[FEED_TAG],media:{nodes:[{mediaContentType:'IMAGE',status:'READY'}]},variants:{nodes:[{id:'v-'+handle,price:'700',sku:handle}]}});
async function harness(callback,{rows=[fixture()],products=[],media=true,fetchFailure=null}={}) {
  const outputDir=await mkdtemp(join(tmpdir(),'colored-test-')),calls=[];
  const deps={outputDir,fetchInventory:async()=>{if(fetchFailure)throw fetchFailure;return rows;},mediaReady:async()=>media,client:async()=>async(query)=>{
    calls.push(query);
    if(query===OPS.catalog)return {products:{nodes:products,pageInfo:{hasNextPage:false}}};
    if(query===OPS.location)return {locations:{nodes:[{id:'location',isActive:true}],pageInfo:{hasNextPage:false}}};
    throw new Error('Unexpected mutation or query');
  }};
  try {await callback(deps,async()=>JSON.parse(await readFile(join(outputDir,'lgd-color-report.json'),'utf8')),calls);}
  finally {await rm(outputDir,{recursive:true,force:true});}
}
test('full dry-run reconciles over-limit withdrawals, exclusions, media and drafts without mutations',async()=>{
  const products=Array.from({length:10},(_,i)=>product('lg-color-gone'+i));
  products.push(product('lg-color-test1'),product('lg-color-bad'),product('lg-color-draft','DRAFT'));
  await harness(async(deps,read,calls)=>{
    const report=await main(['--dry-run'],deps);
    assert.equal(report.status,'dry_run_complete');assert.equal(report.scope,'full');assert.equal(report.catalog.activeOwned,12);
    assert.equal(report.withdrawalLimit,5);assert.equal(report.overLimit,true);assert.equal(report.withdrawals.length,12);
    assert.equal(report.withdrawals.find(w=>w.handle==='lg-color-bad').exclusionReason,'unavailable');
    assert.equal(report.withdrawals.find(w=>w.handle==='lg-color-test1').reason,'media_unavailable');
    assert.equal(report.reconciliation.length,13);assert.equal(report.reconciliation.find(w=>w.handle==='lg-color-draft').action,'unchanged');
    assert.ok(calls.every(q=>q.startsWith('query ')));assert.equal((await read()).planningComplete,true);
    assert.ok(!JSON.stringify(report).includes('Buy_Price'));assert.ok(!JSON.stringify(report).includes('inventoryItem'));
  },{products,rows:[fixture(),fixture({Stock_No:'bad',Availability:'Memo'})],media:false});
});
test('live guard saves the complete withdrawal report before failing without mutations',async()=>{
  await harness(async(deps,read,calls)=>{
    await assert.rejects(()=>main([],deps),/withdrawal_limit_exceeded/);
    const report=await read();assert.equal(report.status,'failed');assert.equal(report.failure.stage,'withdrawal_guard');assert.equal(report.withdrawals.length,10);assert.equal(report.planningComplete,true);
    assert.ok(calls.every(q=>q.startsWith('query ')));
  },{products:Array.from({length:10},(_,i)=>product('lg-color-gone'+i))});
});
test('full preview reports exact colored reprices and draft arrivals while leaving white products outside its scope',async()=>{
  const white={...product('lg-white'),tags:['lmny-feed']};
  await harness(async(deps,read,calls)=>{
    const report=await main(['--dry-run'],deps);
    assert.equal(report.catalog.owned,1);assert.equal(report.withdrawals.length,0);assert.equal(report.overLimit,false);
    assert.deepEqual(report.writes.map(w=>({handle:w.handle,previousPrice:w.previousPrice,price:w.price,status:w.status})),[
      {handle:'lg-color-test1',previousPrice:'700',price:'550.00',status:'ACTIVE'},
      {handle:'lg-color-test2',previousPrice:null,price:'550.00',status:'DRAFT'}]);
    assert.equal(report.supplierReconciliation.length,2);assert.equal(report.reconciliation.length,2);
    assert.ok(!report.reconciliation.some(p=>p.handle==='lg-white'));assert.ok(calls.every(q=>q.startsWith('query ')));
  },{products:[product('lg-color-test1'),white],rows:[fixture(),fixture({Stock_No:'TEST2',CertificateLink:'https://example.com/LG12345679.pdf'})]});
});
test('supplier failure always saves a sanitized artifact, never unknown counts as zero',async()=>{
  await harness(async(deps,read,calls)=>{
    await assert.rejects(()=>main(['--dry-run'],deps));const report=await read();
    assert.equal(report.failure.stage,'supplier_fetch');assert.equal(report.failure.code,'operation_failed');assert.equal(report.fetched,null);assert.equal(report.withdrawals,null);assert.equal(report.planningComplete,false);
    assert.equal(calls.length,0);assert.ok(!JSON.stringify(report).includes('PRIVATE_URL_KEY_COST'));
  },{fetchFailure:new Error('PRIVATE_URL_KEY_COST')});
});
test('payload planning failures retain counted withdrawal candidates and catalog evidence',async()=>{
  const active=product('lg-color-test1');active.media.nodes=[];
  await harness(async(deps,read,calls)=>{
    await assert.rejects(()=>main([],deps),/active_product_requires_ready_owned_media/);
    const report=await read();assert.equal(report.failure.stage,'plan');assert.equal(report.failure.handle,'lg-color-test1');assert.equal(report.catalog.activeOwned,11);assert.equal(report.withdrawalLimit,5);assert.equal(report.withdrawals.length,10);assert.equal(report.planningComplete,false);
    assert.ok(calls.every(q=>q.startsWith('query ')));
  },{products:[active,...Array.from({length:10},(_,i)=>product('lg-color-gone'+i))]});
});
test('recovery requires explicit maximum and unchanged reviewed plan before any writes',async()=>{
  await harness(async(deps,read,calls)=>{
    await assert.rejects(()=>main(['--max-withdrawals=10'],deps),/reviewed_plan_hash/);
    assert.equal(calls.length,0);
    await assert.rejects(()=>main(['--max-withdrawals=10','--approved-plan-hash='+'0'.repeat(64)],deps),/reviewed_plan_changed/);
    assert.equal((await read()).withdrawals.length,10);assert.ok(calls.every(q=>q.startsWith('query ')));
  },{products:Array.from({length:10},(_,i)=>product('lg-color-gone'+i))});
});
test('scheduled thresholds are unchanged and malformed recovery inputs fail closed',async()=>{
  assert.equal(withdrawalLimit(634),63);assert.equal(withdrawalLimit(20),5);
  for(const value of [0,-1,501,NaN,1.5])assert.throws(()=>withdrawalLimit(634,value));
  for(const argv of [['--max-withdrawals='],['--max-withdrawals=80','--limit=5'],['--dry-run','--typo'],['--dry-run','--dry-run']]){
    await harness(async(deps,read,calls)=>{await assert.rejects(()=>main(argv,deps));assert.equal(calls.length,0);assert.equal((await read()).status,'failed');});
  }
});
test('supplier HTTP, transport, invalid JSON and pagination errors have safe fixed diagnostics',async()=>{
  for(const [fetcher,code] of [[async()=>({ok:false,status:503}),'supplier_http_error'],[async()=>{throw new Error('PRIVATE_URL_KEY_COST');},'supplier_transport_failed'],[async()=>({ok:true,json:async()=>{throw new Error('PRIVATE_URL_KEY_COST');}}),'supplier_invalid_json'],[async()=>({ok:true,json:async()=>null}),'supplier_invalid_snapshot']]){
    await assert.rejects(()=>fetchInventory('secret',fetcher),e=>e.code===code&&!e.message.includes('PRIVATE'));
  }
});
test('case-insensitive stock collisions cannot generate duplicate Shopify handles',()=>{
  assert.throws(()=>normalizeFeed([fixture(),fixture({Stock_No:'test1'})]),/duplicate_source_stock/);
});
test('grading exclusions identify exact fixed checks without leaking supplier fields',()=>{
  const result=normalizeFeed([fixture({Fancy_Color_Intensity:'UNKNOWN',Clarity:'UNKNOWN',CertificateLink:'https://example.com/PRIVATE_SOURCE_URL.pdf'})]);
  assert.deepEqual(result.exclusions,[{handle:'lg-color-test1',reason:'grading_or_certificate',checks:['unrecognized_intensity','unrecognized_clarity','unrecognized_certificate_link']}]);
  assert.ok(!JSON.stringify(result).includes('PRIVATE_SOURCE_URL'));
});
test('reviewed recovery applies exactly the matching plan and verifies withdrawals independently',async()=>{
  const outputDir=await mkdtemp(join(tmpdir(),'colored-recovery-'));
  const stone=normalizeRow(fixture()).stone;
  const kept={...product(stone.handle),hash:{value:snapshotHash(stone)},video:{value:stone.video}};
  kept.variants.nodes[0].price=String(stone.retail);
  const products=[kept,...Array.from({length:10},(_,i)=>product('lg-color-gone'+i))];
  const mutations=[];
  const deps={outputDir,fetchInventory:async()=>[fixture()],mediaReady:async()=>true,client:async()=>async(query,variables)=>{
    if(query===OPS.catalog)return {products:{nodes:products,pageInfo:{hasNextPage:false}}};
    if(query===OPS.location)return {locations:{nodes:[{id:'location',isActive:true}],pageInfo:{hasNextPage:false}}};
    if(query===OPS.hold){const p=products.find(p=>p.id===variables.product.id);p.status='DRAFT';mutations.push(p.handle);return {productUpdate:{product:{id:p.id,status:p.status},userErrors:[]}};}
    if(query===OPS.verify)return {nodes:products.filter(p=>variables.ids.includes(p.id))};
    throw new Error('Unexpected operation');
  }};
  try {
    const preview=await main(['--dry-run'],deps);assert.equal(mutations.length,0);assert.equal(preview.writes.length,0);
    await assert.rejects(()=>main(['--max-withdrawals=9','--approved-plan-hash='+preview.planHash],deps),/withdrawal_limit_exceeded/);assert.equal(mutations.length,0);
    const result=await main(['--max-withdrawals=10','--approved-plan-hash='+preview.planHash],deps);
    assert.equal(result.status,'verified');assert.equal(mutations.length,10);assert.ok(products.slice(1).every(p=>p.status==='DRAFT'));assert.equal(kept.status,'ACTIVE');
  } finally {await rm(outputDir,{recursive:true,force:true});}
});
