import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertSafeRoyalChainPublicFilename,
  baseHandleForMedia,
  buildRoyalChainMediaTargets,
  hasMediaIdentity,
  mayClearRoyalChainMediaMissing,
  parseGeneratedRoyalChainImages,
  verifyGeneratedRoyalChainImages,
} from '../src/royalchain/media.js';

const bases = Array.from({ length: 21 }, (_, index) => `lmny-chain-${String(index + 1).padStart(2, '0')}`);
const files = bases.flatMap((base) => [
  `/approved/${base}-detail.png`,
  `/approved/${base}-onbody.png`,
]);

function products() {
  return [
    ...bases.map((handle) => ({ handle, title: `${handle} Necklace in 14K Yellow Gold` })),
    ...bases.slice(0, 11).map((handle) => ({ handle: `${handle}-bracelet`, title: `${handle} Bracelet in 14K Yellow Gold` })),
  ];
}

describe('Royal Chain generated media plan', () => {
  it('requires exactly one approved detail and on-body image for every base handle', () => {
    const parsed = parseGeneratedRoyalChainImages(files, bases);
    expect(parsed).toHaveLength(21);
    expect(parsed.get(bases[0]!)?.detail.filename).toBe('lmny-chain-01-detail.png');
    expect(() => parseGeneratedRoyalChainImages(files.slice(1), bases)).toThrow(/exactly 42/);
    expect(() => parseGeneratedRoyalChainImages([...files, '/approved/lmny-chain-01-detail.jpg'], bases)).toThrow(/expected exactly 42/);
    expect(() => parseGeneratedRoyalChainImages([...files.slice(0, -1), '/approved/not-approved-onbody.png'], bases)).toThrow(/not in the approved plan/);
  });

  it('reads every image and rejects missing, corrupt, or extension-mismatched bytes before Shopify access', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'royal-media-'));
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const localFiles = files.map((file) => path.join(dir, path.basename(file)));
    await Promise.all(localFiles.map((file) => writeFile(file, png)));
    try {
      const verified = await verifyGeneratedRoyalChainImages(parseGeneratedRoyalChainImages(localFiles, bases));
      expect(verified).toHaveLength(21);
      expect(verified.get(bases[0]!)?.detail).toMatchObject({ mimeType: 'image/png', bytes: 8, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });

      await unlink(localFiles[0]!);
      await expect(verifyGeneratedRoyalChainImages(parseGeneratedRoyalChainImages(localFiles, bases))).rejects.toThrow(/cannot read generated image/);
      await writeFile(localFiles[0]!, new Uint8Array([0xff, 0xd8, 0xff]));
      await expect(verifyGeneratedRoyalChainImages(parseGeneratedRoyalChainImages(localFiles, bases))).rejects.toThrow(/does not match image\/jpeg/);
      await writeFile(localFiles[0]!, new Uint8Array([1, 2, 3]));
      await expect(verifyGeneratedRoyalChainImages(parseGeneratedRoyalChainImages(localFiles, bases))).rejects.toThrow(/unsupported or corrupt/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('maps the shared pair to each necklace and its bracelet split with scrubbed LMNY alt text', () => {
    const targets = buildRoyalChainMediaTargets(products(), parseGeneratedRoyalChainImages(files, bases));
    expect(targets).toHaveLength(32);
    const bracelet = targets.find((target) => target.handle === 'lmny-chain-01-bracelet')!;
    expect(bracelet.baseHandle).toBe('lmny-chain-01');
    expect(bracelet.images.detail.filename).toBe('lmny-chain-01-detail.png');
    expect(bracelet.alt.detail).toContain('detail view');
    expect(bracelet.alt.onbody).toContain('on-body view');
    expect(() => buildRoyalChainMediaTargets(products().map((product, index) => index === 0 ? { ...product, title: 'Royal Chain Necklace' } : product), parseGeneratedRoyalChainImages(files, bases))).toThrow(/supplier name/i);
  });

  it('rejects supplier identity in a handle, generated filename, or public staged filename', () => {
    expect(() => baseHandleForMedia('royal-chain-necklace-bracelet')).toThrow(/supplier name/i);
    expect(() => assertSafeRoyalChainPublicFilename('royal-chain-detail.png')).toThrow(/supplier name/i);
    expect(() => assertSafeRoyalChainPublicFilename('nested/lmny-chain-detail.png')).toThrow(/unsafe public staged filename/);
    const unsafeBases = [...bases.slice(0, -1), 'royal-chain-necklace'];
    const unsafeFiles = [...files.slice(0, -2), '/approved/royal-chain-necklace-detail.png', '/approved/royal-chain-necklace-onbody.png'];
    expect(() => parseGeneratedRoyalChainImages(unsafeFiles, unsafeBases)).toThrow(/supplier name/i);
  });

  it('is idempotent on either matching alt text or Shopify CDN filename identity', () => {
    const target = buildRoyalChainMediaTargets(products(), parseGeneratedRoyalChainImages(files, bases))[0]!;
    expect(hasMediaIdentity([{ id: '1', alt: target.alt.detail, url: 'https://cdn.shopify.com/detail.png', status: 'READY' }], target.images.detail, target.alt.detail)).toBe(true);
    expect(hasMediaIdentity([{ id: '2', alt: null, url: 'https://cdn.shopify.com/files/lmny-chain-01-onbody.png?v=1', status: 'PROCESSING' }], target.images.onbody, target.alt.onbody)).toBe(true);
    expect(hasMediaIdentity([{ id: '3', alt: target.alt.detail, url: 'https://cdn.shopify.com/files/lmny-chain-01-detail.png', status: 'FAILED' }], target.images.detail, target.alt.detail)).toBe(false);
  });

  it('clears media-missing only for a Draft product with both approved uploads ready and three total ready images', () => {
    const target = buildRoyalChainMediaTargets(products(), parseGeneratedRoyalChainImages(files, bases))[0]!;
    const complete = [
      { id: 'source', alt: 'source', url: 'https://cdn.shopify.com/files/source.jpg', status: 'READY' },
      { id: 'detail', alt: target.alt.detail, url: 'https://cdn.shopify.com/files/lmny-chain-01-detail.png', status: 'READY' },
      { id: 'onbody', alt: target.alt.onbody, url: 'https://cdn.shopify.com/files/lmny-chain-01-onbody.png', status: 'READY' },
    ];
    expect(mayClearRoyalChainMediaMissing('DRAFT', complete, target)).toBe(true);
    expect(mayClearRoyalChainMediaMissing('ACTIVE', complete, target)).toBe(false);
    expect(mayClearRoyalChainMediaMissing('DRAFT', complete.slice(0, 2), target)).toBe(false);
  });

  it('only strips the terminal bracelet suffix', () => {
    expect(baseHandleForMedia('lmny-chain-bracelet')).toBe('lmny-chain');
    expect(baseHandleForMedia('lmny-bracelet-chain')).toBe('lmny-bracelet-chain');
  });
});
