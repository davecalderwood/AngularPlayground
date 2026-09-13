export const BUG_CONFIDENCE_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;

export type BugConfidenceLevel = typeof BUG_CONFIDENCE_LEVELS[number];

export interface BugConfidenceResult {
  score: number;
  level: BugConfidenceLevel;
  reasons: string[];
}

export interface BugConfidenceRuleOptions {
  recentEventCount?: number;
  recentWindowMs?: number;
  mediumThreshold?: number;
  highThreshold?: number;
}