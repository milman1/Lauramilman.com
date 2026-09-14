import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertGeneratedImageStillMatches,
  assertRoyalChainMediaProductDraft,
  assertSafeRoyalChainPublicFilename,
  baseHandleForMedia,
  buildRoyalChainMediaTargets,
  executeReviewedMediaAttachments,
  hasMediaIdentity,
  mayClearRoyalChainMediaMissing,
  parseGeneratedRoyalChainImages,
  verifyGeneratedRoyalChainImages,
} from '../src/royalchain/media.js';

const bases = Array.from({ length: 21 }, (_, index) => `lmny-chain-${String(index + 1).padStart(2, '0')}`);
const mixedBases = bases.slice(0, 11);
const braceletOnlyBases = bases.slice(11, 13);
const files = bases.flatMap((base) => [
  `/approved/${base}-detail.png`,
  `/approved/${base}-onbody.png`,
]).concat(mixedBases.map((base) => `/approved/${base}-wrist.png`));

function products() {
  return [
    ...bases.filter((handle) => !braceletOnlyBases.includes(handle)).map((handle) => ({ handle, title: `${handle} Necklace in 14K Yellow Gold`, productType: 'Necklaces' })),
    ...mixedBases.map((handle) => ({ handle: `${handle}-bracelet`, title: `${handle} Bracelet in 14K Yellow Gold`, productType: 'Bracelets' })),
    ...braceletOnlyBases.map((handle) => ({ handle, title: `${handle} Bracelet in 14K Yellow Gold`, productType: 'Bracelets' })),
  ];
}

