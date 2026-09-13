import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BugDiagnosticHttpMethod } from '../models/bug-diagnostic.models';
import { toBugDiagnosticEventInput } from '../network/bug-network-diagnostic.utils';
import { BugDiagnosticService } from '../services/bug-diagnostic.service';
import { BugReportFormComponent } from '../bug-report-form/bug-report-form.component';
import {
  BugReportDemoApiError,
  BugReportDemoApiResult,
  BugReportDemoApiService
} from './bug-report-demo-api.service';

@Component({
  selector: 'app-bug-report-demo',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './bug-report-demo.component.html',
  styleUrl: './bug-report-demo.component.css'
})
export class BugReportDemoComponent {
  private readonly bugDiagnosticService = inject(BugDiagnosticService);
  private readonly bugReportDemoApiService = inject(BugReportDemoApiService);
  private readonly dialog = inject(MatDialog);

  get diagnosticTimelineJson(): string {
    return JSON.stringify(this.bugDiagnosticService.getTimeline(), null, 2);
  }

  openCalendar(event: MouseEvent): void {
  }

  openUser(event: MouseEvent): void {
  }

  openEditAddressModal(event: MouseEvent): void {
  }

  saveAddress(event: MouseEvent): void {
  }

  runSuccessfulApiRequest(event: MouseEvent): void {
    this.executeRequest(
      'GET',
      '/api/documents/12345',
      () => this.bugReportDemoApiService.successfulRequest(),
      200
    );
  }

  run404ApiRequest(event: MouseEvent): void {
    this.executeFailedRequest(
      'GET',
      '/api/documents/40404',
      () => this.bugReportDemoApiService.notFoundRequest(),
      404
    );
  }

  run400ApiRequest(event: MouseEvent): void {
    this.executeFailedRequest(
      'PUT',
      '/api/customer/839291/address',
      () => this.bugReportDemoApiService.badRequest(),
      400
    );
  }

  run500ApiRequest(event: MouseEvent): void {
    this.executeFailedRequest(
      'POST',
      '/api/customers/839291/save',
      () => this.bugReportDemoApiService.serverErrorRequest(),
      500
    );
  }

  runSlowApiRequest(event: MouseEvent): void {
    this.executeRequest(
      'GET',
      '/api/users/58/calendar/2026',
      () => this.bugReportDemoApiService.slowSuccessfulRequest(),
      200
    );
  }

  runRepeatFailedRequest(event: MouseEvent): void {
    this.executeFailedRequest(
      'POST',
      '/api/customers/839291/save',
      () => this.bugReportDemoApiService.serverErrorRequest(),
      500
    );

    this.executeFailedRequest(
      'POST',
      '/api/customers/839291/save',
      () => this.bugReportDemoApiService.serverErrorRequest(),
      500
    );
  }

  generateUiError(event: MouseEvent): void {
    this.bugDiagnosticService.addEvent({
      type: 'UI_ERROR',
      action: 'GENERATE_UI_ERROR',
      success: false
    });
  }

  clearDiagnostics(event: MouseEvent): void {
    event.preventDefault();
    this.bugDiagnosticService.clearTimeline();
  }

  openReportBugDialog(event: MouseEvent): void {
    this.dialog.open(BugReportFormComponent, {
      width: '760px',
      maxWidth: '95vw',
      autoFocus: false,
      restoreFocus: true
    });
  }

  private executeRequest(
    method: BugDiagnosticHttpMethod,
    endpoint: string,
    requestFactory: () => ReturnType<BugReportDemoApiService['successfulRequest']>,
    statusCode: number
  ): void {
    const startedAt = Date.now();

    requestFactory().subscribe({
      next: (_response: BugReportDemoApiResult) => {
        this.recordNetworkOutcome(method, endpoint, startedAt, statusCode, true);
      }
    });
  }

  private executeFailedRequest(
    method: BugDiagnosticHttpMethod,
    endpoint: string,
    requestFactory: () => ReturnType<BugReportDemoApiService['serverErrorRequest']>,
    statusCode: number
  ): void {
    const startedAt = Date.now();

    requestFactory().subscribe({
      error: (_error: BugReportDemoApiError) => {
        this.recordNetworkOutcome(method, endpoint, startedAt, statusCode, false);
      }
    });
  }

  private recordNetworkOutcome(
    method: BugDiagnosticHttpMethod,
    endpoint: string,
    startedAt: number,
    statusCode: number,
    success: boolean
  ): void {
    this.bugDiagnosticService.addEvent(
      toBugDiagnosticEventInput(
        {
          method,
          url: endpoint
        },
        {
          statusCode,
          durationMs: Math.max(0, Date.now() - startedAt),
          success
        }
      )
    );
  }
}