import {
  BugDiagnosticEvent,
  BugDiagnosticEventInput
} from '../models/bug-diagnostic.models';
import {
  BugNetworkDiagnosticEventInput,
  BugNetworkDiagnosticRequestContext
} from './bug-network-diagnostic.models';

const PATH_BASE = 'http://bug-reporting.local';

export function normalizeEndpoint(url: string): string {
  const parsedUrl = new URL(url, PATH_BASE);
  const path = parsedUrl.pathname.replace(/\/+/g, '/');

  const normalizedSegments = path
    .split('/')
    .filter(Boolean)
    .map(segment => normalizePathSegment(segment));

  return `/${normalizedSegments.join('/')}` || '/';
}

export function normalizePathSegment(segment: string): string {
  if (isNumericSegment(segment)) {
    return ':id';
  }

  return segment;
}

export function isNumericSegment(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

export function buildNetworkDiagnosticInput(
  context: BugNetworkDiagnosticRequestContext,
  outcome: {
    statusCode: number;
    durationMs: number;
    success: boolean;
    timestamp?: string;
  }
): BugNetworkDiagnosticEventInput {
  return {
    method: context.method,
    normalizedEndpoint: normalizeEndpoint(context.url),
    statusCode: outcome.statusCode,
    durationMs: outcome.durationMs,
    success: outcome.success,
    timestamp: outcome.timestamp
  };
}

export function buildNetworkDiagnosticEvent(
  context: BugNetworkDiagnosticRequestContext,
  outcome: {
    statusCode: number;
    durationMs: number;
    success: boolean;
    timestamp?: string;
  }
): BugDiagnosticEvent {
  const input = buildNetworkDiagnosticInput(context, outcome);

  return {
    timestamp: input.timestamp ?? new Date().toISOString(),
    type: input.success ? 'API' : 'API_ERROR',
    action: 'HTTP_REQUEST',
    method: input.method,
    endpoint: input.normalizedEndpoint,
    statusCode: input.statusCode,
    durationMs: input.durationMs,
    success: input.success
  };
}

export function toBugDiagnosticEventInput(
  context: BugNetworkDiagnosticRequestContext,
  outcome: {
    statusCode: number;
    durationMs: number;
    success: boolean;
    timestamp?: string;
  }
): BugDiagnosticEventInput {
  const input = buildNetworkDiagnosticInput(context, outcome);

  return {
    type: input.success ? 'API' : 'API_ERROR',
    action: 'HTTP_REQUEST',
    method: input.method,
    endpoint: input.normalizedEndpoint,
    statusCode: input.statusCode,
    durationMs: input.durationMs,
    success: input.success,
    timestamp: input.timestamp
  };
}