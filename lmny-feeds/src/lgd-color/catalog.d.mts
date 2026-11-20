// Types for catalog.mjs, so TypeScript callers (belgium.ts) are checked.
export type Stone = Record<string, unknown> & { stock: string; handle: string; certificate: string; retail: number };
export interface ColoredProduct { id?: string; handle: string; tags: string[]; status?: string; certificate?: string; [k: string]: unknown }
export const FEED_TAG: string;
export const PREFIX: string;
export const BELGIUM_TAG: string;
export const BELGIUM_PREFIX: string;
export const COLORS: Set<string>;
export const INTENSITIES: Set<string>;
export const CLARITIES: Set<string>;
export const SHAPES: Map<string, string>;
export function ownsLgd(p: ColoredProduct): boolean;
export function ownsBelgium(p: ColoredProduct): boolean;
export function titleCase(v: unknown): string;
export function certificateFromUrl(v: unknown): string | null;
export function normalizeRow(r: Record<string, unknown>): { stone?: Stone; reason?: string };
export function normalizeFeed(rows: Record<string, unknown>[]): { stones: Stone[]; holds: Record<string, number> };
export function payloadFor(s: Record<string, unknown>, existing?: unknown, status?: string, locationId?: string): any;
export function snapshotHash(value: unknown): string;
export function fetchInventory(key: string | undefined, fetcher?: typeof fetch): Promise<Record<string, unknown>[]>;
