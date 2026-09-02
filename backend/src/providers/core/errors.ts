export class ProviderError extends Error {
  constructor(
    message: string,
    readonly providerId: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export class ProviderCapabilityError extends ProviderError {
  constructor(
    providerId: string,
    readonly capability: string,
    message = `Provider ${providerId} does not support ${capability}`,
  ) {
    super(message, providerId);
    this.name = "ProviderCapabilityError";
  }
}
