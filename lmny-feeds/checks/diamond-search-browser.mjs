import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

// Execute the production browser script against controlled inventory; no cart writes.
const script = readFileSync(new URL('../../assets/diamond-storefront.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true });
let passed = 0;
try {
  for (const width of [390, 1440]) {
    console.log('viewport', width);
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.setDefaultTimeout(5000);
    const requests = [];
    const cartWrites = [];
    let roundRequested = false;
    await page.route('https://lmny.test/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/inventory') {
        requests.push(url);
        const shapes = url.searchParams.get('shapes');
        if (shapes === 'Round') { roundRequested = true; await new Promise(resolve => setTimeout(resolve, 1500)); }
        await route.fulfill({ json: { total: 1, total_pages: 1, stones: [{
          kind: 'lab', stock_ref: shapes === 'Round' ? 'round' : 'oval',
          shape: shapes || 'Oval', carat: 2.02, color: 'F', clarity: 'VS1',
          lab: 'IGI', retail_usd: 665.25, image_urls: [],
        }] } });
      } else if (url.pathname.startsWith('/products/') && url.pathname.endsWith('.js')) {
        await route.fulfill({ json: { variants: [{ id: 1, available: false, price: 66525 }] } });
      } else if (url.pathname === '/cart/add.js') {
        cartWrites.push(route.request());
        await route.fulfill({ json: {} });
      } else {
        await route.fulfill({ contentType: 'text/html', body: `<div id="lm-diamond-api" data-api-base="https://lmny.test/inventory" data-currency="USD">
          <form id="DiamondFilterForm">
            <label class="lm-shape"><input type="checkbox" name="shape" value="Oval"></label>
            <label class="lm-shape"><input type="checkbox" name="shape" value="Round"></label>
            <div data-range-key="carat"><input data-range-min><input data-range-max></div>
            <button type="submit">View Diamonds</button><a class="lm-dfilter__reset">Reset all</a>
          </form><div id="lm-diamond-results"></div><div id="lm-diamond-count"></div>
          <div id="lm-diamond-pager"></div><select id="lm-diamond-sort"><option value="price_asc">Price</option></select>
          </div>` });
      }
    });
    await page.goto('https://lmny.test/collections/lab-grown-diamonds?shape=Oval&min_carat=2&max_carat=2.49');
    await page.addScriptTag({ content: script });
    await page.waitForSelector('[data-stock="oval"]', { state: 'attached', timeout: 10000 });
    assert.equal(requests[0].searchParams.get('shapes'), 'Oval');
    assert.equal(requests[0].searchParams.get('min_carat'), '2');
    assert.equal(requests[0].searchParams.get('max_carat'), '2.49');
    assert.match(await page.locator('.product-card__price').textContent(), /665\.25/);
    passed += 4;
    console.log('hydration and price passed');
    await page.locator('[data-add-handle]').evaluate(el => el.click());
    await page.waitForFunction(() => document.querySelector('[data-add-handle]').textContent.includes('cannot be added'));
    assert.equal(cartWrites.length, 0);
    passed++;
    console.log('availability passed');
    // Submit a slow Round request, then Oval. The late Round response must not win.
    await page.locator('input[value="Oval"]').evaluate(el => { el.checked = false; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.locator('input[value="Round"]').evaluate(el => { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.locator('button[type="submit"]').evaluate(el => el.click());
    await page.waitForFunction(() => document.querySelector('#lm-diamond-results').textContent.includes('Loading'));
    assert.ok(roundRequested, 'Round request was issued: ' + requests.map(r => r.search).join(';')); 
    await page.locator('input[value="Round"]').evaluate(el => { el.checked = false; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.locator('input[value="Oval"]').evaluate(el => { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.locator('button[type="submit"]').evaluate(el => el.click());
    await page.waitForSelector('[data-stock="oval"]', { state: 'attached', timeout: 10000 });
    await page.waitForTimeout(1700);
    assert.equal(await page.locator('[data-stock="round"]').count(), 0);
    assert.equal(new URL(page.url()).searchParams.get('shapes'), 'Oval');
    passed += 2;
    await page.locator('.lm-dfilter__reset').evaluate(el => el.click());
    await page.waitForSelector('[data-stock="oval"]', { state: 'attached', timeout: 10000 });
    assert.equal(requests.at(-1).searchParams.get('shapes'), null);
    assert.equal(requests.at(-1).searchParams.get('min_carat'), null);
    passed += 2;
    await page.close();
  }
  console.log(`${passed} browser assertions passed across mobile and desktop`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
