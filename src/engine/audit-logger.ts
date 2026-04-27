import { PrismaClient } from '@prisma/client';

export type AuditCategory = 'ITEM_DROP' | 'TRANSACTION' | 'EXPLOIT_FLAG' | 'MISSION_PAYOUT';
export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export class AuditLogger {
  constructor(private readonly db: PrismaClient) {}

  async log(params: {
    category: AuditCategory;
    severity: AuditSeverity;
    message: string;
    characterId?: string;
    metadata?: any;
  }) {
    return this.db.auditLog.create({
      data: {
        category: params.category,
        severity: params.severity,
        message: params.message,
        characterId: params.characterId,
        metadata: params.metadata || {}
      }
    });
  }

  async logExploit(characterId: string, message: string, metadata?: any) {
    return this.log({
      category: 'EXPLOIT_FLAG',
      severity: 'CRITICAL',
      message,
      characterId,
      metadata
    });
  }

  async logTransaction(characterId: string, message: string, metadata?: any) {
    return this.log({
      category: 'TRANSACTION',
      severity: 'INFO',
      message,
      characterId,
      metadata
    });
  }
}
