import { BugConfidenceResult } from '../models/bug-confidence.models';
import { BugDiagnosticSnapshot } from '../models/bug-diagnostic.models';

export const BUG_REPORT_CATEGORIES = [
  'Something is not working',
  'Incorrect information',
  'Page is slow',
  'Visual issue',
  'Other'
] as const;

export type BugReportCategory = typeof BUG_REPORT_CATEGORIES[number];

export interface BugReportFormValue {
  title: string;
  category: BugReportCategory;
  description: string;
  expectedBehavior: string;
}

export const BUG_REPORT_OUTPUT_FORMATS = ['JSON', 'TABLE'] as const;

export type BugReportOutputFormat = typeof BUG_REPORT_OUTPUT_FORMATS[number];

export interface BugReportPayload {
  report: {
    title: string;
    category: BugReportCategory;
    description: string;
    expectedBehavior: string;
  };
  environment: {
    route: string | null;
    timestamp: string;
    userAgent: string | null;
    appVersion: string;
  };
  diagnostics: BugDiagnosticSnapshot;
  confidence: BugConfidenceResult;
}
