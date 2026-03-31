import type { Dayjs } from 'dayjs';

export type AuditLogFilterState = {
  httpMethod?: string;
  requestPath?: string;
  operatorUsername?: string;
  success?: boolean;
  range?: [Dayjs, Dayjs] | null;
};

export const DEFAULT_AUDIT_FILTERS: AuditLogFilterState = {
  httpMethod: undefined,
  requestPath: '',
  operatorUsername: '',
  success: undefined,
  range: null,
};
