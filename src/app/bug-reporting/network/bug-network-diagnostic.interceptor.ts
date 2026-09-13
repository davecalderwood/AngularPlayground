import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { BugDiagnosticService } from '../services/bug-diagnostic.service';
import { toBugDiagnosticEventInput } from './bug-network-diagnostic.utils';

@Injectable()
export class BugNetworkDiagnosticInterceptor implements HttpInterceptor {
  constructor(private readonly bugDiagnosticService: BugDiagnosticService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const startedAt = Date.now();
    const context = {
      method: req.method as any,
      url: req.urlWithParams
    };

    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          this.recordOutcome(context, startedAt, event.status, true);
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.recordOutcome(
          context,
          startedAt,
          typeof error.status === 'number' ? error.status : 0,
          false
        );

        return throwError(() => error);
      })
    );
  }

  recordRequestSuccess(method: string, url: string, statusCode: number, startedAt: number): void {
    this.recordOutcome({ method: method as any, url }, startedAt, statusCode, true);
  }

  recordRequestFailure(method: string, url: string, statusCode: number, startedAt: number): void {
    this.recordOutcome({ method: method as any, url }, startedAt, statusCode, false);
  }

  recordOutcome(
    context: { method: string; url: string },
    startedAt: number,
    statusCode: number,
    success: boolean
  ): void {
    const durationMs = Math.max(0, Date.now() - startedAt);

    this.bugDiagnosticService.addEvent(
      toBugDiagnosticEventInput(
        {
          method: context.method as any,
          url: context.url
        },
        {
          statusCode,
          durationMs,
          success
        }
      )
    );
  }
}