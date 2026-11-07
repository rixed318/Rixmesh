import { AgentRole, Task } from '@rixed-devos/domain';

export type ProviderStatus =
  | 'implemented'
  | 'tested-live'
  | 'tested-mock'
  | 'experimental'
  | 'unavailable';

export interface ProviderProbeResult {
  available: boolean;
  status: ProviderStatus;
  reason?: string;
  capabilities: string[];
  models: string[];
}

export interface AgentSessionInput {
  cwd: string;
  role: AgentRole;
  task: Task;
  instructions: string;
  baselineCommit: string;
  model?: string;
  allowedTools: string[];
}

export interface AgentEvent {
  type:
    | 'started'
    | 'message_delta'
    | 'tool_started'
    | 'tool_completed'
    | 'permission_requested'
    | 'usage_reported'
    | 'artifact_emitted'
    | 'error'
    | 'finished';
  seq: number;
  timestamp: string;
  payload: any;
}

export interface CodingAgentAdapter {
  readonly id: string;
  readonly name: string;
  probe(): Promise<ProviderProbeResult>;
  startSession(input: AgentSessionInput): Promise<{ sessionId: string }>;
  send(sessionId: string, message: string): AsyncIterable<AgentEvent>;
  cancel(sessionId: string): Promise<void>;
  close(sessionId: string): Promise<void>;
}
