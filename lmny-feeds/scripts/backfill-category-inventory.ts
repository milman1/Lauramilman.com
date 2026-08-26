/**
 * One-off / resumable backfill: Shopify Category + qty 1 on every ACTIVE product.
 *
 * Does not activate drafts or archived products. Does not restock tracked
 * unique pieces that are already at qty 0 (sold).
 *
 *   npx tsx scripts/backfill-category-inventory.ts --dry-run
 *   npx tsx scripts/backfill-category-inventory.ts
 *
 * Requires write_products. Qty writes also need write_inventory.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { exchangeClientCredentials, ShopifyClient } from '../src/shopify.js';
import { UNIQUE_QUANTITY, planActiveMerchandising } from '../src/activeMerchandising.js';

function parseArgs(argv: string[]): { dryRun: boolean; limit: number | null } {
  const dryRun = argv.includes('--dry-run');
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  return { dryRun, limit: limitArg ? Number(limitArg.split('=')[1]) : null };
}

async function token(domain: string): Promise<string> {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  if (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET) {
    const exchanged = await exchangeClientCredentials(
      domain,
      process.env.SHOPIFY_CLIENT_ID,
      process.env.SHOPIFY_CLIENT_SECRET,
    );
    return exchanged.token;
  }
  throw new Error('Set SHOPIFY_ADMIN_TOKEN or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET');
}

async function main() {
  const { dryRun, limit } = parseArgs(process.argv.slice(2));
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN is not set');

  const client = new ShopifyClient(domain, await token(domain));
  const { shop } = await client.verifyAuth();
  console.log(`Category + qty backfill starting for ${shop} (${dryRun ? 'DRY RUN' : 'LIVE'})`);

  const scopes = await client.grantedScopes();
  const canWriteProducts = scopes.includes('write_products');
  const canWriteInventory = scopes.includes('write_inventory');
  if (!dryRun && !canWriteProducts) {
    throw new Error(`Refusing to write: missing write_products (granted: ${scopes.join(', ') || 'none'})`);
  }
  if (!canWriteInventory) {
    console.warn('write_inventory is not granted — category can still be set; qty 1 will be skipped.');
  }

  const locationId = canWriteInventory || dryRun ? await client.primaryLocationId().catch((err) => {
    console.warn(`inventory location: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }) : undefined;
  if (locationId) console.log(`Inventory location: ${locationId}`);

  console.log('Reading ACTIVE products…');
  const allRows = await client.fetchActiveMerchandising();
  const rows = limit ? allRows.slice(0, limit) : allRows;
  const plan = planActiveMerchandising(rows);
  console.log(
    `Active products: ${rows.length}. Category updates: ${plan.categoryUpdates.length}. ` +
      `Enable tracking: ${plan.trackIds.length}. Set qty ${UNIQUE_QUANTITY}: ${plan.quantityItemIds.length}. ` +
      `Already qty ${UNIQUE_QUANTITY}: ${plan.alreadyOk}. Sold-out left alone: ${plan.skippedSoldOut}.`,
  );

  const errors: string[] = [];
  let categoriesWritten = 0;
  let tracked = 0;
  let quantitiesSet = 0;

  if (!dryRun) {
    if (plan.categoryUpdates.length > 0) {
      console.log(`Writing ${plan.categoryUpdates.length} categories via bulk productUpdate…`);
      const result = await client.bulkProductUpdate(
        plan.categoryUpdates.map((u) => ({ id: u.id, category: u.to })),
      );
      categoriesWritten = result.ids.length;
      errors.push(...result.errors);
    }

    if (canWriteInventory && locationId) {
      for (const id of plan.trackIds) {
        const itemErrors = await client.setInventoryTracked(id, true);
        if (itemErrors.length) errors.push(`track ${id}: ${itemErrors.join('; ')}`);
        else tracked += 1;
        if (tracked % 200 === 0 && tracked > 0) console.log(`Tracked ${tracked}/${plan.trackIds.length}…`);
      }

      const qtyErrors = await client.setAvailableQuantities(
        locationId,
        plan.quantityItemIds.map((inventoryItemId) => ({ inventoryItemId, quantity: UNIQUE_QUANTITY })),
      );
      if (qtyErrors.length === 0) {
        quantitiesSet = plan.quantityItemIds.length;
      } else {
        errors.push(...qtyErrors.map((e) => `qty: ${e}`));
        console.log('Batch qty write had errors; setting remaining items one at a time…');
        for (const inventoryItemId of plan.quantityItemIds) {
          const activateErrors = await client.activateInventory(inventoryItemId, locationId, UNIQUE_QUANTITY);
          if (activateErrors.length && !activateErrors.some((m) => /already stocked/i.test(m))) {
            errors.push(`activate ${inventoryItemId}: ${activateErrors.join('; ')}`);
          }
          const retry = await client.setAvailableQuantities(locationId, [
            { inventoryItemId, quantity: UNIQUE_QUANTITY },
          ]);
          if (retry.length) errors.push(`qty ${inventoryItemId}: ${retry.join('; ')}`);
          else quantitiesSet += 1;
        }
      }
    } else if (plan.quantityItemIds.length > 0) {
      console.warn(`Skipping ${plan.quantityItemIds.length} qty writes (no write_inventory or location).`);
    }
  }

  const summary = {
    shop,
    dryRun,
    activeProducts: rows.length,
    categoryUpdates: plan.categoryUpdates.length,
    trackIds: plan.trackIds.length,
    quantityItemIds: plan.quantityItemIds.length,
    skippedSoldOut: plan.skippedSoldOut,
    alreadyOk: plan.alreadyOk,
    categoriesWritten,
    tracked,
    quantitiesSet,
    sampleCategoryUpdates: plan.categoryUpdates.slice(0, 15).map((u) => ({
      handle: u.handle,
      from: u.from,
      to: u.to,
    })),
    errors,
  };

  await mkdir('out', { recursive: true });
  await writeFile('out/category-inventory-backfill.json', JSON.stringify(summary, null, 2));
  console.log(
    dryRun
      ? 'Dry run complete — zero Shopify writes. See out/category-inventory-backfill.json'
      : `Done. categories=${categoriesWritten} tracked=${tracked} qty=${quantitiesSet} errors=${errors.length}`,
  );
  if (errors.length > 0) {
    for (const e of errors.slice(0, 40)) console.error(`  - ${e}`);
    if (errors.length > 40) console.error(`  … ${errors.length - 40} more`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
