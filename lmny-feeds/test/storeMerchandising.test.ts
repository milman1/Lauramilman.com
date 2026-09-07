import { describe, expect, it } from 'vitest';
import {
  EXPECTED_JOURNAL_HANDLES,
  JOURNAL_PAGES,
  NEWS_REDIRECTS,
  SHOPPING_COLLECTION_HANDLES,
  pickSalesPublications,
} from '../src/storeMerchandising.js';

describe('store merchandising', () => {
  it('detects Shop and Google publications by name', () => {
    const picked = pickSalesPublications([
      { id: '1', name: 'Online Store' },
      { id: '2', name: 'Shop' },
      { id: '3', name: 'Google & YouTube' },
      { id: '4', name: 'Point of Sale' },
    ]);
    expect(picked.onlineStore?.name).toBe('Online Store');
    expect(picked.shop?.name).toBe('Shop');
    expect(picked.google?.name).toBe('Google & YouTube');
    expect(picked.others.map((p) => p.name)).toEqual(['Point of Sale']);
  });

  it('reports missing Shop and Google instead of inventing them', () => {
    const picked = pickSalesPublications([{ id: '1', name: 'Online Store' }]);
    expect(picked.shop).toBeUndefined();
    expect(picked.google).toBeUndefined();
  });

  it('does not treat Online Store as the Shop channel', () => {
    const picked = pickSalesPublications([{ id: '1', name: 'Online Store' }]);
    expect(picked.shop).toBeUndefined();
    expect(picked.onlineStore?.name).toBe('Online Store');
  });

  it('covers the three NYC Journal pages that currently 404', () => {
    expect(JOURNAL_PAGES.map((p) => p.handle)).toEqual([
      'best-bars-nyc',
      'power-dressing-nyc',
      'hotel-bars-nyc',
    ]);
    expect(NEWS_REDIRECTS[0]?.path).toContain('/blogs/news/');
  });

  it('publishes the Pre-Owned Maison vault first, then watches', () => {
    expect(SHOPPING_COLLECTION_HANDLES[0]).toBe('estate-jewelry');
    expect(SHOPPING_COLLECTION_HANDLES).toContain('vintage-jewelry');
    expect(SHOPPING_COLLECTION_HANDLES).toContain('cartier');
    expect(SHOPPING_COLLECTION_HANDLES).toContain('jacob-co');
    expect(SHOPPING_COLLECTION_HANDLES).toContain('time-pieces');
  });

  it('expects all nine live Journal articles', () => {
    expect(EXPECTED_JOURNAL_HANDLES).toHaveLength(9);
    expect(EXPECTED_JOURNAL_HANDLES).toContain('how-to-buy-pre-owned-cartier-van-cleef-tiffany');
  });
});
