import path from 'node:path';
import picomatch from 'picomatch';

export class PathScopeValidator {
  private static defaultForbidden = [
    '.git/**',
    '.git',
    '.env*',
    'secrets/**',
    '**/*id_rsa*',
    '**/*id_ed25519*',
  ];

  /**
   * Checks if a target file path is safe to write to, given allowed globs and forbidden globs.
   */
  public static isPathAllowed(
    filePath: string,
    allowedScopes: string[] = ['**/*'],
    forbiddenScopes: string[] = []
  ): { allowed: boolean; reason?: string } {
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
      return { allowed: false, reason: `Path does not match allowed write scopes: ${allowedScopes.join(', ')}` };
    }

    return { allowed: true };
  }
}
