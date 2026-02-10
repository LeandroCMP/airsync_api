import { AuditEntry } from '../../core/audit/audit.service';

export interface AuditWrapped<T> {
  data: T;
  _audit: AuditEntry & { tenantId?: string };
}

export const withAudit = <T>(data: T, audit: AuditEntry & { tenantId?: string }): AuditWrapped<T> => ({
  ...((typeof data === 'object' && data) as any),
  _audit: audit
});
