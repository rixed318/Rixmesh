import { describe, it, expect } from 'vitest';
import { isValidTransition, TaskSchema, AgentRoleSchema } from '@rixed-devos/domain';

describe('Domain State Machine & Schemas', () => {
  it('should enforce legal state transitions', () => {
    expect(isValidTransition('DRAFT', 'SPECIFIED')).toBe(true);
    expect(isValidTransition('SPECIFIED', 'READY')).toBe(true);
    expect(isValidTransition('READY', 'QUEUED')).toBe(true);
    expect(isValidTransition('QUEUED', 'RUNNING')).toBe(true);
    expect(isValidTransition('RUNNING', 'VERIFYING')).toBe(true);
    expect(isValidTransition('VERIFYING', 'REVIEW_PENDING')).toBe(true);
    expect(isValidTransition('REVIEW_PENDING', 'MERGE_READY')).toBe(true);
    expect(isValidTransition('MERGE_READY', 'DONE')).toBe(true);
  });

  it('should reject illegal state transitions', () => {
    expect(isValidTransition('DRAFT', 'DONE')).toBe(false);
    expect(isValidTransition('DONE', 'RUNNING')).toBe(false);
    expect(isValidTransition('REVIEW_PENDING', 'DONE')).toBe(false); // must pass MERGE_READY first
  });

  it('should validate task schema', () => {
    const valid = TaskSchema.safeParse({
      id: 'TASK-100',
      projectId: 'proj-1',
      title: 'Setup Database',
      assigneeRoleId: 'backend-developer',
    });
    expect(valid.success).toBe(true);
  });
});
