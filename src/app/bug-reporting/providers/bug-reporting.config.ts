import { InjectionToken } from '@angular/core';
import { BugReportOutputFormat } from '../bug-report-form/bug-report-form.models';

export type BugReportSubmissionMode = 'console' | 'post';

export interface BugReportingConfig {
  enabled: boolean;
  trackClicks: boolean;
  trackHttp: boolean;
  trackNavigation: boolean;
  trackErrors: boolean;
  defaultOutputFormat: BugReportOutputFormat;
  submissionMode: BugReportSubmissionMode;
  submitUrl: string | null;
  appVersion: string;
}

export const DEFAULT_BUG_REPORTING_CONFIG: BugReportingConfig = {
  enabled: true,
  trackClicks: true,
  trackHttp: true,
  trackNavigation: true,
  trackErrors: true,
  defaultOutputFormat: 'TABLE',
  submissionMode: 'console',
  submitUrl: null,
  appVersion: 'bug-reporting-prototype'
};

export const BUG_REPORTING_CONFIG = new InjectionToken<BugReportingConfig>('BUG_REPORTING_CONFIG');

export function createBugReportingConfig(config: Partial<BugReportingConfig> = {}): BugReportingConfig {
  return {
    ...DEFAULT_BUG_REPORTING_CONFIG,
    ...config
  };
}