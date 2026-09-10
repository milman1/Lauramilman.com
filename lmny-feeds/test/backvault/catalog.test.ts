import { describe, expect, it } from 'vitest';
import { channelsFor } from '../../config/channels.js';
import { publishStateFor } from '../../src/backvault/catalog.js';

/**
 * Real `resourcePublications` shape: Shopify returns a row ONLY for a
 * publication the product is actually published to. A channel it has never
 * been published to has no row, and a DRAFT or ARCHIVED product comes back
 * with an empty array — which is why the installed set has to come from the
 * shop-level `publications` query instead of these rows.
 */
function publishedRows(names: string[]) {
  return names.map((name) => ({ isPublished: true, publication: { name } }));
}

const ESTATE = channelsFor('estate');

/** What the store actually has installed (audit 2026-09-09). */
const INSTALLED = [
  'Online Store',
  'Facebook & Instagram',
  'Google & YouTube',
  'Pinterest',
  'Shop',
  'TikTok',
  'Inbox',
  'Microsoft Channel',
  'Faire: Sell Wholesale',
  'Buy Button',
];

describe('publishStateFor', () => {
  it('is published only when every configured channel has a row', () => {
    expect(publishStateFor(publishedRows([...ESTATE]), ESTATE, INSTALLED)).toEqual({
      published: true,
      missingChannels: [],
    });
  });

  it('reports the four channels an Online-Store-only estate piece is missing', () => {
    const state = publishStateFor(publishedRows(['Online Store']), ESTATE, INSTALLED);
    expect(state.published).toBe(false);
    expect(state.missingChannels).toEqual(['Shop', 'Google & YouTube', 'Facebook & Instagram', 'Pinterest']);
  });

  it('treats an empty publication list as published nowhere, not published everywhere', () => {
    // A DRAFT or never-published product returns no rows at all. Reading the
    // installed set off these rows was the 2026-09-10 bug: it made every
    // product look fully published and killed the 404 repair path.
    const state = publishStateFor([], ESTATE, INSTALLED);
    expect(state.published).toBe(false);
    expect(state.missingChannels).toEqual([...ESTATE]);
  });

  it('reports a single missing channel', () => {
    const state = publishStateFor(
      publishedRows(['Online Store', 'Shop', 'Google & YouTube', 'Facebook & Instagram']),
      ESTATE,
      INSTALLED,
    );
    expect(state.published).toBe(false);
    expect(state.missingChannels).toEqual(['Pinterest']);
  });

  it('ignores a configured channel the store has not installed', () => {
    const state = publishStateFor(publishedRows(['Online Store', 'Shop']), ESTATE, [
      'Online Store',
      'Shop',
    ]);
    expect(state).toEqual({ published: true, missingChannels: [] });
  });

  it('does not count extra publications like TikTok or Faire as missing', () => {
    const state = publishStateFor(publishedRows([...ESTATE]), ESTATE, INSTALLED);
    expect(state.missingChannels).not.toContain('TikTok');
    expect(state.missingChannels).not.toContain('Faire: Sell Wholesale');
  });

  it('accepts the legacy Online Store 2.0 publication name on both sides', () => {
    const state = publishStateFor(
      publishedRows(['Online Store 2.0', 'Shop']),
      ['Online Store', 'Shop'],
      ['Online Store 2.0', 'Shop'],
    );
    expect(state).toEqual({ published: true, missingChannels: [] });
  });

  it('flags Online Store when the product has no storefront row', () => {
    const state = publishStateFor(publishedRows(['Shop']), ['Online Store', 'Shop'], INSTALLED);
    expect(state.published).toBe(false);
    expect(state.missingChannels).toEqual(['Online Store']);
  });

  it('honours an explicit isPublished false row', () => {
    const state = publishStateFor(
      [
        { isPublished: false, publication: { name: 'Online Store' } },
        { isPublished: true, publication: { name: 'Shop' } },
      ],
      ['Online Store', 'Shop'],
      INSTALLED,
    );
    expect(state.missingChannels).toEqual(['Online Store']);
  });

  it('reports every configured channel missing when nothing is published and all are installed', () => {
    const state = publishStateFor([], ESTATE, [...ESTATE]);
    expect(state).toEqual({ published: false, missingChannels: [...ESTATE] });
  });
});
