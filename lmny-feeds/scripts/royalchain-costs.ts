/**
 * Read wholesale cost for a Royal Chain shortlist from behind the trade
 * login. Runs in GitHub Actions (the sandbox cannot reach the site);
 * credentials come from repository secrets and never leave the runner.
 *
 *   npx tsx scripts/royalchain-costs.ts --shortlist=../docs/suppliers/royal-chain-shortlist-2026-09.csv
 *   npx tsx scripts/royalchain-costs.ts --shortlist=... --dry-run   # log in, read one item, write nothing else
 *
 * Env: ROYALCHAIN_USERNAME, ROYALCHAIN_PASSWORD, optional ROYALCHAIN_BASE_URL.
 * Output: out/supplier-costs.csv (item_number,url,cost,retail,price_text,lengths,error)
 *         out/royalchain-*.png screenshots on any failure, for debugging.
 *
 * No Shopify writes. Product creation is a separate, reviewed step
 * (AGENTS.md recipe H).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';
import { supplierRetailFromCost } from '../config/pricing.js';

const OUT_DIR = 'out';

interface Row {
  item_number: string;
  url: string;
  name: string;
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes('--dry-run');
  const shortlistArg = argv.find((a) => a.startsWith('--shortlist='));
  if (!shortlistArg) throw new Error('Pass --shortlist=<path to csv>');
  return { dryRun, shortlist: shortlistArg.slice('--shortlist='.length) };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/** Minimal CSV parser: handles quoted fields with commas. */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const split = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i]!;
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  const header = split(lines[0]!);
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [header[i] ?? `col${i}`, v])));
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function parseMoney(text: string): number | null {
  const m = text.replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function login(page: Page, baseUrl: string): Promise<void> {
  await page.goto(`${baseUrl}/customer/account/login/`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="login[username]"]', requireEnv('ROYALCHAIN_USERNAME'));
  await page.fill('input[name="login[password]"]', requireEnv('ROYALCHAIN_PASSWORD'));
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click('form.account-form__form button[type="submit"], form[action*="loginPost"] button[type="submit"]'),
  ]);
  const body = (await page.textContent('body')) ?? '';
  const loggedIn = /sign out|log out|my account|welcome/i.test(body) && !/invalid login|incorrect|captcha/i.test(body);
  if (!loggedIn) {
    await page.screenshot({ path: `${OUT_DIR}/royalchain-login-failed.png`, fullPage: true });
    throw new Error('Login did not succeed (see out/royalchain-login-failed.png). CAPTCHA or MFA needs a person; see AGENTS.md recipe H step 3.');
  }
}

async function readItem(page: Page, row: Row): Promise<{ cost: number | null; priceText: string; lengths: string; error: string }> {
  try {
    await page.goto(row.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const priceSelectors = [
      '.product-info-price [data-price-type="finalPrice"] .price',
      '.product-info-price .price-box .price',
      '.price-box .price',
      '[data-price-amount]',
    ];
    let priceText = '';
    for (const sel of priceSelectors) {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0) {
        priceText = ((await el.getAttribute('data-price-amount')) ?? (await el.textContent()) ?? '').trim();
        if (priceText) break;
      }
    }
    if (!priceText) {
      const body = (await page.textContent('body')) ?? '';
      if (/login to view price/i.test(body)) throw new Error('still gated: "Login To View Price"');
    }
    const lengths = (await page.locator('select[name^="super_attribute"] option, .swatch-option').allTextContents())
      .map((t) => t.trim())
      .filter((t) => t && !/choose/i.test(t))
      .join(';');
    const cost = parseMoney(priceText);
    if (cost === null) {
      await page.screenshot({ path: `${OUT_DIR}/royalchain-${row.item_number}.png`, fullPage: true });
      return { cost: null, priceText, lengths, error: 'no price parsed' };
    }
    return { cost, priceText, lengths, error: '' };
  } catch (err) {
    return { cost: null, priceText: '', lengths: '', error: err instanceof Error ? err.message : String(err) };
  }
}

async function main(): Promise<void> {
  const { dryRun, shortlist } = parseArgs(process.argv.slice(2));
  const baseUrl = (process.env.ROYALCHAIN_BASE_URL || 'https://www.royalchain.com').replace(/\/+$/, '');
  const rows = parseCsv(await readFile(shortlist, 'utf8')).map((r) => ({
    item_number: r.item_number ?? '',
    url: r.url ?? '',
    name: r.name ?? '',
  })).filter((r) => r.url);
  const work = dryRun ? rows.slice(0, 1) : rows;
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Royal Chain costs: ${work.length} item(s) (${dryRun ? 'DRY RUN' : 'FULL'})`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) LMNY-SupplierIntake/1.0' });
  const page = await context.newPage();
  const lines = ['item_number,url,cost,retail,price_text,lengths,error'];
  try {
    await login(page, baseUrl);
    console.log('Logged in');
    for (const row of work) {
      const r = await readItem(page, row);
      const retail = r.cost !== null ? supplierRetailFromCost(r.cost) : '';
      lines.push([row.item_number, row.url, r.cost ?? '', retail, r.priceText, r.lengths, r.error].map((v) => csvEscape(String(v))).join(','));
      console.log(`${row.item_number}: ${r.cost !== null ? `cost $${r.cost} -> retail $${retail}` : `no cost (${r.error})`}`);
    }
  } finally {
    await browser.close();
  }
  await writeFile(`${OUT_DIR}/supplier-costs.csv`, lines.join('\n') + '\n');
  const missing = lines.slice(1).filter((l) => l.split(',')[2] === '').length;
  console.log(`Wrote out/supplier-costs.csv (${lines.length - 1} rows, ${missing} without a cost)`);
  if (missing > 0 && !dryRun) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exitCode = 1;
});
