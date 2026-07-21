import { Injectable } from '@angular/core';
import { Observable, of, timer } from 'rxjs';
import { delay, filter, map, switchMap, takeWhile } from 'rxjs/operators';
import {
  DocumentCategoryCountsResponse,
  DocumentJobStatus,
  DocumentSearchRequest
} from './document.models';

@Injectable({ providedIn: 'root' })
export class DocumentJobService {
  private pollCountsByJobId = new Map<string, number>();

  startDocumentJob(request: DocumentSearchRequest): Observable<string> {
    console.log('Fake startDocumentJob payload:', request);

    const jobId = crypto.randomUUID();

    this.pollCountsByJobId.set(jobId, 0);

    return of(jobId).pipe(delay(300));
  }

  getJobStatus(jobId: string): Observable<DocumentJobStatus> {
    const currentCount = this.pollCountsByJobId.get(jobId) ?? 0;
    const nextCount = currentCount + 1;

    this.pollCountsByJobId.set(jobId, nextCount);

    const status: DocumentJobStatus = nextCount >= 3 ? 'done' : 'processing';

    console.log(`Fake poll for ${jobId}:`, status);

    return of(status).pipe(delay(250));
  }

  pollUntilFinished(jobId: string): Observable<DocumentJobStatus> {
    return timer(0, 3000).pipe(
      switchMap(() => this.getJobStatus(jobId)),
      takeWhile(status => status !== 'done', true),
      filter(status => status === 'done')
    );
  }

  getCategoryCounts(jobId: string): Observable<DocumentCategoryCountsResponse> {
    console.log('Fake getCategoryCounts for job:', jobId);

    const response: DocumentCategoryCountsResponse = {
      Unassigned: [
        { parent_desc: null, desc: 'Management', count: 0 },
        { parent_desc: null, desc: 'Finance', count: 0 },
        { parent_desc: null, desc: 'Human Resources', count: 0 },
        { parent_desc: null, desc: 'Legal', count: 0 }
      ],
      Management: [
        { parent_desc: 'Management', desc: 'Policies', count: 125 },
        { parent_desc: 'Management', desc: 'Reports', count: 80 },
        { parent_desc: 'Management', desc: 'Procedures', count: 45 }
      ],
      Finance: [
        { parent_desc: 'Finance', desc: 'Payroll', count: 150 },
        { parent_desc: 'Finance', desc: 'Invoices', count: 90 },
        { parent_desc: 'Finance', desc: 'Budgets', count: 60 }
      ],
      'Human Resources': [
        { parent_desc: 'Human Resources', desc: 'Employees', count: 110 },
        { parent_desc: 'Human Resources', desc: 'Benefits', count: 70 }
      ],
      Legal: [
        { parent_desc: 'Legal', desc: 'Contracts', count: 130 },
        { parent_desc: 'Legal', desc: 'Compliance', count: 40 }
      ]
    };

    return of(response).pipe(delay(500));
  }
}
