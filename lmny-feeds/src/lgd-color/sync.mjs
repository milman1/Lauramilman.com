import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { FEED_TAG, PREFIX, fetchInventory, normalizeFeed, payloadFor, snapshotHash } from './catalog.mjs';
let stage = 'startup';

export const OPS = {
  "catalog": "query ColoredCatalog($after:String,$query:String!) { products(first:100,after:$after,query:$query) { pageInfo { hasNextPage endCursor } nodes { id handle title status tags descriptionHtml templateSuffix vendor productType seo { title description } certificate:metafield(namespace:\"lmny_feed\",key:\"cert_number\"){value} video:metafield(namespace:\"lmny_feed\",key:\"video_url\"){value} hash:metafield(namespace:\"colored_feed\",key:\"content_hash\"){value} media(first:10){nodes{status mediaContentType}} variants(first:2){nodes{id sku price inventoryPolicy inventoryQuantity inventoryItem{tracked unitCost{amount currencyCode}}}} } } }",
  "set": "mutation SetColoredStone($input:ProductSetInput!,$identifier:ProductSetIdentifiers){productSet(input:$input,identifier:$identifier,synchronous:true){product{id handle} userErrors{field message}}}",
  "hold": "mutation HoldColoredStone($product:ProductUpdateInput!){productUpdate(product:$product){product{id status}userErrors{field message}}}",
  "location": "query ColoredLocations($after:String){locations(first:100,after:$after){nodes{id name isActive}pageInfo{hasNextPage endCursor}}}",
  "publications": "query ColoredPublications($after:String){publications(first:100,after:$after){nodes{id name}pageInfo{hasNextPage endCursor}}}",
  "publish": "mutation PublishColoredStone($id:ID!,$input:[PublicationInput!]!){publishablePublish(id:$id,input:$input){userErrors{field message}}}"
};
export function view(p) {
  const v = p.variants.nodes[0];
  return {...p, certificate:p.certificate?.value, video:p.video?.value, hash:p.hash?.value,
    readyImage:p.media.nodes.some(m=>m.mediaContentType==='IMAGE' && m.status==='READY'),
    variantId:v?.id, variantCount:p.variants.nodes.length, sku:v?.sku, price:v?.price};
}
export function planFor(stones, catalog, {limit=null, activate=false, locationId}={}) {
  const owned = catalog.filter(p=>p.tags.includes(FEED_TAG) && p.handle.startsWith(PREFIX));
  const byHandle = new Map(catalog.map(p=>[p.handle,p])), byCert = new Map();
  for (const p of catalog) if(p.certificate) { const key=p.certificate.toUpperCase().replace(/^LG/,''); const a=byCert.get(key)||[]; a.push(p); byCert.set(key,a); }
  const desired = new Set(), writes=[], skipped=[];
  for (const s of stones) {
    const existing=byHandle.get(s.handle), certOwners=byCert.get(s.certificate.replace(/^LG/,'').toUpperCase())||[];
    desired.add(s.handle);
    if (existing && (!existing.tags.includes(FEED_TAG) || existing.status==='ARCHIVED' || existing.variantCount!==1)) { skipped.push({handle:s.handle,reason:'ownership_or_archived_or_variants'}); continue; }
    if (certOwners.some(p=>p.handle!==s.handle)) { skipped.push({handle:s.handle,reason:'duplicate_certificate'}); continue; }
    if (activate && (!existing || !existing.readyImage)) { skipped.push({handle:s.handle,reason:'draft_media_not_ready'}); continue; }
    const status = activate || existing?.status==='ACTIVE' ? 'ACTIVE' : 'DRAFT';
    if (existing?.hash === snapshotHash(s) && existing.status===status && existing.readyImage && existing.video===s.video && existing.price===s.retail.toFixed(2)) continue;
    const input=payloadFor(s,existing,status,locationId);
    writes.push({action:existing?'update':'create',handle:s.handle,identifier:existing?{id:existing.id}:null,input,stone:s});
  }
  // Always use the complete snapshot for removals; a five-item preview never removes inventory.
  const holds = limit || activate ? [] : owned.filter(p=>p.status==='ACTIVE' && !desired.has(p.handle)).map(p=>({action:'hold',handle:p.handle,input:{id:p.id,status:'DRAFT'}}));
  const activeOwned=owned.filter(p=>p.status==='ACTIVE').length;
  if (holds.length>Math.max(5,activeOwned*0.1)) throw new Error('Availability withdrawal exceeds safety threshold; review required');
  return {writes:limit?writes.slice(0,limit):writes,holds,skipped};
}
async function tokenFor(domain) {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  if (!process.env.SHOPIFY_CLIENT_ID || !process.env.SHOPIFY_CLIENT_SECRET) throw new Error('Shopify credentials are missing');
  const r=await fetch('https://'+domain+'/admin/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:process.env.SHOPIFY_CLIENT_ID,client_secret:process.env.SHOPIFY_CLIENT_SECRET}),redirect:'error'});
  if (!r.ok) throw new Error('Shopify token exchange HTTP '+r.status);
  const j=await r.json(); if(!j.access_token) throw new Error('Shopify token missing'); return j.access_token;
}
async function client() {
  const domain=process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain || !/^[a-z0-9-]+\.myshopify\.com$/i.test(domain)) throw new Error('SHOPIFY_STORE_DOMAIN must be a myshopify.com domain');
  const token=await tokenFor(domain);
  return (query,variables={})=>requestShopify(domain,token,query,variables);
}
export async function requestShopify(domain,token,query,variables={},fetcher=fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))) {
  for(let attempt=0;attempt<12;attempt++){
    let r;try {r=await fetcher('https://'+domain+'/admin/api/2026-10/graphql.json',{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':token},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(60000),redirect:'error'});} catch {throw new Error('Shopify request failed');}
    if(r.status===429){await sleep(Math.min(10000,Math.max(1000,Number(r.headers.get('retry-after')||2)*1000)));continue;}
    if (!r.ok) throw new Error('Shopify HTTP '+r.status);
    const j=await r.json();
    if(!j.data && j.errors?.length && j.errors.every(e=>e.extensions?.code==='THROTTLED')){
      const cost=j.extensions?.cost,throttle=cost?.throttleStatus;
      const wait=throttle?Math.ceil(Math.max(0,(cost.requestedQueryCost-throttle.currentlyAvailable)/Math.max(1,throttle.restoreRate))*1000)+250:2000;
      await sleep(Math.min(10000,Math.max(1000,wait)));continue;
    }
    if(j.errors?.length) {
      console.error(JSON.stringify({shopifyErrorCodes:j.errors.map(e=>e.extensions?.code||'unknown'),paths:j.errors.map(e=>e.path||[]),requestedCost:j.extensions?.cost?.requestedQueryCost}));
      throw new Error('Shopify GraphQL operation failed');
    }
    if(!j.data) throw new Error('Shopify returned no data');return j.data;
  }
  throw new Error('Shopify rate limit did not recover');
}
async function paginate(gql,operation,key,variables={}) {
  const all=[];let after=null;
  for(let page=0;page<1000;page++){
    const data=(await gql(operation,{...variables,after}))[key];
    all.push(...data.nodes);
    if(!data.pageInfo.hasNextPage)return all;
    if(!data.pageInfo.endCursor || data.pageInfo.endCursor===after)throw new Error('Catalog pagination incomplete');
    after=data.pageInfo.endCursor;
  }
  throw new Error('Catalog page limit exceeded');
}
function requireNoErrors(result) {if(result.userErrors?.length) { console.error(JSON.stringify({stage, rejectedFields:result.userErrors.map(e=>e.field||['input'])})); throw new Error('Shopify rejected operation'); }}
export async function mediaReady(stone,fetcher=fetch) {
  for (const [url,kind] of [[stone.image,'image'],[stone.video,'video']]) {
    let r;try{r=await fetcher(url,{headers:{Range:'bytes=0-1023'},signal:AbortSignal.timeout(30000),redirect:'error'});}catch{return false;}
    if(!r.ok){await r.body?.cancel();return false;}
    const type=r.headers.get('content-type')||'';
    const reader=r.body?.getReader();if(!reader)return false;
    const {value}=await reader.read();await reader.cancel();if(!value?.length)return false;
    const image=(value[0]===255&&value[1]===216)||(value[0]===137&&value[1]===80)||(value[0]===82&&value[1]===73);
    const video=(value[4]===102&&value[5]===116&&value[6]===121&&value[7]===112)||(value[0]===26&&value[1]===69);
    if(kind==='image' ? !image : !video)return false;
    if(type.includes('text/html'))return false;
  }
  return true;
}
export async function main(argv=process.argv.slice(2)) {
  const dry=argv.includes('--dry-run'), activate=argv.includes('--activate');
  const limitArg=argv.find(a=>a.startsWith('--limit=')),limit=limitArg?Number(limitArg.split('=')[1]):null;
  if(limitArg && (!Number.isInteger(limit)||limit<1))throw new Error('Invalid limit');
  if(activate && !process.env.LGD_ACTIVATION_HANDLES)throw new Error('Activation requires explicit reviewed LGD_ACTIVATION_HANDLES');
  stage='supplier_fetch';
  const rows=await fetchInventory(process.env.LGD_API_KEY);
  stage='normalize';
  const normalized=normalizeFeed(rows);
  console.log(JSON.stringify({stage,fetched:rows.length,eligible:normalized.stones.length,excluded:normalized.holds}));
  if(!normalized.stones.length)throw new Error('No eligible stones; availability writes are unsafe');
  stage='shopify_auth';
  const gql=await client();
  stage='shopify_catalog';
  const catalog=(await paginate(gql,OPS.catalog,'products',{query:'product_type:"Lab-Grown Diamond" OR tag:'+FEED_TAG})).map(view);
  stage='shopify_locations';
  const locations=await paginate(gql,OPS.location,'locations');
  const location=process.env.SHOPIFY_LOCATION_ID ? locations.find(l=>l.id===process.env.SHOPIFY_LOCATION_ID&&l.isActive):locations.filter(l=>l.isActive)[0];
  if(!location)throw new Error('No active Shopify location');
  const activationHandles=new Set((process.env.LGD_ACTIVATION_HANDLES||'').split(',').map(s=>s.trim()).filter(Boolean));
  const stones=activate?normalized.stones.filter(s=>activationHandles.has(s.handle)):normalized.stones;
  if(activate && (stones.length!==activationHandles.size || !stones.length))throw new Error('Activation scope is not fully eligible');
  stage='plan';
  const plan=planFor(stones,catalog,{limit,activate,locationId:location.id});
  if(activate)plan.holds=[];
  // Check actual media before any new item or activation; do not expose dead photos/videos.
  stage='media_check';
  const failedMedia=new Set();
  const pendingMedia=plan.writes.slice(); let mediaCursor=0;
  await Promise.all(Array.from({length:Math.min(4,pendingMedia.length)},async()=>{
    while(mediaCursor<pendingMedia.length){const line=pendingMedia[mediaCursor++];if(!(await mediaReady(line.stone)))failedMedia.add(line.handle);}
  }));
  plan.writes=plan.writes.filter(line=>!failedMedia.has(line.handle));
  plan.skipped.push(...Array.from(failedMedia,handle=>({handle,reason:'media_unavailable'})));
  if(!limit && !activate){
    const existingHolds=new Set(plan.holds.map(line=>line.handle));
    for(const p of catalog)if(failedMedia.has(p.handle)&&p.status==='ACTIVE'&&p.tags.includes(FEED_TAG)&&!existingHolds.has(p.handle))plan.holds.push({action:'hold',handle:p.handle,input:{id:p.id,status:'DRAFT'}});
    const activeOwned=catalog.filter(p=>p.tags.includes(FEED_TAG)&&p.handle.startsWith(PREFIX)&&p.status==='ACTIVE').length;
    if(plan.holds.length>Math.max(5,activeOwned*0.1))throw new Error('Availability withdrawal exceeds safety threshold; review required');
  }
  console.log(JSON.stringify({stage:'media_checked',validWrites:plan.writes.length,excludedMedia:failedMedia.size}));
  const sanitized={dryRun:dry,fetched:rows.length,eligible:normalized.stones.length,holds:normalized.holds,planHash:snapshotHash(plan),writes:plan.writes.map(l=>({action:l.action,handle:l.handle,title:l.input.title,price:l.input.variants[0].price,status:l.input.status})),withdrawals:plan.holds.map(l=>l.handle),skipped:plan.skipped};
  await mkdir('out',{recursive:true});
  await writeFile('out/lgd-color-report.json',JSON.stringify(sanitized,null,2));
  if(dry){console.log(JSON.stringify({dryRun:true,fetched:rows.length,eligible:normalized.stones.length,writes:plan.writes.length,withdrawals:plan.holds.length,skipped:plan.skipped.length}));return;}
  let publications=[];
  if(activate){publications=(await paginate(gql,OPS.publications,'publications')).filter(p=>p.name==='Online Store'||p.name==='Shop');if(!publications.some(p=>p.name==='Online Store'))throw new Error('Online Store publication unavailable');}
  stage='shopify_write';
  for(const line of plan.holds)requireNoErrors((await gql(OPS.hold,{product:line.input})).productUpdate);
  for(const line of plan.writes){
    const data=(await gql(OPS.set,{input:line.input,identifier:line.identifier})).productSet;requireNoErrors(data);
    if(!data.product?.id)throw new Error('ProductSet returned no product');
    if(activate)requireNoErrors((await gql(OPS.publish,{id:data.product.id,input:publications.map(p=>({publicationId:p.id}))})).publishablePublish);
  }
  stage='shopify_verify';
  const verified=(await paginate(gql,OPS.catalog,'products',{query:'tag:'+FEED_TAG})).map(view);
  for(const line of plan.writes){
    const p=verified.find(p=>p.handle===line.handle);
    if(!p || p.status!==line.input.status || p.price!==line.input.variants[0].price || p.sku!==line.stone.stock || p.certificate!==line.stone.certificate || p.video!==line.stone.video || p.title!==line.input.title || p.templateSuffix!=='diamond' || p.hash!==snapshotHash(line.stone) || Number(p.variants.nodes[0].inventoryItem.unitCost?.amount)!==Number(line.input.variants[0].inventoryItem.cost) || p.variants.nodes[0].inventoryItem.tracked!==true || p.variants.nodes[0].inventoryQuantity!==0 || p.tags.includes('ebay') || p.tags.includes('lmny-feed'))throw new Error('Independent verification mismatch for '+line.handle);
  }
  for(const line of plan.holds)if(verified.find(p=>p.handle===line.handle)?.status!=='DRAFT')throw new Error('Withdrawal verification mismatch');
  sanitized.verified=plan.writes.length;await writeFile('out/lgd-color-report.json',JSON.stringify(sanitized,null,2));
  console.log(JSON.stringify({verified:plan.writes.length,withdrawn:plan.holds.length,newProductsRemainDraft:!activate}));
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error(JSON.stringify({failedStage:stage,message:'Colored-diamond sync failed; no secrets or supplier costs are logged.'}));process.exitCode=1;});

