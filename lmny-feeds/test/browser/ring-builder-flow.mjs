import { chromium } from 'playwright';
import fs from 'node:fs';import assert from 'node:assert/strict';
const repo = new URL('../../../', import.meta.url).pathname.replace(/\/$/, '');
const fixtures=JSON.parse(fs.readFileSync(new URL('./ring-flow-fixtures.json',import.meta.url),'utf8'));
const settings=fixtures.settings,baseStones=fixtures.stones,raw=fixtures.diamonds;
{const round=fixtures.settings.find(p=>p.shape==='Round');const white=structuredClone(round);white.handle='round-white-setting';white.title='Round setting in White Gold';white.options[1].values=['14K White Gold'];white.variants=white.variants.filter(v=>v.options[1]==='14K Yellow Gold').map(v=>({...v,id:v.id+500000,price:v.price+5000,options:[v.options[0],'14K White Gold']}));settings.push(white);}
const cfg={settings,copy:JSON.parse(fs.readFileSync(repo+'/locales/en.default.json','utf8').replace(/^\s*\/\*[\s\S]*?\*\//, '')).ring_flow,apiBase:'https://fixtures.supabase.co/functions/v1/diamonds',apiKey:'',root:'/',cartUrl:'/cart',contact:'/pages/contact',appointment:'/pages/private-clients',sizeGuide:'/pages/ring-size-guide',currency:'USD'};
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const fixtureImages={setting:[{image:pixel}],diamond:[{image:pixel},{image:pixel},{image:pixel}]};
cfg.copy.tax_shipping = 'Tax &amp; shipping calculated at checkout.';
const diamonds=raw.map((p,i)=>({handle:p.handle,title:p.title,type:p.type,shape:'Oval',available:true,setting:false,url:'/products/'+p.handle,image:"https://images.test/diamond-"+i+".jpg",images:["https://images.test/diamond-"+i+".jpg","https://images.test/diamond-alt.jpg"],videos:['https://media.example/video.mp4'],options:p.options,variants:p.variants.map(v=>({id:v.id,price:v.price,available:v.available,options:v.options}))}));
const round={...structuredClone(diamonds[0]),handle:'lg-round-test',shape:'Round',title:'Round lab-grown diamond'};round.variants[0].id=100001;const stoneRound={...baseStones[0],stock_ref:'round-test',shape:'Round'};
const band={handle:'test-wedding-band',title:'Round lab-grown diamond wedding band',type:'Rings',band:true,setting:false,available:true,image:'https://images.test/band.jpg',url:'/products/test-wedding-band',options:[{name:'Size',values:['6.25','7']},{name:'Metal',values:['14K White Gold','18K White Gold']}],variants:[{id:80001,price:90000,available:true,options:['6.25','14K White Gold']},{id:80002,price:115000,available:true,options:['6.25','18K White Gold']},{id:80003,price:90000,available:false,options:['7','14K White Gold']}]};
cfg.bands=[{handle:band.handle,title:band.title},{handle:'white-band',title:'Round band in White Gold',price:90000,price_varies:true}];
const products=new Map([...settings,...diamonds,round,band].map(p=>[p.handle,structuredClone(p)]));
const b=await chromium.launch({executablePath:process.env.LMNY_TEST_CHROMIUM || undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
let mode='normal',cartItems=[],posts=[],searches=[],failSearch=false,priceBump=false,productUnavailable=false;
const { Liquid } = await import(process.env.LMNY_TEST_LIQUIDJS || 'liquidjs');
const liquid = new Liquid({root:repo+'/snippets',extname:'.liquid'});
liquid.registerTag('doc',{parse(tag,remain){let token;while((token=remain.shift()))if(token.name==='enddoc')break;},render(){return '';}});
const filterSource = fs.readFileSync(repo+'/sections/ring-builder-flow.liquid','utf8').match(/<template data-diamond-filter-template>[\s\S]*?<\/template>/)[0];
const filterTemplate = await liquid.parseAndRender(filterSource,{request:{path:'/pages/ring-builder'},cart:{currency:{symbol:'$'}}});
const html=`<meta charset="utf-8"><link rel="stylesheet" href="/assets/ring-builder-flow.css"><link rel="stylesheet" href="/assets/diamond-filter.css"><div id="lmny-ring-builder"><div class="intro"><h1>${cfg.copy.title}</h1><nav><span data-stage="1">1</span><span data-stage="2">2</span><span data-stage="3">3</span></nav></div><div class="status" data-flow-status role="status"></div><div class="layout solo"><div class="flow-body" data-flow-main><button data-action="start-diamond">${cfg.copy.start_diamond}</button><button data-action="start-setting">${cfg.copy.start_setting}</button></div><aside data-flow-summary hidden></aside></div><div class="dock" data-flow-dock hidden></div><footer><button data-action="restart">${cfg.copy.start_again}</button></footer>${filterTemplate}<script type="application/json" data-flow-config>${JSON.stringify(cfg)}</script></div><script src="/assets/ring-builder-flow.js" defer></script>`;
async function newPage(){const p=await b.newPage({viewport:{width:1024,height:950}});p.on('pageerror',e=>{throw e;});await p.route('**/*',async r=>{const u=new URL(r.request().url()),method=r.request().method();const json=o=>r.fulfill({contentType:'application/json',body:JSON.stringify(o)});
 if(u.hostname==='lmny.test'&&u.pathname==='/assets/ring-builder-flow.js')return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(repo+'/assets/ring-builder-flow.js','utf8')});
 if(u.hostname==='lmny.test'&&u.pathname==='/assets/diamond-filter.css')return r.fulfill({contentType:'text/css',body:fs.readFileSync(repo+'/assets/diamond-filter.css','utf8')});
 if(u.hostname==='lmny.test'&&u.pathname==='/assets/ring-builder-flow.css')return r.fulfill({contentType:'text/css',body:fs.readFileSync(repo+'/assets/ring-builder-flow.css','utf8')});
 if(u.hostname==='lmny.test'&&u.pathname.startsWith('/products/')){const handle=u.pathname.split('/')[2];let product=structuredClone(products.get(handle));if(product && r.request().headers().accept?.includes('application/json'))return json({product:{id:1,title:product.title}});if(!product)return r.fulfill({status:404,contentType:'application/json',body:'{}'});if(productUnavailable&&product.setting)product.available=false;if(priceBump&&product.setting)product.variants.forEach(v=>v.price+=1000);return json(product);}
 if(u.hostname.endsWith('supabase.co')){if(failSearch)return r.fulfill({status:503,contentType:'application/json',body:'{}'});if(u.searchParams.has('stock_ref')){const ref=u.searchParams.get('stock_ref');const s=baseStones.find(s=>s.stock_ref===ref)||stoneRound;return json({stone:{...s,polish:'Excellent',symmetry:'Excellent',fluorescence:'None',measurements:'8 × 5 mm',table_pct:59,depth_pct:62}});}searches.push(Object.fromEntries(u.searchParams));const shape=u.searchParams.get('shape');const rows=shape==='Round'?[stoneRound]:shape==='Oval'?baseStones.filter(s=>diamonds.some(p=>p.handle==='lg-'+s.stock_ref)).slice(0,3):[];return json({stones:rows,total:rows.length,total_pages:rows.length?2:1});}
 if(u.pathname==='/cart.js')return json({items:cartItems});
 if(u.pathname==='/cart/add.js'&&method==='POST'){const payload=r.request().postDataJSON();posts.push(payload);const lines=payload.items.map((item,i)=>({...item,key:'line-'+posts.length+'-'+i,variant_id:item.id,handle:i===0?item.properties._lm_setting_handle:i===2?item.properties._lm_band_handle:item.properties._lm_diamond_handle}));if(mode==='partial'){cartItems.push(lines[0]);return r.fulfill({status:422,contentType:'application/json',body:JSON.stringify({status:422,description:'Sold out'})});}cartItems.push(...lines);if(mode==='lost_response')return r.abort('failed');return json({items:lines});}
 if(u.pathname==='/cart/update.js'){const {updates}=r.request().postDataJSON();cartItems=cartItems.filter(i=>updates[i.key]!==0);return json({items:cartItems});}
 if(u.hostname==='lmny.test'&&u.pathname==='/cart')return r.fulfill({contentType:'text/html; charset=utf-8',body:'<h1>Native Shopify bag</h1><button>Checkout</button>'});
 if(u.hostname==='lmny.test')return r.fulfill({contentType:'text/html; charset=utf-8',body:html});
 if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/jpeg',body:Buffer.from((u.hostname==='images.test'?fixtureImages.diamond[0].image:fixtureImages.setting[0].image).split(',')[1],'base64')});return r.abort();});return p;}
const shot=async(p,name)=>{if(process.env.LMNY_FLOW_PREVIEW)await p.screenshot({path:process.env.LMNY_FLOW_PREVIEW+'/'+name+'.png',fullPage:true});};
const click=(p,a)=>p.locator('[data-action="'+a+'"]').first().click();
async function choose(p,first='setting',shape='Oval'){await p.goto('https://lmny.test/pages/ring-builder');await click(p,'start-'+first);if(shape!=='Oval'){await p.locator('[data-filter="shape"]').selectOption(shape);if(first==='diamond')await p.locator('[data-search-form]').evaluate(f=>f.requestSubmit());}await click(p,'details-0');await click(p,'select');await click(p,'details-0');await click(p,'select');await p.locator('[data-field="size"]').waitFor();}
for(const first of ['diamond','setting']){const p=await newPage();await choose(p,first);assert.equal((await p.locator('[data-flow-summary]').innerText()).includes('&amp;'),false);assert.equal(await p.locator('[data-action="add"]').isDisabled(),true);await p.locator('[data-field="size"]').selectOption('6.5');await p.locator('[data-field="engraving"]').fill('<Love & us>');await p.locator('[data-field="font"]').selectOption('script');await p.locator('[data-field="date"]').fill('2027-01-01');await click(p,'change-diamond');await click(p,'details-1');await click(p,'select');assert.equal(await p.locator('[data-field="size"]').inputValue(),'6.5');assert.equal(await p.locator('[data-field="engraving"]').inputValue(),'<Love & us>');await p.reload();await p.locator('[data-field="size"]').waitFor();assert.equal(await p.locator('[data-field="size"]').inputValue(),'6.5');for(const width of [320,390,736,1024]){await p.setViewportSize({width,height:950});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width);}await click(p,'add');await p.waitForURL('**/cart');const payload=posts.at(-1);assert.equal(payload.items.length,2);assert.equal(payload.items[0].properties.Engraving,'<Love & us>');assert.equal(payload.items[0].properties['Ring size'],'6.5');assert.equal(payload.items[0].properties['Requested date'],'2027-01-01');assert.equal(payload.items[0].properties._lm_ring_id,payload.items[1].properties._lm_ring_id);await p.close();cartItems=[];}
console.log('PASS both paths, filters, media, size, engraving, state restore, shape matching, payload, native cart redirect, responsive 320–1024.');
{const p=await newPage();await choose(p,'setting','Round');await p.locator('[data-field="size"]').selectOption('6.5');const metal=p.locator('[data-option="1"]');const values=await metal.locator('option').evaluateAll(o=>o.map(x=>x.value));assert.equal(values.length,2);await metal.selectOption(values[1]);await click(p,'add');await p.waitForURL('**/cart');const payload=posts.at(-1);assert.equal(payload.items[0].properties.Metal,values[1]);await p.close();cartItems=[];}
console.log('PASS live Metal and Size variant combination.');
{const p=await newPage();await choose(p);await p.locator('[data-field="size"]').selectOption('6.5');priceBump=true;const before=posts.length;await click(p,'add');await p.getByRole('alert').filter({hasText:'price has changed'}).waitFor();assert.equal(posts.length,before);await click(p,'add');await p.waitForURL('**/cart');priceBump=false;cartItems=[];await p.close();}
console.log('PASS changed price requires explicit confirmation before cart mutation.');
{const p=await newPage();await choose(p);await p.locator('[data-field="size"]').selectOption('unsure');productUnavailable=true;const before=posts.length;await click(p,'add');await p.getByRole('alert').filter({hasText:'no longer available'}).waitFor();assert.equal(posts.length,before);productUnavailable=false;await p.close();}
for(const failure of ['partial','lost_response']){const p=await newPage();await choose(p);await p.locator('[data-field="size"]').selectOption('unsure');cartItems=[{key:'unrelated',id:999,quantity:1,properties:{}}];mode=failure;await click(p,'add');if(failure==='partial'){await p.getByRole('alert').waitFor();assert.deepEqual(cartItems.map(i=>i.key),['unrelated']);assert.equal(await p.locator('[data-action="add"]').isDisabled(),false);}else{await p.waitForURL('**/cart');assert.equal(cartItems.length,3);assert.equal(posts.at(-1).items[0].properties['Size check'],'Not sure — confirm with Laura');}mode='normal';cartItems=[];await p.close();}
console.log('PASS availability guard, unsure sizing, partial rollback preserving unrelated cart lines, lost-response idempotence.');
{const p=await newPage();await p.goto('https://lmny.test/pages/ring-builder');await click(p,'start-diamond');await click(p,'more-filters');await p.locator('[data-scale="color"] [data-grade="D"]').click();await p.locator('[data-scale="color"] [data-grade="E"]').click();await p.locator('[data-scale="clarity"] [data-grade="VS1"]').click();await p.locator('[data-filter="min_carat"]').fill('2');await p.locator('[data-filter="max_carat"]').fill('3');await p.locator('[data-search-form]').evaluate(f=>f.requestSubmit());await p.waitForTimeout(50);assert.equal(searches.at(-1).colors,'E,D');assert.equal(searches.at(-1).clarities,'VS1');assert.equal(searches.at(-1).min_carat,'2');await click(p,'next');await p.waitForTimeout(50);assert.equal(searches.at(-1).page,'2');failSearch=true;await click(p,'previous');await p.getByText('We could not load these products.',{exact:false}).waitFor();failSearch=false;await click(p,'retry');await click(p,'details-0');await p.getByText('Symmetry',{exact:true}).waitFor();assert.ok(await p.locator('a').filter({hasText:'View certificate'}).getAttribute('href'));await click(p,'video-0');assert.equal(await p.locator('video').count(),1);await p.close();}
console.log('PASS full API filters, pagination, search recovery, detailed specs/certificate/video.');
{
 const p=await newPage();await choose(p);await p.locator('[data-field="size"]').selectOption('6.5');await p.locator('[data-field="engraving"]').fill('Original');await click(p,'add');await p.waitForURL('**/cart');const group=posts.at(-1).items[0].properties._lm_ring_id;const sh=posts.at(-1).items[0].properties._lm_setting_handle;const dh=posts.at(-1).items[0].properties._lm_diamond_handle;await p.close();
 const edit=await newPage();await edit.goto('https://lmny.test/pages/ring-builder?setting='+sh+'&diamond='+dh+'&edit_group='+group);await edit.locator('[data-field="size"]').waitFor();assert.equal(await edit.locator('[data-field="engraving"]').inputValue(),'Original');await edit.locator('[data-field="engraving"]').fill('Edited');await click(edit,'add');await edit.waitForURL('**/cart');assert.equal(cartItems.length,2);assert.equal(cartItems[0].properties.Engraving,'Edited');assert.notEqual(cartItems[0].properties._lm_ring_id,group);await edit.close();cartItems=[];
}
console.log('PASS editing an existing cart ring restores properties and replaces the old pair without duplicate lines.');

{const p=await newPage();await p.goto('https://lmny.test/pages/ring-builder');await click(p,'start-setting');await click(p,'details-0');await click(p,'select');
const shapeCount=await p.locator('.lm-shape').count();assert.ok(shapeCount>10);assert.equal(await p.locator('.lm-shape',{hasText:'Ashoka'}).count(),1);assert.equal(await p.locator('.lm-shape input:disabled').count(),shapeCount);assert.equal(await p.locator('.lm-shape input:checked').inputValue(),'Oval');
for(const width of [320,390,736,1024,1440]){await p.setViewportSize({width,height:950});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'filter overflow '+width);}
await p.locator('[data-origin="natural"]').click();assert.equal(await p.locator('[data-filter="max_price"]').getAttribute('max'),'250000');await p.locator('[data-origin="lab"]').click();
await p.locator('[data-filter="min_carat"]').fill('');await p.locator('[data-filter="min_carat"]').pressSequentially('1.25');assert.equal(await p.locator('[data-filter="min_carat"]').inputValue(),'1.25');await click(p,'more-filters');await p.locator('[data-scale="cut"] [data-grade="Excellent"]').click();await p.locator('[data-scale="cut"] [data-grade="Ideal"]').click();await p.getByRole('button',{name:'View Diamonds',exact:true}).click();await p.waitForTimeout(50);assert.equal(searches.at(-1).cuts,'Excellent,Ideal');
await click(p,'reset');await p.waitForTimeout(50);assert.equal(await p.locator('[data-scale] input:checked').count(),0);assert.equal(await p.locator('.lm-shape input:checked').inputValue(),'Oval');assert.ok((await p.locator('[data-flow-summary]').innerText()).includes(settings[0].title));await p.close();}
console.log('PASS original shared filter controls, multiple grades, origin ranges, locked setting, reset and responsive filter layout.');

for (const failure of ['normal','partial','lost_response']) {
 const p=await newPage();await choose(p);await p.locator('[data-field="size"]').selectOption('6.5');
 const oldTotal=await p.locator('[data-flow-summary] .total').innerText();
 await p.locator('[data-band-product]').selectOption(band.handle);await p.locator('[data-band-option="0"]').waitFor();
 assert.equal(await p.locator('[data-action="add"]').isDisabled(),true);
 await p.locator('[data-band-option="0"]').selectOption('7');await p.locator('[data-band-option="1"]').selectOption('14K White Gold');
 assert.equal(await p.locator('[data-action="add"]').isDisabled(),true);
 await p.locator('[data-band-option="0"]').selectOption('6.25');await p.locator('[data-band-option="1"]').selectOption('18K White Gold');
 assert.notEqual(await p.locator('[data-flow-summary] .total').innerText(),oldTotal);
 await p.reload();await p.locator('[data-band-option="0"]').waitFor();assert.equal(await p.locator('[data-band-option="0"]').inputValue(),'6.25');
 for(const width of [320,390,1024]) {await p.setViewportSize({width,height:950});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 if(failure==='normal' && process.env.LMNY_BAND_PREVIEW) await p.screenshot({path:process.env.LMNY_BAND_PREVIEW,fullPage:true});
 mode=failure;cartItems=[{key:'unrelated',id:999,quantity:1,properties:{}}];await click(p,'add');
 if(failure==='partial'){await p.getByRole('alert').waitFor();assert.deepEqual(cartItems.map(i=>i.key),['unrelated']);}
 else {await p.waitForURL('**/cart');const payload=posts.at(-1);assert.equal(payload.items.length,3);assert.equal(payload.items[2].id,80002);assert.equal(cartItems.length,4);
  if(failure==='normal') {const props=payload.items[0].properties;mode='normal';await p.goto('https://lmny.test/pages/ring-builder?setting='+props._lm_setting_handle+'&diamond='+props._lm_diamond_handle+'&edit_group='+props._lm_ring_id);await p.locator('[data-band-option="0"]').waitFor();assert.equal(await p.locator('[data-band-option="1"]').inputValue(),'18K White Gold');await click(p,'remove-band');await click(p,'add');await p.waitForURL('**/cart');assert.equal(cartItems.length,3);assert.equal(posts.at(-1).items.length,2);}
 }
 mode='normal';cartItems=[];await p.close();
}
console.log('PASS optional band size/metal, unavailable combination, subtotal, reload, responsive layout, three-line add, rollback, lost response and editing/removal.');
{const p=await newPage();await p.emulateMedia({reducedMotion:'reduce'});await p.setViewportSize({width:390,height:844});await p.goto('https://lmny.test/pages/ring-builder');
 assert.equal(await p.locator('[data-flow-dock]').isHidden(),true);
 await click(p,'start-diamond');await p.locator('[data-results] .product').first().waitFor();
 assert.equal(await p.locator('.lm-dfilter__origin-btn',{hasText:'Colored'}).isHidden(),true);
 assert.equal(await p.locator('.lm-dfilter__shapes > .lm-shape',{hasText:'Oval'}).first().locator('.lm-shape__fit').innerText(),'1 setting');
 assert.equal(await p.locator('.more-shapes .lm-shape',{hasText:'Ashoka'}).count(),1);assert.equal(await p.locator('.more-shapes .lm-shape__fit').count(),0);
 assert.equal(await p.locator('[data-flow-dock]').isVisible(),true);assert.ok((await p.locator('[data-flow-dock]').innerText()).includes('$0.00'));await shot(p,'mobile-catalog');
 await p.locator('[data-action="details-2"]').scrollIntoViewIfNeeded();await p.evaluate(()=>scrollBy(0,600));
 await click(p,'details-2');await p.locator('.detail').waitFor();
 const top=await p.locator('.layout').evaluate(e=>e.getBoundingClientRect().top);assert.ok(top>=0&&top<200,'detail opens at its top, got '+top);
 assert.equal(await p.evaluate(()=>document.activeElement.tagName),'H2');await shot(p,'mobile-detail');
 await click(p,'catalog');await p.locator('[data-results] .product').first().waitFor();await p.waitForTimeout(50);
 const card=await p.locator('[data-action="details-2"]').evaluate(e=>{const r=e.closest('.product').getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;});assert.ok(card,'back to results returns to the opened stone');
 await click(p,'details-0');await click(p,'select');await p.locator('[data-count]').filter({hasText:'1 setting'}).waitFor();
 assert.deepEqual(await p.locator('[data-filter="shape"] option').allInnerTexts(),['Round','Oval']);
 await click(p,'details-0');await click(p,'select');await p.locator('[data-field="size"]').waitFor();
 assert.equal(await p.locator('[data-inscription]').isHidden(),true);await p.locator('[data-field="engraving"]').fill('Always');assert.equal(await p.locator('[data-inscription]').isVisible(),true);
 await p.evaluate(()=>scrollTo(0,0));const before=posts.length;await click(p,'dock-add');await p.getByRole('alert').filter({hasText:'Choose a ring size'}).waitFor();assert.equal(posts.length,before);
 await shot(p,'mobile-review');const sizeTop=await p.locator('[data-field="size"]').evaluate(e=>e.getBoundingClientRect().top);assert.ok(sizeTop>=0&&sizeTop<844,'size field brought into view');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.close();}
{const p=await newPage();await p.goto('https://lmny.test/pages/ring-builder');await click(p,'start-setting');
 assert.deepEqual(await p.locator('[data-filter="shape"] option').allInnerTexts(),['Round','Oval']);assert.equal(await p.locator('[data-count]').innerText(),'1 setting');await p.close();}
console.log('PASS colored tab hidden, setting counts on shapes, rare shapes folded, singular counts, scroll and focus on screen change, return to opened card, mobile dock, hidden empty inscription.');
{const p=await newPage();await p.goto('https://lmny.test/pages/ring-builder');await click(p,'start-diamond');await p.locator('[data-results] .product').first().waitFor();
 assert.equal(await p.locator('[data-more-filters]').isHidden(),true);await click(p,'more-filters');assert.equal(await p.locator('[data-more-filters]').isVisible(),true);
 const n=searches.length;await p.locator('[data-scale="clarity"] [data-grade="VS2"]').click();await p.waitForTimeout(450);assert.equal(searches.length,n+1,'filters search without a submit');assert.equal(searches.at(-1).clarities,'VS2');
 assert.ok((await p.locator('[data-action="more-filters"]').innerText()).includes('(1)'));
 await click(p,'carat-1');await p.waitForTimeout(50);assert.equal(searches.at(-1).min_carat,'1.5');assert.equal(searches.at(-1).max_carat,'1.99');assert.equal(await p.locator('[data-action="carat-1"]').getAttribute('aria-pressed'),'true');
 assert.equal(await p.locator('[data-filter="min_carat"]').inputValue(),'1.5');
 await click(p,'carat-1');await p.waitForTimeout(50);assert.equal(searches.at(-1).min_carat,undefined);
 await p.locator('[data-filter="min_carat"]').fill('3');await p.locator('[data-filter="max_carat"]').fill('2');await p.waitForTimeout(900);assert.notEqual(searches.at(-1).min_carat,'3','an inverted range never searches');
 await p.locator('[data-filter="max_carat"]').fill('');await p.locator('[data-filter="min_carat"]').fill('');await p.waitForTimeout(900);
 await p.locator('.lm-dfilter__group--wide > .lm-dfilter__shapes > .lm-shape',{hasText:'Round'}).first().click();await p.locator('.lm-dfilter__group--wide > .lm-dfilter__shapes > .lm-shape',{hasText:'Oval'}).first().click();await p.waitForTimeout(450);assert.equal(searches.at(-1).shape,'Round');
 await p.locator('[data-results] .product').first().waitFor();await click(p,'details-0');await p.locator('.detail').waitFor();
 assert.ok(await p.locator('.detail [data-action="select"]').evaluate(b=>!!(b.compareDocumentPosition(document.querySelector('.detail .facts'))&Node.DOCUMENT_POSITION_FOLLOWING)),'select sits above the facts');
 assert.equal(await p.locator('.detail-help a').count(),2);assert.equal(await p.locator('[data-action^="video-"]').count(),1);
 await click(p,'catalog');await p.locator('[data-results] .product').first().waitFor();await click(p,'quick-0');await p.locator('[data-count]').filter({hasText:'settings'}).waitFor();
 assert.ok((await p.locator('[data-flow-summary]').innerText()).includes('Round lab-grown diamond'));
 assert.deepEqual(await p.locator('[data-filter="metal"] option').allInnerTexts(),['All metals','Yellow gold','White gold']);
 await p.locator('[data-filter="metal"]').selectOption('white');assert.equal(await p.locator('[data-count]').innerText(),'1 setting');
 await click(p,'quick-0');await p.locator('[data-field="size"]').waitFor();
 assert.equal(await p.locator('[data-option="1"]').inputValue(),'14K White Gold');
 assert.equal(await p.locator('a',{hasText:'Ring size guide'}).getAttribute('href'),'/pages/ring-size-guide');
 assert.ok((await p.locator('[data-flow-summary]').innerText()).includes('1-year warranty'));
 assert.equal(await p.locator('optgroup').first().getAttribute('label'),'Matches your white gold setting');
 assert.deepEqual(await p.locator('optgroup').first().locator('option').allInnerTexts(),['Round band in White Gold · From $900.00']);
 await p.locator('[data-field="size"]').selectOption('6.25');await p.locator('[data-band-product]').selectOption(band.handle);await p.locator('[data-band-option="0"]').waitFor();
 assert.equal(await p.locator('[data-band-option="0"]').inputValue(),'6.25','band size follows the ring size');
 for(const width of [320,390,1024]){await p.setViewportSize({width,height:950});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width);}
 await p.close();}
console.log('PASS live filtering, carat size chips, more filters, select above specs, quick select, setting metal filter and preset, size guide, matched bands with prices, band size preset.');
await b.close();
