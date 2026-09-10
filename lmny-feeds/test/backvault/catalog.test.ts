import { describe, expect, it } from 'vitest';
import { channelsFor } from '../../config/channels.js';
import { publishStateFor } from '../../src/backvault/catalog.js';

/** `resourcePublications(onlyPublished: false)` shape. */
function nodes(state: Record<string, boolean>) {
  return Object.entries(state).map(([name, isPublished]) => ({
    isPublished,
    publication: { name },
  }));
}

const ALL_INSTALLED = [...channelsFor('estate'), 'TikTok', 'Faire'];

function installed(publishedTo: string[]) {
  return nodes(Object.fromEntries(ALL_INSTALLED.map((name) => [name, publishedTo.includes(name)])));
}

describe('publishStateFor', () => {
  it('is published only when every configured channel is on', () => {
    const state = publishStateFor(installed([...channelsFor('estate')]));
    expect(state).toEqual({ published: true, missingChannels: [] });
  });

  it('reports the channels an Online-Store-only estate piece is missing', () => {
    const state = publishStateFor(installed(['Online Store']));
    expect(state.published).toBe(false);
    expect(state.missingChannels).toEqual(['Shop', 'Google & YouTube', 'Facebook & Instagram', 'Pinterest']);
  });

  it('reports a single missing channel', () => {
    const state = publishStateFor(installed(['Online Store', 'Shop', 'Google & YouTube', 'Facebook & Instagram']));
    expect(state.published).toBe(false);
    expect(state.missingChannels).toEqual(['Pinterest']);
  });

  it('ignores channels that are not installed on the store', () => {
    const state = publishStateFor(nodes({ 'Online Store': true, Shop: true }), [
      'Online Store',
      'Shop',
      'Pinterest',
    ]);
    expect(state).toEqual({ published: true, missingChannels: [] });
  });

  it('does not count extra publications like TikTok or Faire as missing', () => {
    const state = publishStateFor(installed([...channelsFor('estate')]));
    expect(state.missingChannels).not.toContain('TikTok');
    expect(state.missingChannels).not.toContain('Faire');
  });

  it('accepts the legacy Online Store 2.0 publication name', () => {
    const state = publishStateFor(
      nodes({ 'Online Store 2.0': true, Shop: true }),
      ['Online Store', 'Shop'],
    );
    expect(state).toEqual({ published: true, missingChannels: [] });
  });

  it('flags an Online Store 2.0 publication that is off', () => {
    const state = publishStateFor(nodes({ 'Online Store 2.0': false, Shop: true }), ['Online Store', 'Shop']);
    expect(state.published).toBe(false);
    expect(state.missingChannels).toEqual(['Online Store']);
  });

  it('treats a product with no publications at all as published to nothing installed', () => {
    // Nothing installed means nothing to publish to — the sync cannot fix it,
    // so it must not loop on a publish decision.
    expect(publishStateFor([])).toEqual({ published: true, missingChannels: [] });
  });

  it('defaults to the estate channel list', () => {
    const state = publishStateFor(installed(['Online Store', 'Shop']));
    expect(state.missingChannels).toEqual(['Google & YouTube', 'Facebook & Instagram', 'Pinterest']);
  });
});
