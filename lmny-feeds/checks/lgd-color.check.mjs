import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRow, normalizeFeed, normalizeWhiteRow, normalizeLgdFeed, payloadFor, fetchInventory, fetchLgdInventory, supplierFetchError, FEED_TAG, WHITE_TAG, ownsWhite, ownsLgd } from '../src/lgd-color/catalog.mjs';
import { inventoryEndpoint } from '../src/lgd-color/client.mjs';
import { planFor, mediaReady, requestShopify, withdrawalLimit, SafeError } from '../src/lgd-color/sync.mjs';
const fixture = (override={}) => ({Stock_No:'TEST1',Shape:'RADIANT',Color:'BLUE',Fancy_Color_Intensity:'Fancy Vivid',Clarity:'VS1',Weight:'2',Buy_Price:'100',Buy_Price_Total:'200',Diamond_Type:'Lab Grown',Lab:'IGI',Availability:'Available',ImageLink:'https://example.com/stone.jpg',Video_HTML:'https://example.com/stone.mp4',CertificateLink:'https://example.com/LG12345678.pdf',...override});
test('prices from total cost, never per-carat price',()=>{const s=normalizeRow(fixture()).stone;assert.equal(s.retail,500);assert.equal(s.cost,200);assert.equal(s.certificate,'LG12345678');});
test('normalizes uppercase supplier intensity',()=>{assert.equal(normalizeRow(fixture({Fancy_Color_Intensity:'FANCY VIVID'})).stone.intensity,'Fancy Vivid');});
test('excludes jewelry, white stones, memo and unknown grading',()=>{for(const changes of [{Shape:'RING'},{Color:'WHITE'},{Availability:'Memo'},{Clarity:'I1'},{Fancy_Color_Intensity:''},{Diamond_Type:'Natural'}])assert.ok(normalizeRow(fixture(changes)).reason);});
test('requires both photo and video, HTTPS URLs and recognized certificate',()=>{for(const changes of [{ImageLink:''},{Video_HTML:''},{Video_HTML:'https://example.com/viewer'},{ImageLink:'http://example.com/stone.jpg'},{CertificateLink:'https://example.com/certificate.pdf'}])assert.ok(normalizeRow(fixture(changes)).reason);});
test('rejects total-cost discrepancies and invalid numeric values',()=>{for(const changes of [{Buy_Price_Total:'100'},{Weight:'Infinity'},{Buy_Price_Total:'0'}])assert.equal(normalizeRow(fixture(changes)).reason,'cost_mismatch');});
test('rejects duplicate stocks and certificates',()=>{assert.throws(()=>normalizeFeed([fixture(),fixture()]));assert.throws(()=>normalizeFeed([fixture(),fixture({Stock_No:'TEST2'})]));});
test('payload is draft, source-isolated, marketplace-excluded and cost-private',()=>{const s=normalizeRow(fixture()).stone;const p=payloadFor(s,undefined,'DRAFT','gid://shopify/Location/1');assert.equal(p.status,'DRAFT');assert.ok(p.tags.includes(FEED_TAG));assert.ok(!p.tags.includes('lmny-feed'));assert.ok(!p.tags.includes('ebay'));assert.equal(p.variants[0].inventoryQuantities[0].quantity,0);assert.equal(p.variants[0].inventoryItem.cost,'200.00');assert.ok(!p.metafields.some(m=>m.key.includes('cost')));assert.equal(p.metafields.find(m=>m.key==='video_url').value,s.video);assert.ok(p.seo.title.length<=60&&p.seo.description.length<=160);assert.ok(!p.descriptionHtml.includes('<video'));assert.throws(()=>payloadFor(s,null,'ACTIVE'));});
test('existing variant identity retained and archived items never reactivated',()=>{const s=normalizeRow(fixture()).stone;const existing={id:'p',variantId:'v',variantCount:1,handle:s.handle,tags:[FEED_TAG],status:'DRAFT',readyImage:true};assert.equal(payloadFor(s,existing).variants[0].id,'v');assert.equal(planFor([s],[{...existing,status:'ARCHIVED'}],{activate:true}).writes.length,0);});
test('certificate collision with another supplier skips creation',()=>{const s=normalizeRow(fixture()).stone;assert.equal(planFor([s],[{handle:'lg-other',certificate:s.certificate,tags:['lmny-feed']}]).writes.length,0);});
test('preview and targeted activation never withdraw unrelated stones',()=>{const s=normalizeRow(fixture()).stone;const other={id:'other',handle:'lg-color-other',tags:[FEED_TAG],status:'ACTIVE'};assert.equal(planFor([s],[other],{limit:5}).holds.length,0);assert.equal(planFor([s],[other],{activate:true}).holds.length,0);assert.equal(planFor([s],[{...other,tags:['lmny-feed']}]).holds.length,0);});
test('complete pagination required before availability writes',async()=>{let n=0;const rows=await fetchInventory('secret',async()=>({ok:true,json:async()=>({page_no:++n,total_page:2,total_results:2,data:[fixture({Stock_No:'TEST'+n})]})}));assert.equal(rows.length,2);await assert.rejects(()=>fetchInventory('secret',async()=>({ok:true,json:async()=>({page_no:1,total_page:1,total_results:2,data:[fixture()]})})));await assert.rejects(()=>fetchInventory('secret',async()=>{throw new Error('https://api.example/diamond?key=secret-url');}),e=>e.safeToLog&&e.message==='LGD supplier request failed; no inventory changes are safe'&&!e.message.includes('secret'));});
test('a dead supplier host is named without the request URL',()=>{const err=Object.assign(new TypeError('fetch failed'),{cause:{code:'ENOTFOUND',message:'getaddrinfo ENOTFOUND api.lgdusallc.com'}});const wrapped=supplierFetchError(err);assert.equal(wrapped.safeToLog,true);assert.equal(wrapped.message,'LGD supplier host does not resolve; no inventory changes are safe');assert.equal(wrapped.message.includes('lgdusallc'),false);});
test('HTML errors disguised as media cannot pass',async()=>{const s=normalizeRow(fixture()).stone;assert.equal(await mediaReady(s,async()=>new Response('<html>missing</html>',{headers:{'content-type':'text/html'}})),false);});
test('updates identify the original product separately from its input',()=>{const s=normalizeRow(fixture()).stone;const p={id:'p',variantId:'v',variantCount:1,handle:s.handle,tags:[FEED_TAG],status:'DRAFT',readyImage:true};const line=planFor([s],[p]).writes[0];assert.deepEqual(line.identifier,{id:'p'});assert.equal(line.input.id,undefined);assert.equal(line.input.variants[0].id,'v');});
test('large inventory withdrawals fail closed',()=>{const s=normalizeRow(fixture()).stone;const catalog=Array.from({length:151},(_,i)=>({id:'p'+i,handle:'lg-color-gone'+i,tags:[FEED_TAG],status:'ACTIVE'}));assert.throws(()=>planFor([s],catalog),/exceeds the limit/);});
test('throttled Shopify reads retry the same request after recovery',async()=>{let calls=0;const delays=[];const fetcher=async()=>new Response(JSON.stringify(++calls<3?{errors:[{extensions:{code:'THROTTLED'}}],extensions:{cost:{requestedQueryCost:137,throttleStatus:{currentlyAvailable:37,restoreRate:50}}}}:{data:{ok:true}}));assert.deepEqual(await requestShopify('test.myshopify.com','secret','query {}',{},fetcher,async ms=>delays.push(ms)),{ok:true});assert.equal(calls,3);assert.deepEqual(delays,[2250,2250]);});
test('Shopify failures without throttling are never retried',async()=>{let calls=0;await assert.rejects(()=>requestShopify('test.myshopify.com','secret','query {}',{},async()=>{calls++;return new Response('{}',{status:500});},async()=>{}));assert.equal(calls,1);});
test('withdrawal limit is 150, or 10% of live stones if larger, unless a reviewed maximum is given',()=>{assert.equal(withdrawalLimit(578),150);assert.equal(withdrawalLimit(20),150);assert.equal(withdrawalLimit(2000),200);assert.equal(withdrawalLimit(634,80),80);});
test('colored stones use the white loose lab-grown tiers, rounded to the dollar',()=>{const retail=(total,weight)=>normalizeRow(fixture({Buy_Price_Total:String(total),Weight:String(weight),Buy_Price:String(total/weight)})).stone.retail;assert.equal(retail(150,1),375);assert.equal(retail(400,2),900);assert.equal(retail(800,2),1600);assert.equal(retail(2000,4),3500);assert.equal(retail(127.41,1),319);assert.ok(retail(201,1)>=retail(200,1));});
test('over-limit withdrawal names the counts and a reviewed maximum allows it',()=>{const s=normalizeRow(fixture()).stone;const catalog=Array.from({length:151},(_,i)=>({id:'p'+i,handle:'lg-color-gone'+i,tags:[FEED_TAG],status:'ACTIVE'}));assert.throws(()=>planFor([s],catalog),e=>e instanceof SafeError&&/withdrawal of 151 stones exceeds the limit of 150 \(151 live\)/.test(e.message));assert.equal(planFor([s],catalog.slice(0,150)).holds.length,150);assert.equal(planFor([s],catalog,{maxWithdrawals:151}).holds.length,151);assert.throws(()=>planFor([s],catalog,{maxWithdrawals:9}),SafeError);});
test('a preview reports withdrawals over the limit instead of stopping',()=>{const s=normalizeRow(fixture()).stone;const catalog=Array.from({length:10},(_,i)=>({id:'p'+i,handle:'lg-color-gone'+i,tags:[FEED_TAG],status:'ACTIVE'}));assert.equal(planFor([s],catalog,{checkLimit:false}).holds.length,10);});
test('stocked shapes beyond the classic list are accepted under their storefront button names',()=>{const shape=v=>normalizeRow(fixture({Shape:v})).stone?.shape;assert.equal(shape('ASHOKA'),'Ashoka');assert.equal(shape('Hexagonal'),'Hexagonal');assert.equal(shape('EuropeanCut'),'European Cut');assert.equal(shape('KITE STEP CUT'),'Kite Step Cut');assert.equal(shape('MARQUISE MODIFIED BRILLI'),'Marquise');assert.equal(shape('OCTAGONAL STEP CUT'),'Octagonal');assert.equal(shape('RADIANT'),'Radiant');assert.equal(shape('CUSHION MODIFIED'),'Cushion');assert.equal(normalizeRow(fixture({Shape:'LILYCUT'})).reason,'scope');assert.equal(normalizeRow(fixture({Shape:'RING'})).reason,'scope');});

