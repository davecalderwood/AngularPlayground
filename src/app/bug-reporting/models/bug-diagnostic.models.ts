export const BUG_DIAGNOSTIC_EVENT_TYPES = [
  'CLICK',
  'NAVIGATION',
  'API',
  'API_ERROR',
  'UI_ERROR',
  'MODAL_OPEN',
  'MODAL_CLOSE',
  'PERFORMANCE',
  'BUG_REPORT'
] as const;

export type BugDiagnosticEventType = typeof BUG_DIAGNOSTIC_EVENT_TYPES[number];

export type BugDiagnosticHttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export interface BugDiagnosticEvent {
  timestamp: string;
  type: BugDiagnosticEventType;
  action: string;
  route?: string;
  method?: BugDiagnosticHttpMethod;
  endpoint?: string;
  statusCode?: number;
  durationMs?: number;
  success?: boolean;
}

export interface BugDiagnosticEventInput extends Omit<BugDiagnosticEvent, 'timestamp'> {
  timestamp?: string;
}

export interface BugDiagnosticSnapshot {
  generatedAt: string;
  totalEvents: number;
  events: readonly BugDiagnosticEvent[];
}