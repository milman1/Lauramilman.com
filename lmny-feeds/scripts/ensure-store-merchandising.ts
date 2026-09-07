/**
 * Publish Pre-Owned Maison + watches to Shop/Google, keep Journal live,
 * and report whether email signups are actually subscribed.
 *
 *   npx tsx scripts/ensure-store-merchandising.ts --preview
 *   npx tsx scripts/ensure-store-merchandising.ts --dry-run
 *   npx tsx scripts/ensure-store-merchandising.ts
 *
 * Shop and Google & YouTube must already be installed in Shopify Admin.
 * This script cannot create those apps. When they exist, it publishes
 * estate jewelry and timepieces to those sales channels.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { exchangeClientCredentials, ShopifyClient } from '../src/shopify.js';
import {
  EXPECTED_JOURNAL_HANDLES,
  JOURNAL_PAGES,
  NEWS_REDIRECTS,
  SHOPPING_COLLECTION_HANDLES,
  pickSalesPublications,
} from '../src/storeMerchandising.js';

async function resolveToken(domain: string): Promise<string> {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (clientId && clientSecret) {
    const { token } = await exchangeClientCredentials(domain, clientId, clientSecret);
    return token;
  }
  throw new Error('Set SHOPIFY_ADMIN_TOKEN, or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET');
}

async function loadCollection(
  client: ShopifyClient,
  handle: string,
): Promise<{ id: string; productIds: string[] } | null> {
  const productIds: string[] = [];
  let collectionId: string | null = null;
  let cursor: string | null = null;
  for (;;) {
    const data = await client.gql<{
      collection: {
        id: string;
        products: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{ id: string }>;
        };
      } | null;
    }>(
      `query($handle: String!, $cursor: String) {
        collection(handle: $handle) {
          id
          products(first: 50, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes { id }
          }
        }
      }`,
      { handle, cursor },
    );
    const col = data.collection;
    if (!col) return null;
    collectionId = col.id;
    for (const node of col.products.nodes) productIds.push(node.id);
    if (!col.products.pageInfo.hasNextPage) break;
    cursor = col.products.pageInfo.endCursor;
  }
  return collectionId ? { id: collectionId, productIds } : null;
}

async function ensurePage(
  client: ShopifyClient,
  page: (typeof JOURNAL_PAGES)[number],
  dryRun: boolean,
): Promise<string> {
  try {
    const existing = await client.gql<{
      pages: { nodes: Array<{ id: string; handle: string }> };
    }>(`query($q: String!) { pages(first: 5, query: $q) { nodes { id handle } } }`, {
      q: `handle:${page.handle}`,
    });
    const match = existing.pages.nodes.find((p) => p.handle === page.handle);
    if (match) return `exists ${page.handle}`;
    if (dryRun) return `would-create ${page.handle}`;
    const data = await client.gql<{
      pageCreate: { page: { handle: string } | null; userErrors: Array<{ message: string }> };
    }>(
      `mutation($page: PageCreateInput!) {
        pageCreate(page: $page) { page { handle } userErrors { message } }
      }`,
      {
        page: {
          title: page.title,
          handle: page.handle,
          isPublished: true,
          templateSuffix: page.templateSuffix,
          body: `<p>${page.title} — Laura Milman New York.</p>`,
        },
      },
    );
    if (data.pageCreate.userErrors.length) {
      return `error ${page.handle}: ${data.pageCreate.userErrors.map((e) => e.message).join('; ')}`;
    }
    return `created ${page.handle}`;
  } catch (err) {
    return `error ${page.handle}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function ensureRedirect(
  client: ShopifyClient,
  redirect: (typeof NEWS_REDIRECTS)[number],
  dryRun: boolean,
): Promise<string> {
  try {
    const existing = await client.gql<{
      urlRedirects: { nodes: Array<{ id: string; path: string }> };
    }>(`query($q: String!) { urlRedirects(first: 5, query: $q) { nodes { id path } } }`, {
      q: `path:${redirect.path}`,
    });
    if (existing.urlRedirects.nodes.some((r) => r.path === redirect.path)) {
      return `exists ${redirect.path}`;
    }
    if (dryRun) return `would-create ${redirect.path}`;
    const data = await client.gql<{
      urlRedirectCreate: { userErrors: Array<{ message: string }> };
    }>(
      `mutation($urlRedirect: UrlRedirectInput!) {
        urlRedirectCreate(urlRedirect: $urlRedirect) { userErrors { message } }
      }`,
      { urlRedirect: { path: redirect.path, target: redirect.target } },
    );
    if (data.urlRedirectCreate.userErrors.length) {
      return `error ${redirect.path}: ${data.urlRedirectCreate.userErrors.map((e) => e.message).join('; ')}`;
    }
    return `created ${redirect.path}`;
  } catch (err) {
    return `error ${redirect.path}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

type ArticleRow = {
  id: string;
  handle: string;
  title: string;
  isPublished: boolean;
  blog: string;
};

async function listJournalArticles(client: ShopifyClient): Promise<ArticleRow[]> {
  const data = await client.gql<{
    articles: {
      nodes: Array<{
        id: string;
        handle: string;
        title: string;
        isPublished: boolean;
        blog: { handle: string };
      }>;
    };
  }>(
    `{ articles(first: 50) {
        nodes { id handle title isPublished blog { handle } }
      } }`,
  );
  return data.articles.nodes.map((n) => ({
    id: n.id,
    handle: n.handle,
    title: n.title,
    isPublished: n.isPublished,
    blog: n.blog.handle,
  }));
}

async function publishArticle(client: ShopifyClient, id: string): Promise<string[]> {
  const data = await client.gql<{
    articleUpdate: { userErrors: Array<{ message: string }> };
  }>(
    `mutation($id: ID!, $article: ArticleUpdateInput!) {
      articleUpdate(id: $id, article: $article) { userErrors { message } }
    }`,
    { id, article: { isPublished: true } },
  );
  return data.articleUpdate.userErrors.map((e) => e.message);
}

async function subscriberSnapshot(client: ShopifyClient): Promise<string> {
  try {
    const data = await client.gql<{
      customersCount?: { count: number };
    }>(`{ customersCount(query: "accepts_marketing:true") { count } }`);
    if (data.customersCount) {
      return `${data.customersCount.count} customers accept marketing`;
    }
  } catch {
    /* scope may be missing */
  }
  try {
    const data = await client.gql<{
      customers: { nodes: Array<{ id: string }> };
    }>(`{ customers(first: 1, query: "tag:newsletter") { nodes { id } } }`);
    return data.customers.nodes.length
      ? 'newsletter-tagged customers exist (count query unavailable)'
      : 'no customers tagged newsletter — visitors may have signed up without Email marketing consent';
  } catch {
    return 'customer read scope not granted — check Admin → Customers for Email marketing = subscribed';
  }
}

