// Types for the Worker module, so the vitest suite can import it under strict TS.

export interface EngravingEnv {
  OPENAI_API_KEY?: string;
  ENGRAVING_IMAGE_MODEL?: string;
  ENGRAVING_ALLOWED_ORIGINS?: string;
  ENGRAVING_DAILY_CAP?: string;
  ENGRAVING_PER_IP_HOURLY?: string;
  FEED_CACHE?: {
    get(key: string, opts?: { type: 'arrayBuffer' }): Promise<any>;
    put(key: string, value: any, opts?: { expirationTtl?: number }): Promise<void>;
  };
}

export interface EngravingValue {
  text: string;
  font: 'Script' | 'Classic' | 'Block';
  metal: 'yellow' | 'white' | 'rose' | 'platinum';
  image: string;
}

export const ENGRAVING_ROUTE: string;
export const MAX_ENGRAVING_CHARS: number;
export const FONTS: Record<string, string>;
export const METALS: Record<string, string>;
export function allowedOrigins(env?: EngravingEnv): string[];
export function corsHeaders(origin: string, env?: EngravingEnv): Record<string, string>;
export function normalizeImageUrl(raw: unknown, env?: EngravingEnv): string | null;
export function normalizeEngravingText(raw: unknown): string;
export function validateEngravingRequest(
  body: unknown,
  env?: EngravingEnv,
): { ok: true; value: EngravingValue } | { ok: false; error: string };
export function buildEngravingPrompt(value: Pick<EngravingValue, 'text' | 'font' | 'metal'>): string;
export function cacheKey(value: EngravingValue): Promise<string>;
export function handleEngraving(
  request: Request,
  env: EngravingEnv,
  ctx?: { waitUntil(p: Promise<unknown>): void },
  fetchImpl?: typeof fetch,
): Promise<Response>;
