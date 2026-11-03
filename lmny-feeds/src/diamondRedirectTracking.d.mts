export function trackedDiamondTarget(handle: string, target: string): string;
export const REDIRECT_OPS: { list: string; create: string };
export function readRedirects(gql: (query: string, variables?: any) => Promise<any>): Promise<Array<{id: string; path: string; target: string}>>;
export function reconcileColoredRedirects(gql: (query: string, variables?: any) => Promise<any>, catalog: Array<{handle: string; tags: string[]; status: string}>, available: Set<string>, feedTag: string, budget?: number): Promise<{ensured: number; pending: number}>;
