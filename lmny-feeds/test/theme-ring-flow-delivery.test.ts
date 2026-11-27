import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const locale = JSON.parse(readFileSync(new URL('../../locales/en.default.json', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')) as { ring_flow: Record<string, string> };

describe('ring builder delivery line', () => {
  it('uses the merchant lead times for a built ring (2026-11-26)', () => {
    expect(locale.ring_flow.fulfillment).toMatch(/^Your ring is made and set in about a week, then delivered free and insured in the U\.S\. in about 1–2 business days\./);
    expect(locale.ring_flow.fulfillment).not.toContain('2–3 business days');
  });
});
