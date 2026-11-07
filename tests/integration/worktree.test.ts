import { describe, it, expect } from 'vitest';
import { GitWorktreeManager } from '@rixed-devos/workspaces';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

describe('GitWorktreeManager', () => {
  it('should isolate changes in a dedicated worktree and generate diff', async () => {
    const testRepo = await fs.mkdtemp(path.join(os.tmpdir(), 'devos-git-test-'));

    // Init git repo
    await execFileAsync('git', ['init'], { cwd: testRepo });
    await execFileAsync('git', ['config', 'user.name', 'test'], { cwd: testRepo });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: testRepo });

    // Initial commit
    const readmePath = path.join(testRepo, 'README.md');
    await fs.writeFile(readmePath, '# Test Repo\n');
    await execFileAsync('git', ['add', 'README.md'], { cwd: testRepo });
    await execFileAsync('git', ['commit', '-m', 'Initial commit'], { cwd: testRepo });
    await execFileAsync('git', ['branch', '-M', 'main'], { cwd: testRepo });

    const baseSha = await GitWorktreeManager.getHeadSha(testRepo);
    expect(baseSha).toBeDefined();

    // Create worktree for Task 101
    const wt = await GitWorktreeManager.createWorktree(testRepo, '101', 'run-1', baseSha);
    expect(wt.branch).toBe('devos/TASK-101');
    expect(await fs.stat(wt.worktreePath)).toBeDefined();

    // Make an edit inside worktree
    const newFilePath = path.join(wt.worktreePath, 'feature.ts');
    await fs.writeFile(newFilePath, 'export const feature = 42;\n');

    // Verify main repo does NOT have feature.ts (complete isolation!)
    const existsInMain = await fs.stat(path.join(testRepo, 'feature.ts')).catch(() => null);
    expect(existsInMain).toBeNull();

    // Commit in worktree
    const commitSha = await GitWorktreeManager.commitChanges(wt.worktreePath, 'feat: add feature');
    expect(commitSha).not.toBe(baseSha);

    // Merge into main
    const mergeResult = await GitWorktreeManager.mergeBranch(testRepo, wt.branch, 'main');
    expect(mergeResult.success).toBe(true);

    // Verify main repo now has the merged file!
    const mergedFile = await fs.readFile(path.join(testRepo, 'feature.ts'), 'utf-8');
    expect(mergedFile).toContain('export const feature = 42;');

    // Clean up worktree
    await GitWorktreeManager.removeWorktree(testRepo, wt.worktreePath);

    await fs.rm(testRepo, { recursive: true, force: true });
  });
});
