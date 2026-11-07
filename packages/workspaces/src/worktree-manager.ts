import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';

const execFileAsync = promisify(execFile);

export interface WorktreeInfo {
  worktreePath: string;
  branch: string;
  baselineSha: string;
}

export class GitWorktreeManager {
  private static async runGit(args: string[], cwd: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', args, { cwd });
      return stdout.trim();
    } catch (err: any) {
      const stderr = err.stderr ? err.stderr.trim() : err.message;
      throw new Error(`Git command failed: git ${args.join(' ')}: ${stderr}`);
    }
  }

  public static async getHeadSha(repoPath: string): Promise<string> {
    return this.runGit(['rev-parse', 'HEAD'], repoPath);
  }

  public static async getCurrentBranch(repoPath: string): Promise<string> {
    return this.runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath);
  }

  /**
   * Creates an isolated worktree for a task.
   * Path: `<repoPath>/.devos/worktrees/task-<taskId>-<runId>`
   * Branch: `devos/TASK-<taskId>`
   */
  public static async createWorktree(
    repoPath: string,
    taskId: string,
    runId: string,
    baseSha?: string
  ): Promise<WorktreeInfo> {
    const baselineSha = baseSha || await this.getHeadSha(repoPath);
    const branch = `devos/TASK-${taskId}`;
    const worktreeDir = path.join(repoPath, '.devos', 'worktrees', `task-${taskId}-${runId}`);

    // Ensure parent dir
    await fs.mkdir(path.dirname(worktreeDir), { recursive: true });

    // Check if branch already exists
    let branchExists = false;
    try {
      await this.runGit(['rev-parse', '--verify', branch], repoPath);
      branchExists = true;
    } catch {
      branchExists = false;
    }

    if (branchExists) {
      await this.runGit(['worktree', 'add', worktreeDir, branch], repoPath);
    } else {
      await this.runGit(['worktree', 'add', '-b', branch, worktreeDir, baselineSha], repoPath);
    }

    return {
      worktreePath: worktreeDir,
      branch,
      baselineSha,
    };
  }

  /**
   * Returns git diff between working state and baseline SHA.
   */
  public static async getDiff(worktreePath: string, baseSha?: string): Promise<string> {
    // Stage untracked files with intent-to-add so git diff includes newly created files
    await this.runGit(['add', '-N', '.'], worktreePath).catch(() => {});
    if (baseSha) {
      return this.runGit(['diff', baseSha], worktreePath);
    }
    return this.runGit(['diff', 'HEAD'], worktreePath);
  }

  /**
   * Returns list of changed files relative to baseline.
   */
  public static async getChangedFiles(worktreePath: string, baseSha?: string): Promise<string[]> {
    const raw = await this.runGit(['status', '--porcelain'], worktreePath);
    if (!raw) return [];
    return raw
      .split('\n')
      .map(line => line.slice(3).trim())
      .filter(Boolean);
  }

  /**
   * Stages all changes and creates a commit.
   */
  public static async commitChanges(worktreePath: string, message: string): Promise<string> {
    await this.runGit(['add', '-A'], worktreePath);
    // Check if there is anything to commit
    const status = await this.runGit(['status', '--porcelain'], worktreePath);
    if (!status) {
      return this.runGit(['rev-parse', 'HEAD'], worktreePath);
    }
    await this.runGit(['commit', '-m', message], worktreePath);
    return this.runGit(['rev-parse', 'HEAD'], worktreePath);
  }

  /**
   * Safely removes the worktree and cleans git metadata.
   */
  public static async removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
    try {
      await this.runGit(['worktree', 'remove', '--force', worktreePath], repoPath);
    } catch {
      // If git worktree command failed, remove directory manually and prune
      await fs.rm(worktreePath, { recursive: true, force: true }).catch(() => {});
      await this.runGit(['worktree', 'prune'], repoPath).catch(() => {});
    }
  }

  /**
   * Merges a task branch into target branch (e.g. main).
   */
  public static async mergeBranch(
    repoPath: string,
    branchName: string,
    targetBranch: string = 'main'
  ): Promise<{ success: boolean; commitSha?: string; conflict?: boolean; error?: string }> {
    try {
      const current = await this.getCurrentBranch(repoPath);
      if (current !== targetBranch) {
        await this.runGit(['checkout', targetBranch], repoPath);
      }
      await this.runGit(['merge', '--no-ff', '-m', `Merge devos task branch ${branchName}`, branchName], repoPath);
      const commitSha = await this.getHeadSha(repoPath);
      return { success: true, commitSha };
    } catch (err: any) {
      // Abort merge on conflict
      await this.runGit(['merge', '--abort'], repoPath).catch(() => {});
      return { success: false, conflict: true, error: err.message };
    }
  }
}
