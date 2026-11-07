import path from 'node:path';
import fs from 'node:fs';
import picomatch from 'picomatch';

export interface PathValidationResult {
  allowed: boolean;
  reason?: string;
  canonicalPath?: string;
}

export class PathScopeValidator {
  public static readonly defaultForbidden = [
    '**/.git/**',
    '**/.git',
    '**/.env*',
    '**/secrets/**',
    '**/*id_rsa*',
    '**/*id_ed25519*',
    '**/*.pem',
    '**/*.key',
  ];

  /**
   * Fast lexical check against forbidden patterns and glob scopes.
   */
  public static isPathAllowed(
    filePath: string,
    allowedScopes: string[] = ['**/*'],
    forbiddenScopes: string[] = []
  ): PathValidationResult {
    // Normalize path and remove leading slashes
    const normalized = path.normalize(filePath).replace(/^(\.\/|\/)/, '');

    // Prevent directory traversal
    if (normalized.startsWith('..') || path.isAbsolute(filePath)) {
      return { allowed: false, reason: 'Path traversal or absolute path is forbidden' };
    }

    // Check forbidden list
    const allForbidden = [...this.defaultForbidden, ...forbiddenScopes];
    for (const pattern of allForbidden) {
      const isForbidden = picomatch(pattern, { dot: true });
      if (isForbidden(normalized)) {
        return { allowed: false, reason: `Path matches forbidden security pattern: ${pattern}` };
      }
    }

    // Check allowed list
    let matchedAllowed = false;
    for (const pattern of allowedScopes) {
      const isAllowed = picomatch(pattern, { dot: true });
      if (isAllowed(normalized)) {
        matchedAllowed = true;
        break;
      }
    }

    if (!matchedAllowed) {
      return {
        allowed: false,
        reason: `Path does not match allowed write scopes: ${allowedScopes.join(', ')}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Deep filesystem check verifying that target file resolves strictly within workspace root,
   * detecting symlinks pointing outside the workspace and realpath escapes.
   */
  public static isSafeFilesystemTarget(
    workspaceRoot: string,
    relativeFilePath: string,
    allowedScopes: string[] = ['**/*'],
    forbiddenScopes: string[] = []
  ): PathValidationResult {
    // 1. Lexical checks first
    const lexicalCheck = this.isPathAllowed(relativeFilePath, allowedScopes, forbiddenScopes);
    if (!lexicalCheck.allowed) {
      return lexicalCheck;
    }

    try {
      const rootCanonical = fs.realpathSync(workspaceRoot);
      const targetAbsolute = path.resolve(rootCanonical, relativeFilePath);

      // Verify prefix strictly matches rootCanonical
      if (!targetAbsolute.startsWith(rootCanonical + path.sep) && targetAbsolute !== rootCanonical) {
        return {
          allowed: false,
          reason: 'Path traversal detected: target resolves outside workspace root',
        };
      }

      // Check if file or existing ancestor is a symlink pointing outside
      let current = targetAbsolute;
      while (current !== rootCanonical && current !== path.dirname(current)) {
        if (fs.existsSync(current)) {
          const stats = fs.lstatSync(current);
          if (stats.isSymbolicLink()) {
            const real = fs.realpathSync(current);
            if (!real.startsWith(rootCanonical + path.sep) && real !== rootCanonical) {
              return {
                allowed: false,
                reason: `Symlink escape detected: ${current} points outside workspace (${real})`,
              };
            }
          }
        }
        current = path.dirname(current);
      }

      return { allowed: true, canonicalPath: targetAbsolute };
    } catch (err: any) {
      return { allowed: false, reason: `Filesystem resolution error: ${err.message}` };
    }
  }
}
