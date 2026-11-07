import { z } from 'zod';

export const TaskStatusSchema = z.enum([
  'DRAFT',
  'SPECIFIED',
  'APPROVAL_REQUIRED',
  'READY',
  'QUEUED',
  'RUNNING',
  'VERIFYING',
  'REVIEW_PENDING',
  'MERGE_READY',
  'DONE',
  'BLOCKED',
  'FAILED',
  'CANCELLED',
  'WAITING_USER',
  'REWORK'
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const AutonomyLevelSchema = z.enum([
  'read-only',
  'spec-write',
  'test-write',
  'workspace-write',
  'full-autonomous'
]);
export type AutonomyLevel = z.infer<typeof AutonomyLevelSchema>;

export const ReviewVerdictSchema = z.enum(['approved', 'request_changes', 'blocked']);
export type ReviewVerdict = z.infer<typeof ReviewVerdictSchema>;

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  rootPath: z.string(),
  gitRemote: z.string().optional(),
  defaultBranch: z.string().default('main'),
  baselineSha: z.string().optional(),
  stack: z.string().default('typescript'),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type Project = z.infer<typeof ProjectSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string().default(''),
  specPath: z.string().optional(),
  status: TaskStatusSchema.default('DRAFT'),
  priority: TaskPrioritySchema.default('medium'),
  risk: RiskLevelSchema.default('low'),
  assigneeRoleId: z.string(),
  writeScope: z.array(z.string()).default(['**/*']),
  acceptanceCriteria: z.array(z.string()).default([]),
  testPlan: z.string().optional(),
  estimatedBudgetUsd: z.number().default(1.0),
  version: z.number().int().default(1),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
  updatedAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskDependencySchema = z.object({
  taskId: z.string(),
  dependsOnTaskId: z.string(),
  constraintType: z.enum(['finish_to_start', 'soft_hint']).default('finish_to_start'),
});
export type TaskDependency = z.infer<typeof TaskDependencySchema>;

export const RunSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  providerId: z.string(),
  modelId: z.string(),
  worktreePath: z.string().optional(),
  sessionId: z.string().optional(),
  status: z.enum(['active', 'completed', 'failed', 'cancelled', 'timeout']),
  leaseExpiresAt: z.string().datetime().optional(),
  exitCode: z.number().int().optional(),
  usage: z.object({
    tokensPrompt: z.number().default(0),
    tokensCompletion: z.number().default(0),
    costUsd: z.number().default(0),
  }).default({ tokensPrompt: 0, tokensCompletion: 0, costUsd: 0 }),
  startedAt: z.string().datetime().default(() => new Date().toISOString()),
  finishedAt: z.string().datetime().optional(),
});
export type Run = z.infer<typeof RunSchema>;

export const WorktreeSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  taskId: z.string(),
  branch: z.string(),
  path: z.string(),
  baselineSha: z.string(),
  resultSha: z.string().optional(),
  state: z.enum(['created', 'active', 'merged', 'pruned']).default('created'),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type Worktree = z.infer<typeof WorktreeSchema>;

export const ReviewFindingSchema = z.object({
  file: z.string(),
  line: z.number().optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical']),
  message: z.string(),
});
export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;

export const ReviewSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  runId: z.string().optional(),
  reviewerRoleId: z.string().default('code-reviewer'),
  verdict: ReviewVerdictSchema,
  summary: z.string(),
  findings: z.array(ReviewFindingSchema).default([]),
  diffSummary: z.string().optional(),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type Review = z.infer<typeof ReviewSchema>;

export const ApprovalSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  taskId: z.string(),
  runId: z.string().optional(),
  action: z.string(),
  command: z.string().optional(),
  reason: z.string(),
  status: ApprovalStatusSchema.default('pending'),
  requestedAt: z.string().datetime().default(() => new Date().toISOString()),
  decidedAt: z.string().datetime().optional(),
  decidedBy: z.string().optional(),
});
export type Approval = z.infer<typeof ApprovalSchema>;

