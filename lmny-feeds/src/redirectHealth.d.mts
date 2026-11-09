export function checkRedirect(row: {path:string;target:string}, fetcher?: typeof fetch): Promise<{path:string;status:string}>;
