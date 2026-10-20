import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const programFiles = [
  'sections/creator-program.liquid',
  'templates/page.creator-program.json',
  'docs/marketing/creator-program.md',
];

describe('influencer program', () => {
  it('offers 10% on loose lab-grown diamonds, lab-grown diamond jewelry, and gold jewelry', () => {
    const page = themeFile('templates/page.creator-program.json');
    const section = themeFile('sections/creator-program.liquid');
    const setup = themeFile('SHOPIFY_SETUP.md');
    const categories = 'loose lab-grown diamonds, lab-grown diamond jewelry, and gold jewelry';

    expect(page).toContain(`10% off ${categories}, including chains, rings, and bracelets`);
    expect(page).toContain(`You earn 10% of what your audience pays for ${categories}`);
    expect(page).toContain('You can choose one piece from loose lab-grown diamonds, lab-grown diamond jewelry, or gold jewelry');
    expect(page).toContain('Choose one piece from those three');
    expect(page).not.toContain('watches, style, or New York');
    expect(page).not.toContain('gold chains');
    expect(page).not.toContain('Loose lab-grown diamonds stay in the store');
    expect(page).toContain('does not combine with LMNYWELCOME');
    expect(page).toContain('after the 7-day return window closes');
    expect(page).toContain('until it reaches $50');
    expect(page).toContain('@laurasgemsnyc');
    expect(page).toContain('hello@lauramilman.com');
    expect(page).toContain('There is no follower minimum');

    expect(section).toContain("{{ routes.collections_url }}/lab-grown-diamonds");
    expect(section).toContain("{{ routes.collections_url }}/lab-grown-diamond-jewelry");
    expect(section).toContain("{{ routes.collections_url }}/gold-jewelry");
    expect(section).not.toContain("{{ routes.collections_url }}/chains");
    expect(section).toContain('https://www.instagram.com/laurasgemsnyc');
    expect(section).toContain('creator-applicant');
    expect(section).toContain('name="contact[instagram]"');
    expect(section).toContain('name="contact[body]"');
    expect(section).toContain('name="contact[agreed]"');

    expect(setup).toContain('lab-grown-diamond-jewelry');
    expect(setup).toContain('lab-grown-diamonds');
    expect(setup).toContain('gold-jewelry');
    expect(setup).toContain('Each accepted creator gets their own code');
  });

  it('links the program from the house footer and keeps supplier names and cost off the page', () => {
    const footer = themeFile('sections/footer.liquid');
    expect(footer).toContain('href="/pages/influencer-program"');
    expect(footer).toContain('Influencer program');

    for (const path of programFiles) {
      const text = themeFile(path);
      expect(text, path).not.toMatch(/back[\s-]?vault|thebackvault|royal\s*chain|peaceful diamonds|bucherer|exquisite timepieces/i);
      expect(text, path).not.toMatch(/\bwholesale\b|\bcost per item\b|\$app\.cost/i);
      expect(text, path).not.toMatch(/14-day returns|within 14 days of delivery/i);
    }
  });
});
