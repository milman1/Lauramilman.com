import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('FAQPage markup on Journal articles (2026-10-29)', () => {
  const section = read('sections/main-article.liquid');

  it('builds FAQPage from custom.guide_faq', () => {
    expect(section).toContain('"@type": "FAQPage"');
    expect(section).toContain('article.metafields.custom.guide_faq.value');
  });

  it('marks up a question only while the article body still shows it', () => {
    const checks = section.match(/article\.content contains faq\.question/g) ?? [];
    expect(checks.length).toBe(2);
  });
});
