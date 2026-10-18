// Read-only sample audit: Shopify Admin variant price vs public JSON-LD offers.
// Do not print secrets or modify Shopify. Fail when an observable mismatch occurs.
const domain=process.env.SHOPIFY_STORE_DOMAIN;
const token=process.env.SHOPIFY_ADMIN_TOKEN;
const client=process.env.SHOPIFY_CLIENT_ID;
const secret=process.env.SHOPIFY_CLIENT_SECRET;
if(!domain || !/^[a-z0-9-]+\\.myshopify\\.com$/i.test(domain)) throw Error('Valid Shopify domain required');
let auth=token;
if(!auth){
  if(!client||!secret) throw Error('Shopify authentication missing');
  const res=await fetch('https://'+domain+'/admin/oauth/access_token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:client,client_secret:secret})});
  if(!res.ok) throw Error('Shopify token request failed: '+res.status);
  auth=(await res.json()).access_token;
}
const handles=['lg-100747595283','lg-100759672150','lg-100752021932','lg-100760317152','lg-916637','lg-877217','lg-820931'];
const query=`query($query:String!){products(first:1,query:$query){nodes{handle status onlineStoreUrl variants(first:1){nodes{price availableForSale}}}}}`;
let mismatches=0;
for(const handle of handles){
  const res=await fetch('https://'+domain+'/admin/api/2026-10/graphql.json',{method:'POST',headers:{'content-type':'application/json','X-Shopify-Access-Token':auth},body:JSON.stringify({query,variables:{query:'handle:'+handle}})});
  if(!res.ok) throw Error('Shopify API HTTP '+res.status);
  const json=await res.json();if(json.errors?.length)throw Error('Shopify GraphQL query failed');
  const p=json.data?.products?.nodes?.find(x=>x.handle===handle);
  if(!p){console.log(handle+' missing in Shopify');mismatches++;continue;}
  const price=Number(p.variants.nodes[0]?.price);
  const url=p.onlineStoreUrl;
  if(!url){console.log(handle+' missing storefront URL');mismatches++;continue;}
  let html;try{const response=await fetch(url,{headers:{'User-Agent':'LMNYPriceAudit/1.0'},signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status);html=await response.text()}catch(e){console.log(handle+' public page inaccessible: '+e.message);mismatches++;continue;}
  const blocks=[...html.matchAll(/<script[^>]*type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi)].flatMap(m=>{try{const x=JSON.parse(m[1]);return Array.isArray(x)?x:[x]}catch{return []}});
  const products=blocks.flatMap(x=>x['@graph']||[x]).filter(x=>{const t=x['@type'];return t==='Product'||(Array.isArray(t)&&t.includes('Product'))});
  const offers=products.flatMap(x=>Array.isArray(x.offers)?x.offers:[x.offers]).filter(Boolean);
  const prices=offers.map(x=>Number(x.price||x.lowPrice)).filter(Number.isFinite);
  const match=prices.some(x=>Math.abs(x-price)<0.011);
  console.log(JSON.stringify({handle,shopifyPrice:price,publicOfferPrices:prices,availableForSale:p.variants.nodes[0]?.availableForSale,match}));
  if(!match)mismatches++;
}
if(mismatches){console.error(mismatches+' sample SKU(s) need review');process.exitCode=1;}
