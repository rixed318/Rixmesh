import { CodingAgentAdapter, ProviderProbeResult } from './adapter-interface.js';
import { GeminiProvider } from './gemini-provider.js';
import { CodexProvider } from './codex-provider.js';
import { ClaudeProvider } from './claude-provider.js';
import { OpenCodeProvider } from './opencode-provider.js';
import { MockProvider } from './mock-provider.js';

export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private adapters = new Map<string, CodingAgentAdapter>();

  private constructor() {
    this.register(new GeminiProvider()); // Primary!
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
}