const whiteFixture = (override={}) => ({Stock_No:'W1',Shape:'OVAL',Color:'F',Clarity:'VS1',Weight:'1',Buy_Price:'200',Buy_Price_Total:'200',Diamond_Type:'Lab Grown',Lab:'IGI',Availability:'Available',ImageLink:'https://example.com/white.jpg',CertificateLink:'https://example.com/LG22222222.pdf',...override});
test('white stones are priced on the lab tiers and stay out of the colored feed',()=>{
  const stone=normalizeWhiteRow(whiteFixture()).stone;
  assert.equal(stone.handle,'lab-white-w1');
  assert.equal(stone.retail,500);
  assert.equal(stone.lab,'IGI');
  assert.equal(ownsWhite({handle:stone.handle,tags:[WHITE_TAG]}),true);
  assert.equal(ownsLgd({handle:stone.handle,tags:[WHITE_TAG]}),false);
  const payload=payloadFor(stone,undefined,'DRAFT','gid://shopify/Location/1');
  assert.equal(payload.status,'DRAFT');
  assert.ok(payload.tags.includes(WHITE_TAG));
  assert.ok(!payload.tags.includes(FEED_TAG));
  assert.ok(!payload.tags.includes('lmny-feed'));
  assert.ok(!payload.tags.includes('ebay'));
  assert.equal(payload.seo.title,'1.00ct Oval Lab-Grown Diamond — F VS1 | IGI');
  assert.ok(payload.seo.title.length<=60&&payload.seo.description.length<=160);
  assert.equal(payload.metafields.find(m=>m.key==='video_url'),undefined);
  assert.equal(payload.variants[0].inventoryQuantities[0].quantity,0);
  assert.ok(!JSON.stringify(payload).toLowerCase().includes('lgd usa'));
});
test('white feed holds grades past L, missing photos, and a per-carat price read as a total',()=>{
  assert.equal(normalizeWhiteRow(whiteFixture({Color:'M'})).reason,'color_below_floor');
  assert.equal(normalizeWhiteRow(whiteFixture({Color:'PINK'})).reason,'scope');
  assert.equal(normalizeWhiteRow(whiteFixture({ImageLink:''})).reason,'photo_or_video');
  assert.equal(normalizeWhiteRow(whiteFixture({Lab:'HRD'})).reason,'grading_or_certificate');
  assert.equal(normalizeWhiteRow(whiteFixture({Weight:'2',Buy_Price:'10',Buy_Price_Total:'20'})).reason,'cost_mismatch');
  const withVideo=normalizeWhiteRow(whiteFixture({Video_HTML:'https://example.com/white.mp4'})).stone;
  assert.equal(withVideo.video,'https://example.com/white.mp4');
  const gia=normalizeWhiteRow(whiteFixture({Lab:'GIA',CertificateLink:'https://example.com/2141438163.pdf'})).stone;
  assert.equal(gia.lab,'GIA');
  assert.equal(gia.certificate,'2141438163');
});
test('a white stone with no video still passes the media check when the photo is real',async()=>{
  const stone=normalizeWhiteRow(whiteFixture()).stone;
  const jpeg=new Uint8Array([255,216,255,217]);
  const ok=await mediaReady(stone,async()=>new Response(jpeg,{headers:{'content-type':'image/jpeg'}}));
  assert.equal(ok,true);
});
test('colored and white rows normalize together and a missing white class does not own white products',()=>{
  const color=fixture({Stock_No:'C1'});
  const white=whiteFixture();
  const rows=[{...color,_lgdType:'certified_color'},{...white,_lgdType:'certified'}];
  rows.manageWhite=true;
  const normalized=normalizeLgdFeed(rows);
  assert.deepEqual(normalized.counts,{color:1,white:1});
  assert.equal(normalized.manageWhite,true);
  const owned=[
    {id:'c',handle:'lg-color-gone',tags:[FEED_TAG],status:'ACTIVE'},
    {id:'w',handle:'lab-white-gone',tags:[WHITE_TAG],status:'ACTIVE'},
    {id:'b',handle:'lg-color-bd-gone',tags:[FEED_TAG,'belgium-color-feed'],status:'ACTIVE'},
  ];
  const plan=planFor(normalized.stones,owned,{owns:p=>ownsLgd(p)||ownsWhite(p)});
  assert.deepEqual(plan.holds.map(h=>h.handle).sort(),['lab-white-gone','lg-color-gone']);
  const colorOnly=[{...color,_lgdType:'certified_color'}];
  colorOnly.manageWhite=false;
  assert.equal(normalizeLgdFeed(colorOnly).manageWhite,false);
  assert.equal(planFor(normalizeLgdFeed(colorOnly).stones,owned).holds.map(h=>h.handle).join(),'lg-color-gone');
});
test('fetches color and white, and a 404 on white leaves color usable',async()=>{
  const seen=[];
  const logs=[];
  const realLog=console.log;
  console.log=(line)=>{logs.push(String(line));};
  const page=(stock)=>({ok:true,status:200,json:async()=>({page_no:1,total_page:1,total_results:1,data:[stock.startsWith('W')?whiteFixture({Stock_No:stock}):fixture({Stock_No:stock})]})});
  try {
    const rows=await fetchLgdInventory('secret-key',async(url)=>{
      seen.push(url.searchParams.get('type'));
      assert.equal(url.searchParams.get('key'),'secret-key');
      if(url.searchParams.get('type')==='certified') return {ok:false,status:404,body:{cancel(){}}};
      return page('C9');
    });
    assert.deepEqual(seen,['certified_color','certified']);
    assert.equal(rows.length,1);
    assert.equal(rows.manageWhite,false);
    assert.equal(rows[0].Stock_No,'C9');
    assert.ok(logs.every(line=>!line.includes('secret-key')));
  } finally { console.log=realLog; }
});
test('a white-class failure leaves the colored rows and does not own white products',async()=>{
  const rows=await fetchLgdInventory('secret-key',async(url)=>{
    if(url.searchParams.get('type')==='certified') throw Object.assign(new TypeError('fetch failed'),{cause:{code:'ENOTFOUND',message:'https://api.example/diamond?key=secret-key'}});
    return {ok:true,status:200,json:async()=>({page_no:1,total_page:1,total_results:1,data:[fixture({Stock_No:'C4'})]})};
  });
  assert.equal(rows.manageWhite,false);
  assert.equal(rows.length,1);
  assert.equal(rows[0]._lgdType,'certified_color');
});
test('retries a timed-out page and still hides the request URL',async()=>{
  let calls=0;
  const rows=await fetchInventory('secret-key',async()=>{
    calls++;
    if(calls===1) throw Object.assign(new TypeError('fetch failed'),{cause:{code:'ETIMEDOUT',message:'https://api.example/diamond?key=secret-key'}});
    return {ok:true,status:200,json:async()=>({page_no:1,total_page:1,total_results:1,data:[fixture()]})};
  });
  assert.equal(rows.length,1);
  assert.equal(calls,2);
});
test('LGD_API_BASE replaces the endpoint and rejects a URL that would leak the key',()=>{
  assert.equal(inventoryEndpoint({LGD_API_BASE:'https://example.com/developer-api/diamond'}),'https://example.com/developer-api/diamond');
  assert.equal(inventoryEndpoint({}),'https://api.lgdusallc.com/api/v1/inventory/diamond');
  assert.throws(()=>inventoryEndpoint({LGD_API_BASE:'https://user:secret@example.com/diamond'}));
  assert.throws(()=>inventoryEndpoint({LGD_API_BASE:'http://example.com/diamond'}));
});
