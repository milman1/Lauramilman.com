import { describe, expect, it } from 'vitest';
import {
  dropJpgExtraWhenJpegPresent,
  enrichWatchGalleries,
  expandJpgExtrasToJpeg,
  mergeMediaUrls,
  needsDnaGallery,
  parseDnaGalleryHtml,
  preferDetailShots,
  watchGalleryStats,
} from '../src/dnaGallery.js';
import { handleFor } from '../src/product.js';
import { labStone, watch } from './fixtures.js';

const DNA_10005 = `
<div class="images-carousel">
  <img id="img_0" src="https://dnalinks.in/10005.jpg">
  <video autoplay muted loop>
    <source src="https://dnalinks.in/10005.mp4" type="video/mp4">
  </video>
  <img id="img_1" src="https://dnalinks.in/10005_1.jpg">
  <img id="img_2" src="https://dnalinks.in/10005_2.jpg">
</div>
<div class="images-carousel-nav">
  <img src="https://dnalinks.in/10005.jpg">
  <img src="https://dnalinks.in/10005_1.jpg">
  <img src="https://dnalinks.in/10005_2.jpg">
</div>
`;

const DNA_T3743 = `
<div class="images-carousel">
  <img id="img_0" src="https://dnalinks.in/t3743.jpg">
  <img id="img_1" src="https://dnalinks.in/t3743_1.jpeg">
  <img id="img_2" src="https://dnalinks.in/t3743_2.jpeg">
  <img id="img_3" src="https://dnalinks.in/t3743_3.jpeg">
  <video><source src="https://dnalinks.in/t3743_1.mp4" type="video/mp4"></video>
</div>
<script src="https://dna.dnalinks.in/assets/js/watch_dna.js"></script>
`;

const JPG_EXTRAS = [
  'https://img.belgiumdia.com/Watch/T3741.jpg',
  'https://img.belgiumdia.com/Watch/T3741_1.jpg',
  'https://img.belgiumdia.com/Watch/T3741_2.jpg',
];

describe('parseDnaGalleryHtml', () => {
  it('collects stills and the mp4, skipping duplicate nav thumbs', () => {
    expect(parseDnaGalleryHtml(DNA_10005)).toEqual({
      images: [
        'https://dnalinks.in/10005.jpg',
        'https://dnalinks.in/10005_1.jpg',
        'https://dnalinks.in/10005_2.jpg',
      ],
      videos: ['https://dnalinks.in/10005.mp4'],
    });
  });

  it('keeps .jpeg extras the API ImageLink1 .jpg field misses', () => {
    const { images, videos } = parseDnaGalleryHtml(DNA_T3743);
    expect(images).toEqual([
      'https://dnalinks.in/t3743.jpg',
      'https://dnalinks.in/t3743_1.jpeg',
      'https://dnalinks.in/t3743_2.jpeg',
      'https://dnalinks.in/t3743_3.jpeg',
    ]);
    expect(videos).toEqual(['https://dnalinks.in/t3743_1.mp4']);
  });

  it('ignores chrome assets and relative paths', () => {
    const html = `<img src="/assets/css/watch_dna.css"><img src="logo.svg"><img src="https://dnalinks.in/x.jpg">`;
    expect(parseDnaGalleryHtml(html).images).toEqual(['https://dnalinks.in/x.jpg']);
  });
});

describe('preferDetailShots', () => {
  it('puts numbered angles ahead of the catalog thumb', () => {
    expect(
      preferDetailShots([
        'https://dnalinks.in/T3743.jpg',
        'https://dnalinks.in/T3743_1.jpeg',
        'https://dnalinks.in/T3743_2.jpeg',
      ]),
    ).toEqual([
      'https://dnalinks.in/T3743_1.jpeg',
      'https://dnalinks.in/T3743_2.jpeg',
      'https://dnalinks.in/T3743.jpg',
    ]);
  });
});

describe('mergeMediaUrls', () => {
  it('dedupes the catalog shot across https case and keeps new extras', () => {
    expect(
      mergeMediaUrls(
        ['https://dnalinks.in/T3743.jpg'],
        ['https://dnalinks.in/t3743.jpg', 'https://dnalinks.in/t3743_1.jpeg'],
      ),
    ).toEqual(['https://dnalinks.in/t3743_1.jpeg', 'https://dnalinks.in/T3743.jpg']);
  });
});

