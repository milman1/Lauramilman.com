// Read-only full redirect audit and exact tracking migration plan. Never applies writes.
import {mkdir, writeFile} from 'node:fs/promises';
import {ShopifyClient, exchangeClientCredentials} from '../src/shopify.js';
import {readRedirects, trackedDiamondTarget} from '../src/diamondRedirectTracking.mjs';
import {checkRedirect} from '../src/redirectHealth.mjs';

async function main() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain || !/^[a-z0-9-]+\.myshopify\.com$/.test(domain)) throw new Error('Store domain required');
  const token = process.env.SHOPIFY_ADMIN_TOKEN || (await exchangeClientCredentials(
    domain, process.env.SHOPIFY_CLIENT_ID || '', process.env.SHOPIFY_CLIENT_SECRET || '',
  )).token;
  const client = new ShopifyClient(domain,token);
  const rows = (await readRedirects((query,variables) => client.gql(query,variables)))
    .filter(r => /^\/products\/(lg|nd)-[a-z0-9-]{1,96}$/.test(r.path));
  const plan = rows.map(r => ({id:r.id,path:r.path,before:r.target,
    after:trackedDiamondTarget(r.path.slice('/products/'.length),r.target)})).filter(r => r.before !== r.after);
  await mkdir('out',{recursive:true});
  await writeFile('out/diamond-redirect-tracking-plan.json',JSON.stringify({readOnly:true,plan},null,2));
  const results: Array<{path:string;status:string}> = [];
  let index=0;
  await Promise.all(Array.from({length:4},async () => {
    while(index<rows.length) results.push(await checkRedirect(rows[index++]!));
  }));
  const failures=results.filter(r=>!['redirect_ok','live_product'].includes(r.status));
  await writeFile('out/diamond-redirect-health.json',JSON.stringify({checked:rows.length,failures,results},null,2));
  console.log(JSON.stringify({checked:rows.length,failures:failures.length,trackingUpdatesPlanned:plan.length}));
  if(failures.length) process.exitCode=1;
}
main().catch(()=>{ console.error('Diamond redirect audit failed; inspect the workflow stage. No credentials logged.'); process.exitCode=1; });
