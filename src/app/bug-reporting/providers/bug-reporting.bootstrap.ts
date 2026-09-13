import { DOCUMENT } from '@angular/common';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { APP_INITIALIZER, EnvironmentProviders, ErrorHandler, Provider, inject, makeEnvironmentProviders } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { BugNetworkDiagnosticInterceptor } from '../network/bug-network-diagnostic.interceptor';
import { BugActivityTrackerService } from '../services/bug-activity-tracker.service';
import { BugDiagnosticService } from '../services/bug-diagnostic.service';
import { BUG_REPORTING_CONFIG, BugReportingConfig, createBugReportingConfig } from './bug-reporting.config';

class BugReportingErrorHandler implements ErrorHandler {
  constructor(private readonly bugDiagnosticService: BugDiagnosticService) {}

  handleError(error: unknown): void {
    this.bugDiagnosticService.addEvent({
      type: 'UI_ERROR',
      action: 'UNCAUGHT_ERROR',
      success: false
    });

    console.error(error);
  }
}

function initializeBugReporting(
  bugActivityTrackerService: BugActivityTrackerService,
  bugDiagnosticService: BugDiagnosticService,
  bugReportingConfig: BugReportingConfig,
  router: Router,
  document: Document
): () => void {
  return () => {
    if (!bugReportingConfig.enabled) {
      return;
    }

    bugActivityTrackerService.startListening(document);

    bugDiagnosticService.addEvent({
      type: 'NAVIGATION',
      action: 'ROUTE_CHANGE',
      route: normalizeRoute(router.url),
      success: true
    });

    router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        bugDiagnosticService.addEvent({
          type: 'NAVIGATION',
          action: 'ROUTE_CHANGE',
          route: normalizeRoute(event.urlAfterRedirects),
          success: true
        });
      });
  };
}

function normalizeRoute(url: string): string {
  return url.split('?')[0].split('#')[0] || '/';
}

export function provideBugReportingProviders(config: Partial<BugReportingConfig> = {}): Provider[] {
  const resolvedConfig = createBugReportingConfig(config);

  return [
    { provide: BUG_REPORTING_CONFIG, useValue: resolvedConfig },
    { provide: HTTP_INTERCEPTORS, useClass: BugNetworkDiagnosticInterceptor, multi: true },
    {
      provide: ErrorHandler,
      useFactory: () => new BugReportingErrorHandler(inject(BugDiagnosticService))
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeBugReporting,
      deps: [BugActivityTrackerService, BugDiagnosticService, BUG_REPORTING_CONFIG, Router, DOCUMENT],
      multi: true
    }
  ];
}

export function provideBugReporting(config: Partial<BugReportingConfig> = {}): EnvironmentProviders {
  return makeEnvironmentProviders([provideHttpClient(withInterceptorsFromDi()), ...provideBugReportingProviders(config)]);
}