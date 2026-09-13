import { Injectable } from '@angular/core';
import { BugConfidenceLevel, BugConfidenceResult, BugConfidenceRuleOptions } from '../models/bug-confidence.models';
import { BugDiagnosticEvent } from '../models/bug-diagnostic.models';
import { BugDiagnosticService } from './bug-diagnostic.service';

const DEFAULT_RECENT_EVENT_COUNT = 20;
const DEFAULT_RECENT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_MEDIUM_THRESHOLD = 35;
const DEFAULT_HIGH_THRESHOLD = 70;

const SCORE_CAP = 100;
const SCORE_FLOOR = 0;

const WEIGHTS = {
  serverError: 32,
  networkFailure: 35,
  uiError: 35,
  notFound: 18,
  clientRequestIssue: 12,
  unauthorized: 10,
  slowRequestOver10s: 18,
  slowRequestOver5s: 8,
  repeatedEndpointFailure: 14,
  repeatedSemanticClick: 10,
  bugReportSignal: 6,
  technicalBaseline: 5
} as const;

@Injectable({
  providedIn: 'root'
})
export class BugConfidenceService {
  readonly defaults = {
    recentEventCount: DEFAULT_RECENT_EVENT_COUNT,
    recentWindowMs: DEFAULT_RECENT_WINDOW_MS,
    mediumThreshold: DEFAULT_MEDIUM_THRESHOLD,
    highThreshold: DEFAULT_HIGH_THRESHOLD
  } as const;

  constructor(private readonly bugDiagnosticService: BugDiagnosticService) {}

  analyzeCurrentTimeline(options: BugConfidenceRuleOptions = {}): BugConfidenceResult {
    return this.analyzeEvents(this.bugDiagnosticService.getTimeline(), options);
  }

  analyzeEvents(events: readonly BugDiagnosticEvent[], options: BugConfidenceRuleOptions = {}): BugConfidenceResult {
    const normalizedOptions = this.resolveOptions(options);
    const recentEvents = this.getRecentEvents(events, normalizedOptions.recentEventCount, normalizedOptions.recentWindowMs);

    let score = 0;
    const reasons: string[] = [];

    score += this.applyStrongTechnicalEvidence(recentEvents, reasons);
    score += this.applyLatencyEvidence(recentEvents, reasons);
    score += this.applyRepeatedFailureEvidence(recentEvents, reasons);
    score += this.applyRepeatedClickEvidence(recentEvents, reasons);

    if (score === 0) {
      score = WEIGHTS.technicalBaseline;
      reasons.push('No strong technical evidence captured yet');
    }

    score = this.clampScore(score);

    return {
      score,
      level: this.resolveLevel(score, normalizedOptions.mediumThreshold, normalizedOptions.highThreshold),
      reasons: this.deduplicateReasons(reasons)
    };
  }

