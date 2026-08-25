import { describe, expect, it } from 'vitest';
import {
  enrichWatchGalleries,
  mergeMediaUrls,
  parseDnaGalleryHtml,
  preferDetailShots,
} from '../src/dnaGallery.js';
import { watch } from './fixtures.js';

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

describe('enrichWatchGalleries', () => {
  it('fills a one-photo watch from the DNA viewer', async () => {
    const item = watch({
      stockRef: 'T3743',
      imageUrls: ['https://dnalinks.in/T3743.jpg'],
      videoUrls: [],
    });
    const pages = new Map([['https://dna.dnalinks.in/w/T3743', DNA_T3743]]);
    const result = await enrichWatchGalleries([item], async (url) => pages.get(url) ?? null);
    expect(result).toEqual({ enriched: 1, extraImages: 3, extraVideos: 1 });
    expect(item.imageUrls).toEqual([
      'https://dnalinks.in/t3743_1.jpeg',
      'https://dnalinks.in/t3743_2.jpeg',
      'https://dnalinks.in/t3743_3.jpeg',
      'https://dnalinks.in/T3743.jpg',
    ]);
    expect(item.videoUrls).toEqual(['https://dnalinks.in/t3743_1.mp4']);
  });

  it('does not refetch a watch that already has a full gallery', async () => {
    const item = watch({
      imageUrls: [
        'https://dnalinks.in/10005.jpg',
        'https://dnalinks.in/10005_1.jpg',
        'https://dnalinks.in/10005_2.jpg',
      ],
    });
    let calls = 0;
    await enrichWatchGalleries([item], async () => {
      calls += 1;
      return DNA_10005;
    });
    expect(calls).toBe(0);
    expect(item.imageUrls).toHaveLength(3);
  });

  it('leaves the listing alone when DNA is down or empty', async () => {
    const item = watch({ imageUrls: ['https://dnalinks.in/RW3102.jpg'], videoUrls: [] });
    const result = await enrichWatchGalleries([item], async () => null);
    expect(result.enriched).toBe(0);
    expect(item.imageUrls).toEqual(['https://dnalinks.in/RW3102.jpg']);
  });
});
