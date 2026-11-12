export class ProviderError extends Error {
  parseError = false;
  retryable = false;

  constructor(message: string, options?: { parseError?: boolean; retryable?: boolean }) {
    super(message);
    this.parseError = Boolean(options?.parseError);
    this.retryable = Boolean(options?.retryable);
  }
}

export function isRepairable(error: unknown): error is ProviderError {
  return error instanceof ProviderError && error.parseError;
}