export const AuditEventSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  taskId: z.string().optional(),
  runId: z.string().optional(),
  seq: z.number().int(),
  actor: z.string(),
  type: z.string(),
  payload: z.record(z.any()).default({}),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const TaskResultV1Schema = z.object({
  schemaVersion: z.literal('1.0'),
  taskId: z.string(),
  runId: z.string(),
  status: z.enum(['completed', 'failed', 'rework_needed']),
  summary: z.string(),
  baselineCommit: z.string(),
  resultCommit: z.string(),
  changedFiles: z.array(z.string()),
  tests: z.array(z.object({
    command: z.string(),
    exitCode: z.number().int(),
    reportPath: z.string().optional(),
    output: z.string().optional(),
  })).default([]),
  docsUpdated: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  blockedBy: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
  requiresHumanApproval: z.boolean().default(false),
});
export type TaskResultV1 = z.infer<typeof TaskResultV1Schema>;

export const AgentRoleSchema = z.object({
  apiVersion: z.string().default('devos/v1'),
  kind: z.literal('AgentRole'),
  metadata: z.object({
    name: z.string(),
    version: z.string(),
    title: z.string(),
  }),
  spec: z.object({
    purpose: z.string(),
    compatibleProviders: z.array(z.string()),
    modelPolicy: z.object({
      tier: z.string().default('high'),
      preferredModel: z.string().default('gemini-3.8-flash-high'),
      allowFallback: z.boolean().default(true),
    }),
    autonomy: AutonomyLevelSchema,
    limits: z.object({
      maxConcurrentTasks: z.number().default(1),
      maxAttempts: z.number().default(2),
      wallClockMinutes: z.number().default(30),
      estimatedBudgetUsd: z.number().optional(),
    }).optional(),
    permissions: z.object({
      read: z.array(z.string()).default(['**/*']),
      write: z.array(z.string()).default([]),
      forbidden: z.array(z.string()).default([]),
      tools: z.array(z.string()).default([]),
      network: z.enum(['denied', 'local-only', 'allowed']).default('denied'),
      approvalRequired: z.array(z.string()).default([]),
    }),
    skills: z.array(z.string()).default([]),
    outputSchema: z.string().optional(),
    review: z.object({
      requireIndependentReviewer: z.boolean().default(false),
      requireAutomatedTests: z.boolean().default(false),
    }).default({ requireIndependentReviewer: false, requireAutomatedTests: false }),
  }),
});
export type AgentRole = z.infer<typeof AgentRoleSchema>;

/**
 * Validates whether a state transition is legal in the Rixed DevOS lifecycle.
 */
export function isValidTransition(current: TaskStatus, next: TaskStatus): boolean {
  if (current === next) return true;

  const validTransitions: Record<TaskStatus, TaskStatus[]> = {
    DRAFT: ['SPECIFIED', 'CANCELLED'],
    SPECIFIED: ['APPROVAL_REQUIRED', 'READY', 'CANCELLED', 'BLOCKED'],
    APPROVAL_REQUIRED: ['READY', 'CANCELLED', 'WAITING_USER'],
    READY: ['QUEUED', 'RUNNING', 'CANCELLED', 'BLOCKED'],
    QUEUED: ['RUNNING', 'CANCELLED', 'BLOCKED'],
    RUNNING: ['VERIFYING', 'FAILED', 'CANCELLED', 'BLOCKED', 'WAITING_USER'],
    VERIFYING: ['REVIEW_PENDING', 'REWORK', 'FAILED', 'CANCELLED'],
    REVIEW_PENDING: ['MERGE_READY', 'REWORK', 'BLOCKED', 'CANCELLED'],
    MERGE_READY: ['DONE', 'BLOCKED', 'CANCELLED'],
    DONE: [], // Terminal
    BLOCKED: ['READY', 'CANCELLED', 'WAITING_USER'],
    FAILED: ['READY', 'QUEUED', 'CANCELLED'], // Can retry
    CANCELLED: ['DRAFT', 'READY'], // Can reopen
    WAITING_USER: ['READY', 'RUNNING', 'CANCELLED'],
    REWORK: ['READY', 'QUEUED', 'CANCELLED'],
  };

  return validTransitions[current]?.includes(next) ?? false;
}
