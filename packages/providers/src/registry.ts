import { CodingAgentAdapter, ProviderProbeResult } from './adapter-interface.js';
import { GeminiProvider } from './gemini-provider.js';
import { CodexProvider } from './codex-provider.js';
import { ClaudeProvider } from './claude-provider.js';
import { OpenCodeProvider } from './opencode-provider.js';
import { MockProvider } from './mock-provider.js';

export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private adapters = new Map<string, CodingAgentAdapter>();
  private defaultProviderId = 'gemini';

  private constructor() {
    this.register(new GeminiProvider());
    this.register(new CodexProvider());
    this.register(new ClaudeProvider());
    this.register(new OpenCodeProvider());
    this.register(new MockProvider());
  }

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  public register(adapter: CodingAgentAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  public setDefaultProviderId(id: string): void {
    if (!this.adapters.has(id)) {
      throw new Error(`Cannot set default provider to unregistered adapter '${id}'`);
    }
    this.defaultProviderId = id;
  }

  public getDefaultProviderId(): string {
    return this.defaultProviderId;
  }

  public get(id: string): CodingAgentAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`Provider adapter '${id}' is not registered`);
    }
    return adapter;
  }

  public has(id: string): boolean {
    return this.adapters.has(id);
  }

  public async probeAll(): Promise<Record<string, ProviderProbeResult & { name: string }>> {
    const results: Record<string, ProviderProbeResult & { name: string }> = {};
    for (const [id, adapter] of this.adapters.entries()) {
      const probe = await adapter.probe();
      results[id] = { ...probe, name: adapter.name };
    }
    return results;
  }

  /**
   * Resolves the requested provider, falling back safely if unavailable.
   */
  public async resolveProvider(requestedId?: string): Promise<{ adapter: CodingAgentAdapter; isFallback: boolean; fallbackReason?: string }> {
    const targetId = requestedId || this.defaultProviderId;
    const adapter = this.adapters.get(targetId);

    if (adapter) {
      const probe = await adapter.probe();
      if (probe.available) {
        return { adapter, isFallback: false };
      }
      // If requested was unavailable, fallback
      const fallback = this.adapters.get('mock') || this.adapters.get('gemini')!;
      return {
        adapter: fallback,
        isFallback: true,
        fallbackReason: `Requested provider '${targetId}' is unavailable (${probe.reason}). Falling back to '${fallback.id}'.`,
      };
    }

    const fallback = this.adapters.get('mock') || this.adapters.get('gemini')!;
    return {
      adapter: fallback,
      isFallback: true,
      fallbackReason: `Requested provider '${targetId}' not found. Falling back to '${fallback.id}'.`,
    };
  }
}