async function main() {
  const previewOnly = process.argv.includes('--preview');
  if (previewOnly) {
    const preview = {
      pages: JOURNAL_PAGES,
      redirects: NEWS_REDIRECTS,
      collections: SHOPPING_COLLECTION_HANDLES,
      expectedJournal: EXPECTED_JOURNAL_HANDLES,
    };
    await mkdir('out', { recursive: true });
    await writeFile('out/store-merchandising-preview.json', JSON.stringify(preview, null, 2));
    console.log('Preview merchandising: Pre-Owned Maison + watches → Shop/Google; Journal pages/articles.');
    for (const p of JOURNAL_PAGES) console.log(`page\t${p.handle}\t${p.title}`);
    return;
  }

  const dryRun = process.argv.includes('--dry-run');
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN is not set');
  const client = new ShopifyClient(domain, await resolveToken(domain));
  const { shop } = await client.verifyAuth();
  console.log(`Store merchandising → ${shop} (${dryRun ? 'DRY RUN' : 'LIVE'})`);

  const publications = await client.listPublications();
  const picked = pickSalesPublications(publications);
  console.log('Publications:', publications.map((p) => p.name).join(', ') || '(none)');
  if (!picked.shop) {
    console.warn('Shop channel is not installed. Admin → Sales channels → Shop.');
  }
  if (!picked.google) {
    console.warn('Google & YouTube is not installed. Admin → Sales channels → Google & YouTube, then connect Merchant Center.');
  }

  const published: string[] = [];
  const errors: string[] = [];
  const collectionCounts: Record<string, number> = {};
  const channelIds = [picked.shop, picked.google]
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => p.id);

  if (!channelIds.length) {
    console.warn('Skipping product publish — install Shop and/or Google & YouTube first.');
  } else if (!dryRun) {
    const seen = new Set<string>();
    for (const handle of SHOPPING_COLLECTION_HANDLES) {
      const col = await loadCollection(client, handle);
      if (!col) {
        errors.push(`collection ${handle} not found`);
        continue;
      }
      collectionCounts[handle] = col.productIds.length;
      console.log(`collection ${handle}: ${col.productIds.length} products`);
      for (const publicationId of channelIds) {
        const pubErrors = await client.publishResource(col.id, publicationId);
        if (pubErrors.length) errors.push(`${handle} collection: ${pubErrors.join('; ')}`);
      }
      for (const id of col.productIds) {
        if (seen.has(id)) continue;
        seen.add(id);
        for (const publicationId of channelIds) {
          const pubErrors = await client.publishResource(id, publicationId);
          if (pubErrors.length) errors.push(`${id}: ${pubErrors.join('; ')}`);
        }
        published.push(id);
      }
    }
  } else {
    for (const handle of SHOPPING_COLLECTION_HANDLES) {
      const col = await loadCollection(client, handle);
      collectionCounts[handle] = col?.productIds.length ?? 0;
      console.log(`collection ${handle}: ${collectionCounts[handle]} products`);
    }
  }

  const pages: string[] = [];
  for (const page of JOURNAL_PAGES) {
    pages.push(await ensurePage(client, page, dryRun));
    console.log(pages[pages.length - 1]);
  }
  const redirects: string[] = [];
  for (const redirect of NEWS_REDIRECTS) {
    redirects.push(await ensureRedirect(client, redirect, dryRun));
    console.log(redirects[redirects.length - 1]);
  }

  let articles: ArticleRow[] = [];
  try {
    articles = await listJournalArticles(client);
    const liveHandles = new Set(articles.filter((a) => a.isPublished).map((a) => a.handle));
    for (const a of articles) {
      if (!a.isPublished) {
        if (dryRun) {
          console.log(`article\tHIDDEN\t${a.blog}/${a.handle}\t${a.title}`);
        } else {
          const pubErrors = await publishArticle(client, a.id);
          if (pubErrors.length) {
            errors.push(`${a.handle}: ${pubErrors.join('; ')}`);
            console.log(`article\tHIDDEN\t${a.blog}/${a.handle}\t${a.title}`);
          } else {
            a.isPublished = true;
            liveHandles.add(a.handle);
            console.log(`article\tPUBLISHED\t${a.blog}/${a.handle}\t${a.title}`);
          }
        }
      } else {
        console.log(`article\tLIVE\t${a.blog}/${a.handle}\t${a.title}`);
      }
    }
    for (const handle of EXPECTED_JOURNAL_HANDLES) {
      if (!liveHandles.has(handle) && !articles.some((a) => a.handle === handle)) {
        errors.push(`missing journal article ${handle}`);
      } else if (!liveHandles.has(handle)) {
        errors.push(`journal article ${handle} is not published`);
      }
    }
  } catch (err) {
    errors.push(`articles: ${err instanceof Error ? err.message : String(err)}`);
  }

  const subscribers = dryRun ? 'skipped' : await subscriberSnapshot(client);
  console.log(`Subscribers: ${subscribers}`);

  const summary = {
    shop,
    dryRun,
    publications: publications.map((p) => p.name),
    shopChannel: picked.shop?.name ?? null,
    googleChannel: picked.google?.name ?? null,
    collectionCounts,
    publishedProductCount: published.length,
    pages,
    redirects,
    articles: articles.map(({ handle, title, isPublished, blog }) => ({
      handle,
      title,
      isPublished,
      blog,
    })),
    subscribers,
    errors,
  };
  await mkdir('out', { recursive: true });
  await writeFile('out/store-merchandising.json', JSON.stringify(summary, null, 2));
  if (errors.length) {
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
