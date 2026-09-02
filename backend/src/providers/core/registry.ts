import type { MusicProvider } from "./types.js";

export class ProviderRegistry {
  private readonly providers = new Map<string, MusicProvider>();

  register(provider: MusicProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): MusicProvider | undefined {
    return this.providers.get(id);
  }

  list(): MusicProvider[] {
    return [...this.providers.values()];
  }
}

export const providerRegistry = new ProviderRegistry();
