import { BugDiagnosticHttpMethod } from '../models/bug-diagnostic.models';

export interface BugNetworkDiagnosticEventInput {
  method: BugDiagnosticHttpMethod;
  normalizedEndpoint: string;
  statusCode: number;
  durationMs: number;
  success: boolean;
  timestamp?: string;
}

export interface BugNetworkDiagnosticRequestContext {
  method: BugDiagnosticHttpMethod;
  url: string;
}