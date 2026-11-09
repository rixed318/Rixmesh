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
   * Resolves the requested provider, strictly forbidding silent fallback to MockProvider.
   * MockProvider is only permitted if explicitly requested or in test mode.
   */
  public async resolveProvider(
    requestedId?: string,
    options?: { allowMock?: boolean }
  ): Promise<{ adapter: CodingAgentAdapter; isFallback: boolean; fallbackReason?: string }> {
    const targetId = requestedId || this.defaultProviderId;
    const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

    if (targetId === 'mock') {
      if (!options?.allowMock && !isTestEnv && process.env.DEVOS_ALLOW_MOCK !== 'true') {
        throw new Error(
          `MockProvider is disabled in production/user mode. Select an active provider (gemini, codex, claude).`
        );
      }
      return { adapter: this.get('mock'), isFallback: false };
    }

    const adapter = this.adapters.get(targetId);
    if (!adapter) {
      if (isTestEnv || options?.allowMock) {
        const fallback = this.adapters.get('mock') || this.adapters.get('gemini')!;
        return {
          adapter: fallback,
          isFallback: true,
          fallbackReason: `Requested provider '${targetId}' not found. Falling back to '${fallback.id}'.`,
        };
      }
      throw new Error(`Provider adapter '${targetId}' is not registered`);
    }

    const probe = await adapter.probe();
    if (probe.available) {
      return { adapter, isFallback: false };
    }

    // Provider is unavailable! Silent fallback to Mock is strictly prohibited.
    if (options?.allowMock) {
      const mock = this.adapters.get('mock');
      if (mock) {
        return {
          adapter: mock,
          isFallback: true,
          fallbackReason: `Requested provider '${targetId}' is unavailable (${probe.reason}). Explicit mock fallback allowed.`,
        };
      }
    }

    throw new Error(
      `Requested provider '${targetId}' is unavailable: ${probe.reason || 'probe failed'}. Please configure '${targetId}' or select an active provider.`
    );
  }
}
