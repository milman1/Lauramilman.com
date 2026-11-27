import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pdp = readFileSync(new URL('../../sections/main-product-diamond.liquid', import.meta.url), 'utf8');

describe('loose diamond video', () => {
  it('sets the src only when the 360° tab opens, then plays', () => {
    expect(pdp).toContain('<video data-src="{{ m.video_url }}" controls playsinline muted loop preload="none"');
    expect(pdp).toContain('video.muted = true;');
    expect(pdp).toContain('video.play()');
    expect(pdp).toContain('video.pause();');
  });

  it('opens on the video when the stone has one, with the photo one tab away', () => {
    expect(pdp).toContain('data-pane="video" data-video-default');
    expect(pdp).toContain('data-pane-body="image"{% if m.video_url %} hidden{% endif %}');
    expect(pdp).toContain('<div class="dpdp__stage" data-pane-body="video">');
    expect(pdp).toContain('if (videoDefault) videoDefault.click();');
    expect(pdp).toContain('poster="{{ product.featured_media | image_url: width: 1200 }}"');
  });

  it('brings the photo forward when a thumbnail is clicked', () => {
    expect(pdp).toContain("if (imageTab && !imageTab.classList.contains('is-active')) imageTab.click();");
  });

  it('keeps dropping the tab when the supplier link is dead', () => {
    expect(pdp).toContain("video.addEventListener('error'");
  });
});