describe('expandJpgExtrasToJpeg / dropJpgExtraWhenJpegPresent', () => {
  it('adds the .jpeg sibling and drops the 404 .jpg twin', () => {
    expect(expandJpgExtrasToJpeg(JPG_EXTRAS)).toEqual([
      'https://img.belgiumdia.com/Watch/T3741_1.jpeg',
      'https://img.belgiumdia.com/Watch/T3741_2.jpeg',
      'https://img.belgiumdia.com/Watch/T3741.jpg',
    ]);
  });

  it('leaves a catalog-only url alone', () => {
    expect(expandJpgExtrasToJpeg(['https://img.belgiumdia.com/Watch/RW3102.jpg'])).toEqual([
      'https://img.belgiumdia.com/Watch/RW3102.jpg',
    ]);
  });

  it('drops .jpg extras only when the matching .jpeg is already in the list', () => {
    expect(
      dropJpgExtraWhenJpegPresent([
        'https://img.belgiumdia.com/Watch/T3743.jpg',
        'https://img.belgiumdia.com/Watch/T3743_1.jpg',
        'https://dnalinks.in/t3743_1.jpeg',
      ]),
    ).toEqual(['https://img.belgiumdia.com/Watch/T3743.jpg', 'https://dnalinks.in/t3743_1.jpeg']);
  });
});

describe('needsDnaGallery', () => {
  it('is true when the feed lists fewer than 3 photos', () => {
    expect(needsDnaGallery(['https://dnalinks.in/T3743.jpg'])).toBe(true);
  });

  it('is true when the feed is padded with numbered .jpg extras (the 404 pattern)', () => {
    expect(needsDnaGallery(JPG_EXTRAS)).toBe(true);
  });

  it('is false when the feed already has 3+ non-jpg extras', () => {
    expect(
      needsDnaGallery([
        'https://dnalinks.in/T3743_1.jpeg',
        'https://dnalinks.in/T3743_2.jpeg',
        'https://dnalinks.in/T3743.jpg',
      ]),
    ).toBe(false);
  });

  it('follows Shopify READY count when the catalog is provided', () => {
    expect(needsDnaGallery(JPG_EXTRAS, 1)).toBe(true);
    expect(needsDnaGallery(['https://dnalinks.in/T3743.jpg'], 3)).toBe(false);
  });
});

describe('watchGalleryStats', () => {
  it('counts publishable watches by photo count and samples 1-photo refs', () => {
    const items = [
      labStone(),
      watch({ stockRef: 'RW3102', imageUrls: ['https://dnalinks.in/RW3102.jpg'] }),
      watch({ stockRef: 'T3743', imageUrls: ['https://dnalinks.in/T3743.jpg'] }),
      watch({
        stockRef: 'T3741',
        imageUrls: ['https://dnalinks.in/T3741.jpg', 'https://dnalinks.in/T3741_1.jpeg'],
      }),
      watch({
        stockRef: '10005',
        imageUrls: [
          'https://dnalinks.in/10005.jpg',
          'https://dnalinks.in/10005_1.jpg',
          'https://dnalinks.in/10005_2.jpg',
        ],
      }),
      watch({ stockRef: 'EMPTY', imageUrls: [] }),
    ];
    expect(watchGalleryStats(items)).toEqual({
      none: 1,
      one: 2,
      two: 1,
      threePlus: 1,
      onePhotoRefs: ['RW3102', 'T3743'],
    });
  });
});

