import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('product gallery video-first', () => {
  const mainProduct = themeFile('sections/main-product.liquid');
  const listingDoc = themeFile('docs/seo/listing-seo-geo.md');

  it('sorts Shopify video media ahead of stills', () => {
    expect(mainProduct).toContain("where: 'media_type', 'video'");
    expect(mainProduct).toContain("where: 'media_type', 'external_video'");
    expect(mainProduct).toContain(
      'assign gallery_media = pdp_videos | concat: pdp_ext_videos | concat: pdp_images | concat: pdp_models',
    );
    expect(mainProduct).toContain('for media in gallery_media');
    expect(mainProduct).not.toMatch(/for media in product\.media\b/);
  });

  it('hoists a description-embedded video into the gallery', () => {
    expect(mainProduct).toContain('is-pending-video-hoist');
    expect(mainProduct).toContain('function hoistDescriptionVideo');
    expect(mainProduct).toContain('hoistDescriptionVideo(gallery)');
    expect(mainProduct).toContain('id="PdpDescription"');
  });

  it('tells agents not to paste players into description HTML', () => {
    expect(listingDoc).toContain('Never paste');
    expect(listingDoc).toContain('<video>');
    expect(listingDoc).toContain('scorecard');
    expect(listingDoc).toContain('GEO');
    expect(listingDoc).toContain(
      'lab-grown-round-diamond-station-bracelet-065-ct-14k-yellow-gold-bc2423',
    );
  });
});
