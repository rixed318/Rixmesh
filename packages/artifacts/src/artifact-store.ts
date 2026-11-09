import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export interface StoredArtifact {
  id: string;
  runId: string;
  type: 'patch' | 'test_log' | 'review' | 'task_result';
  path: string;
  sha256: string;
  createdAt: string;
}

export class ArtifactStore {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  public async saveArtifact(
    runId: string,
    type: 'patch' | 'test_log' | 'review' | 'task_result',
    filename: string,
    content: string | Buffer
  ): Promise<StoredArtifact> {
    const runArtifactsDir = path.join(this.baseDir, 'artifacts', runId);
    await fs.mkdir(runArtifactsDir, { recursive: true });

    const targetFile = path.join(runArtifactsDir, filename);
    await fs.writeFile(targetFile, content);

    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const artifact: StoredArtifact = {
      id: `art-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      runId,
      type,
      path: targetFile,
      sha256: hash,
      createdAt: new Date().toISOString(),
    };

    return artifact;
  }

  public async readArtifact(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  public async getArtifactContent(runId: string, filename: string): Promise<string | null> {
    const targetFile = path.join(this.baseDir, 'artifacts', runId, filename);
    try {
      return await fs.readFile(targetFile, 'utf-8');
    } catch {
      return null;
    }
  }
}
