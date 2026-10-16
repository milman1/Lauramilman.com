// Only enumerated diagnostic codes and numeric metadata may leave this boundary.
export class SyncError extends Error {
  constructor(code, details={}) {
    super(code);
    this.code=code;
    this.details=Object.fromEntries(Object.entries(details).filter(([,v])=>Number.isFinite(v)));
  }
}
export function safeFailure(error, stage) {
  return {stage,code:error instanceof SyncError ? error.code : 'operation_failed',
    ...(error instanceof SyncError && /^lg-color-[a-z0-9_-]+$/.test(error.handle??'') ? {handle:error.handle}:{}),
    ...(error instanceof SyncError ? error.details : {})};
}
