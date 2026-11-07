export class SecretRedactor {
  private static sensitivePatterns: RegExp[] = [
    // API keys & tokens
    /AIza[0-9A-Za-z-_]{35}/g,                                 // Google API Key
    /sk-[a-zA-Z0-9]{32,64}/g,                                 // OpenAI API Key
    /ghp_[a-zA-Z0-9]{36}/g,                                   // GitHub Personal Access Token
    /github_pat_[a-zA-Z0-9_]{82}/g,                           // GitHub Fine-grained PAT
    /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,32}/g, // Slack token
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,                         // Generic Bearer Token
    
    // Private keys
    /-----BEGIN [A-Z0-9\s]+PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9\s]+PRIVATE KEY-----/g,
    
    // Environment assignment of secrets
    /(?:password|passwd|secret|api_key|apikey|token|auth_token)\s*=\s*['"]?[^\s'";]+['"]?/gi,
  ];

  /**
   * Redacts sensitive secrets from input strings (logs, error messages, diffs).
   */
  public static redact(text: string): string {
    if (!text || typeof text !== 'string') return text;

    let redacted = text;
    for (const pattern of this.sensitivePatterns) {
      redacted = redacted.replace(pattern, (match) => {
        if (match.startsWith('Bearer ')) {
          return 'Bearer [REDACTED_TOKEN]';
        }
        if (match.includes('=')) {
          const [key] = match.split('=');
          return `${key}=[REDACTED_SECRET]`;
        }
        if (match.startsWith('-----BEGIN')) {
          return '-----BEGIN PRIVATE KEY-----\n[REDACTED_PRIVATE_KEY]\n-----END PRIVATE KEY-----';
        }
        return `[REDACTED_SECRET_${match.slice(0, 4)}...]`;
      });
    }

    return redacted;
  }

  /**
   * Recursively redacts secrets in JSON/object structures.
   */
  public static redactObject<T>(obj: T): T {
    if (!obj || typeof obj !== 'object') {
      if (typeof obj === 'string') {
        return this.redact(obj) as any;
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactObject(item)) as any;
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key')
      ) {
        result[key] = '[REDACTED_FIELD]';
      } else {
        result[key] = this.redactObject(value);
      }
    }
    return result;
  }
}

