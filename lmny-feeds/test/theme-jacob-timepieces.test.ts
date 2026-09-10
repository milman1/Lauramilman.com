import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Jacob & Co. Timepieces nav', () => {
  it('lists Jacob & Co. on a watch-only collection handle', () => {
    const header = readFileSync(new URL('../../sections/header.liquid', import.meta.url), 'utf8');
    expect(header).toContain('/collections/jacob-co-watches');
    expect(header).toContain('Jacob &amp; Co.');
  });
});
