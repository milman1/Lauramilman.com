import { describe, expect, it } from 'vitest';
import { sniffImageMime, sniffVideoMime } from '../src/shopify.js';

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

/** ISO base media file: 4 size bytes, then `ftyp`, then a 4-char brand. */
function isoVideo(brand: string): Uint8Array {
  return new Uint8Array([0, 0, 0, 0x20, ...new TextEncoder().encode('ftyp' + brand)]);
}

describe('image type sniffing', () => {
  // The whole point: the supplier's Content-Type says application/octet-stream
  // on files that are plainly JPEGs, so the bytes are the only honest source.
  it('identifies the formats Shopify accepts', () => {
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a))).toBe('image/png');
    expect(sniffImageMime(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe('image/gif');
    expect(sniffImageMime(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe('image/webp');
  });

  it('rejects an HTML error page served at a .jpg URL', () => {
    const html = new TextEncoder().encode('<!DOCTYPE html><html><body>Not found');
    expect(sniffImageMime(html)).toBeNull();
  });

  it('rejects truncated and empty responses rather than guessing', () => {
    expect(sniffImageMime(bytes())).toBeNull();
    expect(sniffImageMime(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffImageMime(bytes(0x52, 0x49, 0x46, 0x46))).toBeNull();
  });
});

describe('video type sniffing', () => {
  it('identifies the containers the feed serves', () => {
    expect(sniffVideoMime(isoVideo('isom'))).toBe('video/mp4');
    expect(sniffVideoMime(isoVideo('mp42'))).toBe('video/mp4');
    expect(sniffVideoMime(isoVideo('qt  '))).toBe('video/quicktime');
    expect(sniffVideoMime(bytes(0x1a, 0x45, 0xdf, 0xa3, 0x01))).toBe('video/webm');
  });

  it('rejects a 360° viewer page — an HTML document at a video-looking URL', () => {
    const html = new TextEncoder().encode('<!DOCTYPE html><html><body><canvas>');
    expect(sniffVideoMime(html)).toBeNull();
    expect(sniffVideoMime(bytes())).toBeNull();
  });

  it('rejects an image, so a photo never lands in the video slot', () => {
    expect(sniffVideoMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBeNull();
  });
});
