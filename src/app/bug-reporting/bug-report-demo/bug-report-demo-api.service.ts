import { Injectable } from '@angular/core';
import { Observable, delay, mergeMap, of, throwError, timer } from 'rxjs';

export interface BugReportDemoApiResult {
  statusCode: number;
  ok: boolean;
  message: string;
}

export interface BugReportDemoApiError {
  statusCode: number;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class BugReportDemoApiService {
  successfulRequest(delayMs = 250): Observable<BugReportDemoApiResult> {
    return of({
      statusCode: 200,
      ok: true,
      message: 'OK'
    }).pipe(delay(delayMs));
  }

  badRequest(delayMs = 250): Observable<never> {
    return this.fail(400, 'Bad Request', delayMs);
  }

  notFoundRequest(delayMs = 250): Observable<never> {
    return this.fail(404, 'Not Found', delayMs);
  }

  serverErrorRequest(delayMs = 250): Observable<never> {
    return this.fail(500, 'Internal Server Error', delayMs);
  }

  slowSuccessfulRequest(delayMs = 6500): Observable<BugReportDemoApiResult> {
    return this.successfulRequest(delayMs);
  }

  slowFailedRequest(delayMs = 11000): Observable<never> {
    return this.fail(500, 'Slow Internal Server Error', delayMs);
  }

  private fail(statusCode: number, message: string, delayMs: number): Observable<never> {
    return timer(delayMs).pipe(
      mergeMap(() =>
        throwError(() => ({
          statusCode,
          message
        } satisfies BugReportDemoApiError))
      )
    );
  }
}