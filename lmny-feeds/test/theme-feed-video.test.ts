import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function themeFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('supplier video played by link on estate pages', () => {
  const section = themeFile('sections/main-product.liquid');
  const schema = themeFile('snippets/structured-data-product.liquid');

  it('plays backvault_feed.video first, only when the product has no video of its own', () => {
    expect(section).toContain('assign feed_video = product.metafields.backvault_feed.video.value');
    expect(section).toContain('if pdp_videos.size == 0 and pdp_ext_videos.size == 0 and feed_video.sources.size > 0');
    const slide = section.indexOf('data-feed-video>');
    const loop = section.indexOf('{%- for media in gallery_media -%}');
    expect(slide).toBeGreaterThan(-1);
    expect(slide).toBeLessThan(loop);
    expect(section).toContain('data-media-index="{{ forloop.index0 | plus: media_offset }}"');
    expect(section).toContain('data-thumb-index="{{ forloop.index0 | plus: media_offset }}"');
    expect(section).toContain('{%- if gallery_count > 1 -%}');
  });

  it('serves phones the smaller file and hides a video whose file is gone', () => {
    expect(section).toContain('media="(min-width: 990px)"');
    expect(section).toContain('function guardFeedVideo()');
    expect(section).toContain("addEventListener('error', drop)");
    // Not read at parse time: browsers report NETWORK_NO_SOURCE while choosing a source.
    expect(section).toContain('video.networkState === 3 && !video.currentSrc');
    expect(section).toContain("window.addEventListener('load'");
  });

  it('describes the product video to Google as a VideoObject, stored or by link', () => {
    expect(schema).toContain('"@type": "VideoObject"');
    expect(schema).toContain("product.media | where: 'media_type', 'video' | first");
    expect(schema).toContain('product.metafields.backvault_feed.video.value');
    expect(schema).toContain('{%- if vo_content != blank and vo_thumb != blank -%}');
    // Stored-media URLs come protocol-relative; Google needs absolute ones.
    expect(schema).toContain("assign vo_content = vo_content | prepend: 'https:'");
    for (const field of ['"thumbnailUrl"', '"uploadDate"', '"contentUrl"', '"duration"', '"description"', '"name"']) {
      expect(schema).toContain(field);
    }
  });
});
