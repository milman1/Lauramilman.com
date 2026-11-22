// Types for sync.mjs, so TypeScript callers (belgium.ts) are checked.
import type { ColoredProduct } from './catalog.mjs';
export class SafeError extends Error {}
export function currentStage(): string;
export function withdrawalLimit(activeOwned: number, maxWithdrawals?: number | null): number;
export function emptySnapshotAction(source: ColoredSource, normalized: { stones?: unknown[]; holds?: Record<string, number>; colored?: number }): 'continue' | 'warn' | 'refuse';
export interface ColoredSource {
  name: string;
  fetchRows: () => Promise<Record<string, unknown>[]>;
  normalize: (rows: Record<string, unknown>[]) => { stones: Record<string, unknown>[]; holds: Record<string, number>; colored?: number; availability?: Record<string, number> };
  owns: (p: ColoredProduct) => boolean;
  reportPath: string;
  /** `warn` exits cleanly when every colored row is a recognized unavailable status. */
  emptyEligible?: 'warn';
}
export const LGD_SOURCE: ColoredSource;
export function planFor(stones: Record<string, unknown>[], catalog: ColoredProduct[], opts?: { limit?: number | null; activate?: boolean; locationId?: string; maxWithdrawals?: number | null; checkLimit?: boolean; owns?: (p: ColoredProduct) => boolean }): { writes: any[]; holds: any[]; skipped: Array<{ handle: string; reason: string }> };
export function main(argv?: string[], source?: ColoredSource): Promise<void>;
export function mediaReady(stone: Record<string, unknown>, fetcher?: typeof fetch): Promise<boolean>;
export function requestShopify(...args: unknown[]): Promise<any>;
export const OPS: Record<string, string>;
export function view(p: unknown): any;
