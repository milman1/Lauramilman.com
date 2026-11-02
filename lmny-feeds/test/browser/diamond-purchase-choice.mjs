import { chromium } from 'playwright';
import { Liquid } from 'liquidjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('../../../', import.meta.url).pathname;
const read = p => fs.readFileSync(root+p,'utf8');
const copy = JSON.parse(read('locales/en.default.json').replace(/^\s*\/\*[\s\S]*?\*\//,''));
const liquid = new Liquid({root:root+'snippets',extname:'.liquid'});
for (const tag of ['doc','schema']) liquid.registerTag(tag,{parse(token,tokens){while(tokens.length && tokens.shift().name!=='end'+tag){}},render(){return '';}});
liquid.registerTag('form', {
 parse(token,tokens) {
  this.product = token.args.startsWith("'product'"); this.templates=[];
  const stream=this.liquid.parser.parseStream(tokens).on('tag:endform',()=>stream.stop()).on('template',t=>this.templates.push(t));stream.start();
 },
 *render(ctx,emitter) {
  emitter.write(this.product ? '<form id="diamond-form-test" action="/cart/add" method="post" data-product-form>' : '<form action="/contact" method="post">');
  yield this.liquid.renderer.renderTemplates(this.templates,ctx,emitter);emitter.write('</form>');
 }
});
liquid.registerFilter('t',(key,...args)=>{let s=key.split('.').reduce((o,k)=>o?.[k],copy)||key;for(const [k,v] of args) s=s.replaceAll('{{ '+k+' }}',v);return s;});
liquid.registerFilter('money_without_trailing_zeros',v=>'$'+Number(v/100).toLocaleString('en-US',{maximumFractionDigits:2}));
liquid.registerFilter('money',v=>'$'+Number(v/100).toLocaleString('en-US',{minimumFractionDigits:2}));
liquid.registerFilter('image_url',(image)=>typeof image==='string'?image:image.src);
liquid.registerFilter('asset_url',v=>'/assets/'+v);
liquid.registerFilter('stylesheet_tag',v=>'<link rel="stylesheet" href="'+v+'">');
liquid.registerFilter('json',v=>JSON.stringify(v));
const image = name=>({src:'https://lmny.test/images/'+name+'.jpg',alt:name});
const variant={id:123456,price:21700,sku:'TEST-DIAMOND',available:true};
const product={id:1,handle:'lg-test',url:'/products/lg-test',title:'1.01 ct Round Lab-Grown Diamond',type:'Lab-Grown Diamond',available:true,selected_or_first_available_variant:variant,variants:[variant],featured_media:image('diamond'),featured_image:image('diamond'),media:[image('diamond')],tags:[],metafields:{custom:{diamond_shape:{value:'Round'},carat_weight:{value:1.01},color:'D',clarity:'VS2',cut:'Ideal'},lmny_feed:{stock_ref:'TEST-DIAMOND',cert_url:'https://certificate.test/report',video_url:'https://media.test/stone.mp4',lab:'IGI'}}};
const setting=(id,title,prices,shape='Round',available=true,tags=['ring-setting'])=>({id,handle:'setting-'+id,title,available,tags,featured_image:image('setting-'+id),metafields:{custom:{diamond_shape:{value:shape}}},variants:prices.map(([price,available])=>({price,available}))});
const settings=[setting(2,'Round Solitaire Setting in White Gold',[[110000,false],[120000,true],[145000,true]]),setting(3,'Round Hidden Halo in Yellow Gold',[[135000,true]]),setting(4,'Petite Solitaire in Yellow Gold',[[120000,true]]),setting(5,'Unavailable setting',[[90000,false]],'Round',false),setting(6,'Oval setting',[[100000,true]],'Oval'),setting(7,'Finished ring',[[200000,true]],'Round',true,[])];
async function render({available=true,matches=true}={}) {
 const p=structuredClone(product);p.available=available;p.selected_or_first_available_variant.available=available;
 liquid.options.globals={collections:{'ring-settings':{products:matches?settings:[]}},routes:{root_url:'/',collections_url:'/collections'},shop:{url:'https://lmny.test'},request:{origin:'https://lmny.test'}};
 const html=await liquid.parseAndRender(read('sections/main-product-diamond.liquid'),{product:p,section:{id:'test',settings:{}},collections:{'ring-settings':{products:matches?settings:[]}},routes:{root_url:'/',collections_url:'/collections'},shop:{url:'https://lmny.test'},request:{origin:'https://lmny.test'},canonical_url:'https://lmny.test/products/lg-test'});
 return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/assets/theme.css"></head><body><header style="padding:18px;text-align:center;font-family:var(--font-heading);font-size:30px">Laura Milman <small style="display:block;font:10px var(--font-body);letter-spacing:5px">NEW YORK</small></header>'+html+'<div id="cart-notification" hidden>Added to cart</div><script src="/assets/theme.js"></script><footer style="height:160px;padding:50px">Laura Milman New York</footer></body></html>';
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
async function pageFor(options={},width=1440,javascript=true) {
 const html=await render(options);const page=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled:javascript});const posts=[];page.setDefaultTimeout(10000);
 if(options.tracking) await page.addInitScript(({allowed})=>{ window.tracked=[]; window.allowed=allowed; window.Shopify={customerPrivacy:{analyticsProcessingAllowed:()=>window.allowed},analytics:{publish:(name,data)=>{window.tracked.push({name,data});return true;}}}; },{allowed:options.allowed!==false});
 page.on('pageerror',e=>{throw e;});
 await page.route('**/*',route=>{
  const req=route.request(),url=new URL(req.url());
  if(req.method()==='POST'){posts.push({path:url.pathname,body:req.postDataJSON()});return route.fulfill({status:options.failCart?422:200,contentType:'application/json',body:options.failCart?'{}':'{"id":123456,"quantity":1}'});}
  if(url.pathname==='/cart.js')return route.fulfill({contentType:'application/json',body:'{"items":[],"item_count":1}'});
  if(url.pathname.startsWith('/assets/'))return route.fulfill({contentType:url.pathname.endsWith('.css')?'text/css':'text/javascript',body:read(url.pathname.slice(1))});
  if(req.resourceType()==='image') {
   const path=process.env.LMNY_DIAMOND_PREVIEW+'/'+url.pathname.split('/').pop();
   return route.fulfill({contentType:'image/jpeg',body:process.env.LMNY_DIAMOND_PREVIEW && fs.existsSync(path)?fs.readFileSync(path):pixel});
  }
  if(url.pathname==='/checkout')return route.fulfill({contentType:'text/html',body:'<h1>Checkout test</h1>'});
  if(url.hostname!=='lmny.test')return route.abort();
  return route.fulfill({contentType:'text/html',body:html});
 });
 await page.goto('https://lmny.test/products/lg-test');return {page,posts};
}
for(const width of [1440,390,320]) {
 const {page:p,posts}=await pageFor({},width);
 assert.equal(await p.locator('[data-diamond-choice]').isVisible(),true);
 assert.equal(await p.locator('[data-diamond-buy]').isVisible(),false);
 assert.equal(await p.locator('[data-diamond-build]').isVisible(),true);
 assert.equal(await p.locator('.dsp__card').count(),3);
 const first=p.locator('.dsp__card').first();assert.match(await first.innerText(),/Setting from \$1,200/);assert.match(await first.innerText(),/With this diamond from \$1,417/);
 for(const link of await p.locator('.dsp__link, .dsp__all, [data-diamond-build] a').evaluateAll(links=>links.map(a=>a.href))) {const u=new URL(link);assert.equal(u.pathname,'/pages/ring-builder');assert.equal(u.searchParams.get('diamond'),'lg-test');}
 const cardURL=new URL(await first.locator('a').getAttribute('href'),'https://lmny.test');assert.equal(cardURL.searchParams.get('setting'),'setting-2');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const tops=await p.locator('.dpdp__stat').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().top));assert.equal(new Set(tops).size,1);
 if(process.env.LMNY_DIAMOND_PREVIEW && width!==320){await p.locator('.dsp').scrollIntoViewIfNeeded();await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:process.env.LMNY_DIAMOND_PREVIEW+'/build-'+width+'.png',fullPage:true});}
 await p.locator('[data-diamond-choice] input[value="ring"]').focus();await p.keyboard.press('ArrowRight');
 assert.equal(await p.locator('[data-diamond-buy]').isVisible(),true);assert.equal(await p.locator('[data-diamond-settings]').isVisible(),false);
 await p.locator('[data-diamond-buy] .atc-btn').first().click();await p.waitForFunction(()=>document.querySelector('[data-diamond-buy] .atc-btn').textContent.includes('Added'));
 assert.deepEqual(posts,[{path:'/cart/add.js',body:{id:123456,quantity:1}}]);
 if(width<600) {
  await p.locator('.dpdp__specifications').scrollIntoViewIfNeeded();await p.locator('[data-diamond-dock]').waitFor({state:'visible'});
  assert.equal(await p.locator('[data-diamond-dock-buy]').isDisabled(),true);
  await p.waitForFunction(()=>!document.querySelector('[data-diamond-dock-buy]').disabled);
  await p.locator('[data-diamond-dock-buy]').click();await p.waitForFunction(()=>document.querySelector('[data-diamond-buy] .atc-btn').textContent.includes('Added'));assert.equal(posts.length,2);
 }
 await p.locator('[data-diamond-choice] input[value="ring"]').check();assert.equal(await p.locator('[data-diamond-buy]').isVisible(),false);
 await p.locator('.dsp').evaluate(el=>el.scrollIntoView({block:'start'}));if(width<600){await p.locator('[data-diamond-dock-build]').waitFor({state:'visible'});assert.equal(await p.locator('[data-diamond-dock-buy]').isVisible(),false);}
 await p.close();
}
console.log('PASS desktop/390px/320px choice, keyboard, compact stats, current available prices, matching active settings, diamond handoff, native cart payload and sticky action state.');
for(const options of [{available:false},{matches:false}]) {
 const {page:p}=await pageFor(options,390);assert.equal(await p.locator('[data-diamond-choice]').count(),0);assert.equal(await p.locator('[data-diamond-build]').count(),0);assert.equal(await p.locator('[data-diamond-buy]').isVisible(),true);
 assert.equal(await p.locator('[data-diamond-buy] .atc-btn').first().isDisabled(),options.available===false);await p.close();
}
{const {page:p,posts}=await pageFor();await p.locator('[data-diamond-choice] input[value="diamond"]').check();await p.locator('[data-buy-now]').click();await p.waitForURL('**/checkout');assert.equal(posts.length,1);assert.equal(posts[0].body.id,123456);await p.close();}
{const {page:p}=await pageFor({},390,false);assert.equal(await p.locator('[data-diamond-choice]').isVisible(),false);assert.equal(await p.locator('[data-diamond-buy]').isVisible(),true);assert.equal(await p.locator('[data-diamond-build] a').isVisible(),true);await p.close();}
console.log('PASS unavailable/no-matching-setting fallback, native Buy now checkout, no-JavaScript purchase paths.');
for (const allowed of [true,false]) {
 const {page:p}=await pageFor({tracking:true,allowed});
 assert.equal(await p.evaluate(()=>tracked.length),allowed?1:0);
 await p.locator('[data-diamond-choice] input[value="diamond"]').check();
 await p.locator('[data-diamond-buy] .atc-btn').first().click();
 await p.waitForFunction(()=>document.querySelector('[data-diamond-buy] .atc-btn').textContent.includes('Added'));
 let events=await p.evaluate(()=>tracked);
 assert.deepEqual(events.map(e=>e.name),allowed?['lmny_diamond_purchase_viewed','lmny_purchase_mode_selected','lmny_diamond_added_to_cart']:[]);
 if(!allowed){await p.evaluate(()=>{window.allowed=true;document.dispatchEvent(new Event('visitorConsentCollected'));});assert.deepEqual(await p.evaluate(()=>tracked.map(e=>e.name)),['lmny_diamond_purchase_viewed']);}
 await p.evaluate(()=>{window.allowed=false;document.dispatchEvent(new Event('visitorConsentCollected'));});
 const count=await p.evaluate(()=>tracked.length);
 await p.locator('[data-diamond-choice] input[value="ring"]').check();
 assert.equal(await p.evaluate(()=>tracked.length),count);
 await p.close();
}
{
 const {page:p}=await pageFor({tracking:true});
 await p.evaluate(()=>document.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();}));
 for(const selector of ['[data-diamond-build] a','.dsp__all','.dsp__link']) await p.locator(selector).first().click();
 const events=await p.evaluate(()=>tracked);
 assert.deepEqual(events.filter(e=>e.name==='lmny_ring_builder_started').map(e=>e.data.entry_point),['main_cta','all_settings','setting_card']);
 assert.equal(events.filter(e=>e.name==='lmny_setting_selected').length,1);
 assert.equal(events.some(e=>e.name==='lmny_purchase_mode_selected'),false);
 await p.close();
}
{
 const {page:p}=await pageFor({tracking:true,failCart:true});
 await p.locator('[data-diamond-choice] input[value="diamond"]').check();
 await p.locator('[data-diamond-buy] .atc-btn').first().click();
 await p.waitForFunction(()=>!document.querySelector('[data-diamond-buy] .atc-btn').disabled);
 assert.equal(await p.evaluate(()=>tracked.some(e=>e.name==='lmny_diamond_added_to_cart')),false);
 await p.close();
}
console.log('PASS choice tracking, successful/failed cart, builder entry points, consent grant/revocation and no action replay.');
await browser.close();
