import { describe, it, expect } from 'vitest';
import { PathScopeValidator } from '@rixed-devos/workspaces';

describe('PathScopeValidator', () => {
  it('should allow valid files matching scope', () => {
    const res = PathScopeValidator.isPathAllowed('apps/server/src/index.ts', ['apps/server/**']);
    expect(res.allowed).toBe(true);
  });

  it('should deny files outside allowed scope', () => {
    const res = PathScopeValidator.isPathAllowed('apps/web/src/index.ts', ['apps/server/**']);
    expect(res.allowed).toBe(false);
  });

  it('should strictly deny secrets, .env, and .git paths', () => {
    expect(PathScopeValidator.isPathAllowed('.env', ['**/*']).allowed).toBe(false);
    expect(PathScopeValidator.isPathAllowed('.env.local', ['**/*']).allowed).toBe(false);
    expect(PathScopeValidator.isPathAllowed('.git/config', ['**/*']).allowed).toBe(false);
    expect(PathScopeValidator.isPathAllowed('secrets/keys.json', ['**/*']).allowed).toBe(false);
  });

  it('should strictly deny path traversal attempts', () => {
    const res = PathScopeValidator.isPathAllowed('../../etc/passwd', ['**/*']);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain('Path traversal');
  });
});
