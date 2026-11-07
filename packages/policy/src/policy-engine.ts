import { AgentRole, Approval, RiskLevel } from '@rixed-devos/domain';

export interface ActionEvaluation {
  allowed: boolean;
  requiresApproval: boolean;
  risk: RiskLevel;
  reason?: string;
}

export class PolicyEngine {
  private static highRiskKeywords = [
    'rm -rf',
    'drop database',
    'truncate',
    'mkfs',
    'shutdown',
    'reboot',
    ':(){ :|:& };:',
    'curl | bash',
    'wget | bash',
    'chmod -R 777',
  ];

  /**
   * Evaluates whether an agent action or shell command can proceed directly
   * or requires human authorization.
   */
  public static evaluateAction(role: AgentRole, action: string, command?: string): ActionEvaluation {
    const permissions = role.spec.permissions;

    // Check dangerous shell commands
    if (command) {
      const lowerCmd = command.toLowerCase();
      for (const dangerous of this.highRiskKeywords) {
        if (lowerCmd.includes(dangerous)) {
          return {
            allowed: false,
            requiresApproval: true,
            risk: 'critical',
            reason: `Command contains high-risk pattern: "${dangerous}"`,
          };
        }
      }
    }

    // Check if role's manifest specifies approvalRequired for this action
    if (permissions.approvalRequired?.includes(action)) {
      return {
        allowed: false,
        requiresApproval: true,
        risk: 'high',
        reason: `Role '${role.metadata.name}' requires explicit approval for action '${action}'`,
      };
    }

    // Read-only roles cannot write
    if (role.spec.autonomy === 'read-only' && (action.includes('write') || action.includes('commit') || action.includes('merge'))) {
      return {
        allowed: false,
        requiresApproval: false,
        risk: 'medium',
        reason: `Role '${role.metadata.name}' is strictly read-only`,
      };
    }

    return {
      allowed: true,
      requiresApproval: false,
      risk: 'low',
    };
  }
}