  resolveLevel(score: number, mediumThreshold = DEFAULT_MEDIUM_THRESHOLD, highThreshold = DEFAULT_HIGH_THRESHOLD): BugConfidenceLevel {
    if (score >= highThreshold) {
      return 'HIGH';
    }

    if (score >= mediumThreshold) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  getRecentEvents(
    events: readonly BugDiagnosticEvent[],
    recentEventCount = DEFAULT_RECENT_EVENT_COUNT,
    recentWindowMs = DEFAULT_RECENT_WINDOW_MS
  ): BugDiagnosticEvent[] {
    const orderedEvents = [...events].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const latestEvents = orderedEvents.slice(Math.max(0, orderedEvents.length - recentEventCount));
    const latestTimestamp = latestEvents.at(-1)?.timestamp;

    if (!latestTimestamp) {
      return [];
    }

    const latestTime = this.toMillis(latestTimestamp);

    return latestEvents.filter(event => latestTime - this.toMillis(event.timestamp) <= recentWindowMs);
  }

  countFailedEventsForEndpoint(events: readonly BugDiagnosticEvent[], endpoint: string): number {
    return events.filter(event => this.matchesEndpoint(event, endpoint) && this.isFailureEvent(event)).length;
  }

  countSemanticActionSequence(events: readonly BugDiagnosticEvent[], action: string): number {
    return events.filter(event => event.type === 'CLICK' && event.action === action).length;
  }

  private applyStrongTechnicalEvidence(events: readonly BugDiagnosticEvent[], reasons: string[]): number {
    let score = 0;

    for (const event of events) {
      if (event.type === 'UI_ERROR') {
        score += WEIGHTS.uiError;
        reasons.push('Angular/UI error detected');
        continue;
      }

      if (event.type === 'API_ERROR') {
        if (this.isNetworkFailure(event)) {
          score += WEIGHTS.networkFailure;
          reasons.push('Request timeout or network failure detected');
          continue;
        }

        if (event.statusCode && event.statusCode >= 500 && event.statusCode <= 599) {
          score += WEIGHTS.serverError;
          reasons.push(`HTTP ${event.statusCode} detected shortly before report`);
          continue;
        }

        if (event.statusCode === 404) {
          score += WEIGHTS.notFound;
          reasons.push('HTTP 404 detected');
          continue;
        }

        if (event.statusCode === 400 || event.statusCode === 409) {
          score += WEIGHTS.clientRequestIssue;
          reasons.push(`HTTP ${event.statusCode} detected`);
          continue;
        }

        if (event.statusCode === 401 || event.statusCode === 403) {
          score += WEIGHTS.unauthorized;
          reasons.push(`HTTP ${event.statusCode} detected`);
        }
      }

      if (event.type === 'API' && event.statusCode && event.statusCode >= 500 && event.statusCode <= 599) {
        score += WEIGHTS.serverError;
        reasons.push(`HTTP ${event.statusCode} detected shortly before report`);
      }
    }

    return score;
  }

  private applyLatencyEvidence(events: readonly BugDiagnosticEvent[], reasons: string[]): number {
    let score = 0;

    for (const event of events) {
      if (typeof event.durationMs !== 'number') {
        continue;
      }

      if (event.durationMs > 10000) {
        score += WEIGHTS.slowRequestOver10s;
        reasons.push(`Request took ${event.durationMs}ms`);
        continue;
      }

      if (event.durationMs > 5000) {
        score += WEIGHTS.slowRequestOver5s;
        reasons.push(`Request took ${event.durationMs}ms`);
      }
    }

    return score;
  }

  private applyRepeatedFailureEvidence(events: readonly BugDiagnosticEvent[], reasons: string[]): number {
    const failureCounts = new Map<string, number>();

    for (const event of events) {
      if (!this.isFailureEvent(event) || !event.endpoint) {
        continue;
      }

      const currentCount = failureCounts.get(event.endpoint) ?? 0;
      failureCounts.set(event.endpoint, currentCount + 1);
    }

    let score = 0;

    for (const [endpoint, count] of failureCounts.entries()) {
      if (count >= 2) {
        score += WEIGHTS.repeatedEndpointFailure;
        reasons.push(`Same endpoint failed ${count} times: ${endpoint}`);
      }
    }

    return score;
  }

  private applyRepeatedClickEvidence(events: readonly BugDiagnosticEvent[], reasons: string[]): number {
    const clickCounts = new Map<string, number>();

    for (const event of events) {
      if (event.type !== 'CLICK') {
        continue;
      }

      const count = clickCounts.get(event.action) ?? 0;
      clickCounts.set(event.action, count + 1);
    }

    let score = 0;

    for (const [action, count] of clickCounts.entries()) {
      if (count >= 3) {
        score += WEIGHTS.repeatedSemanticClick;
        reasons.push(`Same semantic action repeated ${count} times: ${action}`);
      }
    }

    return score;
  }

  private isFailureEvent(event: BugDiagnosticEvent): boolean {
    return event.success === false || event.type === 'API_ERROR' || event.type === 'UI_ERROR';
  }

  private isNetworkFailure(event: BugDiagnosticEvent): boolean {
    return event.success === false && (event.statusCode === 0 || event.statusCode === undefined);
  }

  private matchesEndpoint(event: BugDiagnosticEvent, endpoint: string): boolean {
    return event.endpoint === endpoint;
  }

  private resolveOptions(options: BugConfidenceRuleOptions): Required<BugConfidenceRuleOptions> {
    return {
      recentEventCount: options.recentEventCount ?? DEFAULT_RECENT_EVENT_COUNT,
      recentWindowMs: options.recentWindowMs ?? DEFAULT_RECENT_WINDOW_MS,
      mediumThreshold: options.mediumThreshold ?? DEFAULT_MEDIUM_THRESHOLD,
      highThreshold: options.highThreshold ?? DEFAULT_HIGH_THRESHOLD
    };
  }

  private clampScore(score: number): number {
    return Math.max(SCORE_FLOOR, Math.min(SCORE_CAP, Math.round(score)));
  }

  private deduplicateReasons(reasons: string[]): string[] {
    return Array.from(new Set(reasons));
  }

  private toMillis(timestamp: string): number {
    const parsed = Date.parse(timestamp);

    return Number.isFinite(parsed) ? parsed : 0;
  }
}