describe('Royal Chain generated media plan', () => {
  it('requires the approved 21 detail, 21 on-body, and 11 wrist assets only', () => {
    const parsed = parseGeneratedRoyalChainImages(files, bases, mixedBases);
    expect(parsed).toHaveLength(21);
    expect(parsed.get(bases[0]!)?.detail?.filename).toBe('lmny-chain-01-detail.png');
    expect(parsed.get(bases[0]!)?.wrist?.filename).toBe('lmny-chain-01-wrist.png');
    expect(() => parseGeneratedRoyalChainImages(files.slice(1), bases, mixedBases)).toThrow(/exactly 53/);
    expect(() => parseGeneratedRoyalChainImages([...files, '/approved/lmny-chain-01-detail.jpg'], bases, mixedBases)).toThrow(/expected exactly 53/);
    expect(() => parseGeneratedRoyalChainImages([...files.slice(0, -1), '/approved/not-approved-onbody.png'], bases, mixedBases)).toThrow(/not in the approved plan/);
    expect(() => parseGeneratedRoyalChainImages([...files, '/approved/contact-sheet.png', '/approved/contact-sheet-2.png'], bases, mixedBases)).not.toThrow();
    expect(() => parseGeneratedRoyalChainImages([...files, '/approved/unexpected.png'], bases, mixedBases)).toThrow(/unexpected generated-image filename/);
  });

  it('reads every image and rejects missing, corrupt, or extension-mismatched bytes before Shopify access', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'royal-media-'));
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const localFiles = files.map((file) => path.join(dir, path.basename(file)));
    await Promise.all(localFiles.map((file) => writeFile(file, png)));
    try {
      const verified = await verifyGeneratedRoyalChainImages(parseGeneratedRoyalChainImages(localFiles, bases, mixedBases));
      expect(verified).toHaveLength(21);
      expect(verified.get(bases[0]!)?.detail).toMatchObject({ mimeType: 'image/png', bytes: 8, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });

      await unlink(localFiles[0]!);
      await expect(verifyGeneratedRoyalChainImages(parseGeneratedRoyalChainImages(localFiles, bases, mixedBases))).rejects.toThrow(/cannot read generated image/);
      await writeFile(localFiles[0]!, new Uint8Array([0xff, 0xd8, 0xff]));
      await expect(verifyGeneratedRoyalChainImages(parseGeneratedRoyalChainImages(localFiles, bases, mixedBases))).rejects.toThrow(/does not match image\/jpeg/);
      await writeFile(localFiles[0]!, new Uint8Array([1, 2, 3]));
      await expect(verifyGeneratedRoyalChainImages(parseGeneratedRoyalChainImages(localFiles, bases, mixedBases))).rejects.toThrow(/unsupported or corrupt/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('maps necklaces to on-body, split bracelets to on-wrist, and bracelet-only families to on-body', () => {
    const targets = buildRoyalChainMediaTargets(products(), parseGeneratedRoyalChainImages(files, bases, mixedBases));
    expect(targets).toHaveLength(32);
    const bracelet = targets.find((target) => target.handle === 'lmny-chain-01-bracelet')!;
    expect(bracelet.baseHandle).toBe('lmny-chain-01');
    expect(bracelet.images.detail?.filename).toBe('lmny-chain-01-detail.png');
    expect(bracelet.alt.detail).toContain('detail view');
    expect(bracelet.attachmentKinds).toEqual(['detail', 'wrist']);
    expect(bracelet.alt.wrist).toContain('on-wrist view');
    const necklace = targets.find((target) => target.handle === 'lmny-chain-01')!;
    expect(necklace.attachmentKinds).toEqual(['detail', 'onbody']);
    const braceletOnly = targets.find((target) => target.handle === 'lmny-chain-12')!;
    expect(braceletOnly.attachmentKinds).toEqual(['detail', 'onbody']);
    expect(() => buildRoyalChainMediaTargets(products().map((product, index) => index === 0 ? { ...product, title: 'Royal Chain Necklace' } : product), parseGeneratedRoyalChainImages(files, bases, mixedBases))).toThrow(/supplier name/i);
  });

  it('rejects supplier identity in a handle, generated filename, or public staged filename', () => {
    expect(() => baseHandleForMedia('royal-chain-necklace-bracelet')).toThrow(/supplier name/i);
    expect(() => assertSafeRoyalChainPublicFilename('royal-chain-detail.png')).toThrow(/supplier name/i);
    expect(() => assertSafeRoyalChainPublicFilename('nested/lmny-chain-detail.png')).toThrow(/unsafe public staged filename/);
    const unsafeBases = [...bases.slice(0, -1), 'royal-chain-necklace'];
    const unsafeFiles = files.map((file) => file.replace('lmny-chain-21', 'royal-chain-necklace'));
    expect(() => parseGeneratedRoyalChainImages(unsafeFiles, unsafeBases, mixedBases)).toThrow(/supplier name/i);
  });

  it('is idempotent on either matching alt text or Shopify CDN filename identity', () => {
    const target = buildRoyalChainMediaTargets(products(), parseGeneratedRoyalChainImages(files, bases, mixedBases))[0]!;
    expect(hasMediaIdentity([{ id: '1', alt: target.alt.detail!, url: 'https://cdn.shopify.com/detail.png', status: 'READY' }], target.images.detail!, target.alt.detail!)).toBe(true);
    expect(hasMediaIdentity([{ id: '2', alt: null, url: 'https://cdn.shopify.com/files/lmny-chain-01-onbody.png?v=1', status: 'PROCESSING' }], target.images.onbody!, target.alt.onbody!)).toBe(true);
    expect(hasMediaIdentity([{ id: '3', alt: target.alt.detail!, url: 'https://cdn.shopify.com/files/lmny-chain-01-detail.png', status: 'FAILED' }], target.images.detail!, target.alt.detail!)).toBe(false);
  });

  it('clears media-missing only for a Draft product with both approved uploads ready and three total ready images', () => {
    const target = buildRoyalChainMediaTargets(products(), parseGeneratedRoyalChainImages(files, bases, mixedBases))[0]!;
    const complete = [
      { id: 'source', alt: 'source', url: 'https://cdn.shopify.com/files/source.jpg', status: 'READY' },
      { id: 'detail', alt: target.alt.detail!, url: 'https://cdn.shopify.com/files/lmny-chain-01-detail.png', status: 'READY' },
      { id: 'onbody', alt: target.alt.onbody!, url: 'https://cdn.shopify.com/files/lmny-chain-01-onbody.png', status: 'READY' },
    ];
    expect(mayClearRoyalChainMediaMissing('DRAFT', complete, target)).toBe(true);
    expect(mayClearRoyalChainMediaMissing('ACTIVE', complete, target)).toBe(false);
    expect(mayClearRoyalChainMediaMissing('DRAFT', complete.slice(0, 2), target)).toBe(false);
  });

  it('only strips the terminal bracelet suffix', () => {
    expect(baseHandleForMedia('lmny-chain-bracelet')).toBe('lmny-chain');
    expect(baseHandleForMedia('lmny-bracelet-chain')).toBe('lmny-bracelet-chain');
  });

  it('fails if an approved asset changes before staging and checks Draft status immediately before mutations', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'royal-hash-'));
    const file = path.join(dir, 'lmny-chain-01-detail.png');
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    try {
      await writeFile(file, png);
      const image = parseGeneratedRoyalChainImages([...files.slice(1), file], bases, mixedBases).get('lmny-chain-01')!.detail!;
      const approved = (await verifyGeneratedRoyalChainImages(new Map([[image.baseHandle, { detail: image }]]), 1)).get(image.baseHandle)!.detail!;
      await assertGeneratedImageStillMatches(image, approved);
      await writeFile(file, new Uint8Array([...png, 0]));
      await expect(assertGeneratedImageStillMatches(image, approved)).rejects.toThrow(/changed after review/);
      expect(() => assertRoyalChainMediaProductDraft('lmny-chain-01', 'ACTIVE')).toThrow(/non-DRAFT/);
      expect(() => assertRoyalChainMediaProductDraft('lmny-chain-01', 'DRAFT')).not.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('checks Draft state before each stage and attachment, stopping when status drifts before the second attachment', async () => {
    const calls: string[] = [];
    const statuses = ['DRAFT', 'DRAFT', 'DRAFT', 'ACTIVE'];
    await expect(executeReviewedMediaAttachments({
      kinds: ['detail', 'wrist'] as const,
      needsStaging: () => true,
      assertDraftNow: async (phase, kind) => {
        calls.push(`${phase}:${kind}`);
        assertRoyalChainMediaProductDraft('lmny-chain-01', statuses.shift()!);
      },
      stage: async (kind) => { calls.push(`stage:${kind}`); },
      attach: async (kind) => { calls.push(`attach:${kind}`); },
    })).rejects.toThrow(/non-DRAFT/);
    expect(calls).toEqual([
      'before-stage:detail', 'stage:detail', 'before-attach:detail', 'attach:detail',
      'before-stage:wrist', 'stage:wrist', 'before-attach:wrist',
    ]);
  });
});
