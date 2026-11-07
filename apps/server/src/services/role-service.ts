import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { AgentRole, AgentRoleSchema } from '@rixed-devos/domain';

export class RoleService {
  private rolesDir: string;
  private rolesCache = new Map<string, AgentRole>();

  constructor(rolesDir: string) {
    this.rolesDir = rolesDir;
  }

  public async loadRoles(): Promise<AgentRole[]> {
    this.rolesCache.clear();
    try {
      const files = await fs.readdir(this.rolesDir);
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          const filePath = path.join(this.rolesDir, file);
          const raw = await fs.readFile(filePath, 'utf-8');
          const parsed = yaml.load(raw);
          const validated = AgentRoleSchema.parse(parsed);
          this.rolesCache.set(validated.metadata.name, validated);
        }
      }
    } catch (err: any) {
      console.warn(`Could not read roles directory ${this.rolesDir}:`, err.message);
    }
    return Array.from(this.rolesCache.values());
  }

  public getRole(name: string): AgentRole | null {
    return this.rolesCache.get(name) || null;
  }

  public listRoles(): AgentRole[] {
    return Array.from(this.rolesCache.values());
  }
}