describe('enrichWatchGalleries', () => {
  it('fills a one-photo watch from the DNA viewer', async () => {
    const item = watch({
      stockRef: 'T3743',
      imageUrls: ['https://dnalinks.in/T3743.jpg'],
      videoUrls: [],
    });
    const pages = new Map([['https://dna.dnalinks.in/w/T3743', DNA_T3743]]);
    const result = await enrichWatchGalleries([item], async (url) => pages.get(url) ?? null);
    expect(result).toEqual({ enriched: 1, extraImages: 3, extraVideos: 1, aborted: false });
    expect(item.imageUrls).toEqual([
      'https://dnalinks.in/t3743_1.jpeg',
      'https://dnalinks.in/t3743_2.jpeg',
      'https://dnalinks.in/t3743_3.jpeg',
      'https://dnalinks.in/T3743.jpg',
    ]);
    expect(item.videoUrls).toEqual(['https://dnalinks.in/t3743_1.mp4']);
  });

  it('does not refetch a watch Shopify already shows with a full gallery', async () => {
    const item = watch({
      stockRef: '10005',
      imageUrls: [
        'https://dnalinks.in/10005.jpg',
        'https://dnalinks.in/10005_1.jpg',
        'https://dnalinks.in/10005_2.jpg',
      ],
    });
    let calls = 0;
    await enrichWatchGalleries([item], {
      fetchHtml: async () => {
        calls += 1;
        return DNA_10005;
      },
      shopifyImageCountByHandle: new Map([[handleFor(item), 3]]),
    });
    expect(calls).toBe(0);
    expect(item.imageUrls).toEqual([
      'https://dnalinks.in/10005.jpg',
      'https://dnalinks.in/10005_1.jpg',
      'https://dnalinks.in/10005_2.jpg',
    ]);
  });

  it('still fetches DNA when Shopify has one photo even if the API listed three .jpg extras', async () => {
    const item = watch({
      stockRef: 'T3741',
      imageUrls: JPG_EXTRAS,
      videoUrls: [],
    });
    const html = `
      <img src="https://dnalinks.in/t3741.jpg">
      <img src="https://dnalinks.in/t3741_1.jpeg">
      <img src="https://dnalinks.in/t3741_2.jpeg">
    `;
    let calls = 0;
    const result = await enrichWatchGalleries([item], {
      fetchHtml: async () => {
        calls += 1;
        return html;
      },
      shopifyImageCountByHandle: new Map([[handleFor(item), 1]]),
    });
    expect(calls).toBe(1);
    expect(result.aborted).toBe(false);
    expect(result.extraImages).toBeGreaterThan(0);
    expect(item.imageUrls.some((u) => u.endsWith('_1.jpeg'))).toBe(true);
    expect(item.imageUrls.some((u) => u.endsWith('_1.jpg'))).toBe(false);
  });

  it('treats a watch missing from the catalog as Shopify-short', async () => {
    const item = watch({ stockRef: 'NEW1', imageUrls: JPG_EXTRAS, videoUrls: [] });
    let calls = 0;
    await enrichWatchGalleries([item], {
      fetchHtml: async () => {
        calls += 1;
        return DNA_T3743;
      },
      shopifyImageCountByHandle: new Map(),
    });
    expect(calls).toBe(1);
  });

  it('falls back to .jpeg siblings when DNA is down', async () => {
    const item = watch({ stockRef: 'T3741', imageUrls: JPG_EXTRAS, videoUrls: [] });
    const result = await enrichWatchGalleries([item], async () => null);
    expect(result.enriched).toBe(1);
    expect(result.aborted).toBe(false);
    expect(item.imageUrls).toEqual([
      'https://img.belgiumdia.com/Watch/T3741_1.jpeg',
      'https://img.belgiumdia.com/Watch/T3741_2.jpeg',
      'https://img.belgiumdia.com/Watch/T3741.jpg',
    ]);
  });

  it('leaves a catalog-only listing alone when DNA is down or empty', async () => {
    const item = watch({ imageUrls: ['https://dnalinks.in/RW3102.jpg'], videoUrls: [] });
    const result = await enrichWatchGalleries([item], async () => null);
    expect(result.enriched).toBe(0);
    expect(item.imageUrls).toEqual(['https://dnalinks.in/RW3102.jpg']);
  });

  it('stops after a full wave of DNA failures so a down host cannot stall the hour', async () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      watch({ stockRef: `FAIL${i}`, imageUrls: [`https://dnalinks.in/FAIL${i}.jpg`], videoUrls: [] }),
    );
    const result = await enrichWatchGalleries(items, async () => null);
    expect(result.aborted).toBe(true);
    expect(result.enriched).toBe(0);
  });
});
