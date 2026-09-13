import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { BugReportPayload } from '../bug-report-form/bug-report-form.models';
import { BUG_REPORTING_CONFIG } from '../providers/bug-reporting.config';

export interface BugReportSubmissionResult {
  mode: 'console' | 'post';
  submittedAt: string;
  statusCode?: number;
}

@Injectable({
  providedIn: 'root'
})
export class BugReportSubmissionService {
  private readonly http = inject(HttpClient);
  private readonly bugReportingConfig = inject(BUG_REPORTING_CONFIG);

  submit(payload: BugReportPayload): Observable<BugReportSubmissionResult> {
    if (this.bugReportingConfig.submissionMode === 'post' && this.bugReportingConfig.submitUrl) {
      return this.http.post<unknown>(this.bugReportingConfig.submitUrl, payload, {
        observe: 'response'
      }).pipe(
        map((response: HttpResponse<unknown>) => ({
          mode: 'post' as const,
          submittedAt: new Date().toISOString(),
          statusCode: response.status
        }))
      );
    }

    return of({
      mode: 'console' as const,
      submittedAt: new Date().toISOString()
    });
  }
}