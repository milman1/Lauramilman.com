import { chromium } from 'playwright';
import { Liquid } from 'liquidjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../../../', import.meta.url).pathname;
const read = file => fs.readFileSync(root + file, 'utf8');
const copy = JSON.parse(read('locales/en.default.json').replace(/^\s*\/\*[\s\S]*?\*\//, ''));
const liquid = new Liquid();
liquid.registerFilter('t', key => key.split('.').reduce((o, k) => o?.[k], copy) || key);
liquid.registerFilter('json', value => JSON.stringify(value));
const scripts = source => [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const collectionJS = await liquid.parseAndRender(scripts(read('sections/main-collection.liquid')));
const consultJS = await liquid.parseAndRender(scripts(read('sections/private-client.liquid')));
const browser = await chromium.launch({headless: true, executablePath: process.env.LMNY_TEST_CHROMIUM || undefined, args: ['--no-sandbox']});
const card = (title, metal = 'white gold') => `<div class="product-card" data-title="${title}" data-title-lower="${title.toLowerCase()}" data-type="earrings" data-metal="${metal}" data-tags="" data-carat="1.5">${title}</div>`;
const grid = page => `<div id="productsGrid" data-page="${page}" data-pages="3" data-section="main">${page === 1 ? card('Expensive necklace') : page === 2 ? card('Marquise Studs') : card('Round Studs', 'yellow gold')}</div>`;
const fixture = `<style>.lm-pagination[hidden]{display:none!important}</style><button id="RefineOpen">Filters</button><form id="RefineForm" data-jewelry-filters><input type="checkbox" class="js-jf-style" data-client-filter value="Stud"><input type="checkbox" class="js-jf-metal" data-client-filter value="White Gold"></form><button class="js-jf-style-chip" data-style-value="Stud">Studs</button><button class="js-jf-style-chip" data-style-value="">All</button><span class="lm-collection__count">Showing 1 of 3 products</span>${grid(1)}<p id="jewelryFilterNoResults" hidden>No matches</p><button id="jewelryFilterClearBtn">Clear</button><nav class="lm-pagination">Pages</nav><script>${collectionJS}</script>`;

for (const fail of [false, true]) {
  const page = await browser.newPage();
  let requests = 0;
  await page.route('https://lmny.test/**', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('section_id')) {
      requests++;
      return route.fulfill({status: fail && url.searchParams.get('page') === '3' ? 503 : 200, contentType: 'text/html', body: grid(Number(url.searchParams.get('page')))});
    }
    return route.fulfill({contentType: 'text/html', body: fixture});
  });
  await page.goto('https://lmny.test/collections/jewelry?sort_by=price-descending&filter.v.price.lte=5000');
  assert.equal(requests, 0);
  await page.getByRole('button', {name: 'Studs', exact: true}).click();
  if (fail) {
    await page.getByText(copy.conversion.filters_failed).waitFor();
    assert.equal(await page.locator('#jewelryFilterNoResults').isVisible(), false);
    assert.equal(await page.locator('#productsGrid .product-card:visible').innerText(), 'Expensive necklace');
  } else {
    await page.getByText('Showing 2 of 3 products', {exact: true}).waitFor();
    assert.deepEqual(await page.locator('#productsGrid .product-card:visible').allTextContents(), ['Marquise Studs', 'Round Studs']);
    assert.equal(await page.locator('.lm-pagination').isVisible(), false);
    await page.locator('.js-jf-metal').check();
    await page.getByText('Showing 1 of 3 products', {exact: true}).waitFor();
    assert.equal(await page.locator('#productsGrid .product-card:visible').innerText(), 'Marquise Studs');
    assert.equal(new URL(page.url()).searchParams.get('filter.v.price.lte'), '5000');
    await page.getByRole('button', {name: 'Clear', exact: true}).click();
    assert.equal(await page.locator('#productsGrid .product-card').count(), 1);
    assert.equal(await page.locator('.lm-pagination').isVisible(), true);
    assert.equal(requests, 2);
  }
  await page.close();
}
console.log('PASS full-collection filters, combined metal/style, native price preservation, clear/reset and failed-page handling.');

for (const band of [true, false]) {
  const page = await browser.newPage();
  let mutation;
  const lines = [['setting', false], ['diamond', false], ['band-a', true], ['band-b', true]];
  const html = `<div class="cart-page"><form>${lines.map(([key, isBand]) => `<div data-key="${key}" data-ring-group="group" ${isBand ? 'data-ring-band="true"' : ''}><button data-remove-key="${key}">Remove ${key}</button></div>`).join('')}<div data-key="unrelated"></div><p data-cart-error hidden>Error</p></form></div><script type="application/json" data-ring-cart-config>{"root":"/"}</script><script>${read('assets/ring-builder-cart.js')}</script>`;
  await page.route('https://lmny.test/**', route => {
    if (route.request().method() === 'POST') { mutation = {url: route.request().url(), body: route.request().postDataJSON()}; return route.fulfill({contentType:'application/json', body:'{"items":[]}'}); }
    return route.fulfill({contentType:'text/html', body:html});
  });
  await page.goto('https://lmny.test/cart');
  await page.locator(`[data-remove-key="${band ? 'band-a' : 'setting'}"]`).click();
  await page.waitForRequest(r => r.method() === 'GET' && r.url().endsWith('/cart'));
  if (band) assert.deepEqual(mutation.body, {id:'band-a', quantity:0});
  else assert.deepEqual(mutation.body, {updates:{setting:0,diamond:0,'band-a':0,'band-b':0}});
  assert.equal(JSON.stringify(mutation.body).includes('unrelated'), false);
  await page.close();
}
console.log('PASS removing one band preserves the ring, second band and unrelated cart items; core removal remains grouped.');

{
  const page = await browser.newPage();
  const link = 'https://lmny.test/pages/ring-builder?setting=setting&diamond=diamond#build=' + encodeURIComponent(JSON.stringify({v:1,engraving:'A & B ♥'}));
  const consult = `<h1 class="lm-consult__title"></h1><p class="lm-consult__intro"></p><form id="LmConsultContact"><select id="ConsultInterest"><option>An engagement ring or wedding bands</option></select><textarea id="ConsultMessage"></textarea><input id="ConsultRingBuild" disabled><p id="ConsultBuildNotice" hidden>Attached</p></form><script>${consultJS}</script>`;
  await page.route('https://lmny.test/**', r => r.fulfill({contentType:'text/html',body:consult}));
  await page.goto('https://lmny.test/pages/private-clients?interest=ring#ring='+encodeURIComponent(link));
  assert.equal(await page.locator('#ConsultRingBuild').inputValue(), link);
  assert.equal(await page.locator('#ConsultRingBuild').isEnabled(), true);
  assert.equal(await page.locator('#ConsultBuildNotice').isVisible(), true);
  await page.goto('https://lmny.test/pages/private-clients?interest=ring#ring='+encodeURIComponent(link.replace('lmny.test','unrelated.test')));
  assert.equal(await page.locator('#ConsultRingBuild').isEnabled(), false);
  await page.close();
}
console.log('PASS full-build consultation attachment, Unicode preservation and foreign-link rejection.');
await browser.close();
