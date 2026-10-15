import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pdp = readFileSync(new URL('../../sections/main-product-diamond.liquid', import.meta.url), 'utf8');

describe('loose diamond video', () => {
  it('still loads on demand, but plays as soon as the 360° tab opens', () => {
    expect(pdp).toContain('<video data-src="{{ m.video_url }}" controls playsinline muted loop preload="none"');
    expect(pdp).toContain('video.muted = true;');
    expect(pdp).toContain('video.play()');
    expect(pdp).toContain('video.pause();');
  });

  it('keeps dropping the tab when the supplier link is dead', () => {
    expect(pdp).toContain("video.addEventListener('error'");
  });
});
