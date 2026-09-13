import { Component, inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { BugConfidenceService } from '../services/bug-confidence.service';
import { BugDiagnosticService } from '../services/bug-diagnostic.service';
import { BugReportSubmissionService } from '../services/bug-report-submission.service';
import { BUG_REPORTING_CONFIG } from '../providers/bug-reporting.config';
import {
  BUG_REPORT_CATEGORIES,
  BUG_REPORT_OUTPUT_FORMATS,
  BugReportCategory,
  BugReportOutputFormat,
  BugReportPayload
} from './bug-report-form.models';

@Component({
  selector: 'app-bug-report-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './bug-report-form.component.html',
  styleUrl: './bug-report-form.component.css'
})
export class BugReportFormComponent {
  readonly categories = BUG_REPORT_CATEGORIES;
  readonly outputFormats = BUG_REPORT_OUTPUT_FORMATS;
  readonly form;
  private readonly formBuilder = inject(FormBuilder);
  private readonly bugDiagnosticService = inject(BugDiagnosticService);
  private readonly bugConfidenceService = inject(BugConfidenceService);
  private readonly bugReportSubmissionService = inject(BugReportSubmissionService);
  private readonly bugReportingConfig = inject(BUG_REPORTING_CONFIG);
  private readonly router = inject(Router);

  constructor(
    @Optional() private readonly dialogRef?: MatDialogRef<BugReportFormComponent>
  ) {
    this.form = this.formBuilder.nonNullable.group({
      title: ['', [Validators.required]],
      category: [BUG_REPORT_CATEGORIES[0] as BugReportCategory, [Validators.required]],
      description: ['', [Validators.required]],
      expectedBehavior: [''],
      outputFormat: [this.bugReportingConfig.defaultOutputFormat, [Validators.required]]
    });
  }

  get routeLabel(): string | null {
    return this.getCurrentRoute();
  }

  cancel(): void {
    this.form.reset({
      title: '',
      category: BUG_REPORT_CATEGORIES[0],
      description: '',
      expectedBehavior: '',
      outputFormat: this.bugReportingConfig.defaultOutputFormat
    });

    this.dialogRef?.close();
  }

  sendBug(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const snapshot = this.bugDiagnosticService.createSnapshot();
    const confidence = this.bugConfidenceService.analyzeEvents(snapshot.events);
    const value = this.form.getRawValue();
    const outputFormat = value.outputFormat;

    const payload: BugReportPayload = {
      report: {
        title: value.title,
        category: value.category,
        description: value.description,
        expectedBehavior: value.expectedBehavior
      },
      environment: {
        route: this.getCurrentRoute(),
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        appVersion: this.bugReportingConfig.appVersion
      },
      diagnostics: snapshot,
      confidence
    };

    this.logPayload(payload, outputFormat);

    this.bugReportSubmissionService.submit(payload).subscribe({
      next: () => {
        this.form.reset({
          title: '',
          category: BUG_REPORT_CATEGORIES[0],
          description: '',
          expectedBehavior: '',
          outputFormat: this.bugReportingConfig.defaultOutputFormat
        });

        this.dialogRef?.close(payload);
      },
      error: error => {
        console.error('Bug report submission failed', error);
      }
    });
  }

  private getCurrentRoute(): string | null {
    const routerUrl = this.router.url;

    if (!routerUrl) {
      return null;
    }

    return routerUrl.split('?')[0].split('#')[0] || null;
  }

  private logPayload(payload: BugReportPayload, outputFormat: BugReportOutputFormat): void {
    if (outputFormat === 'TABLE') {
      this.logPayloadAsTable(payload);
      return;
    }

    console.groupCollapsed('Bug report payload');
    console.log(JSON.stringify(payload, null, 2));
    console.groupEnd();
  }

  private logPayloadAsTable(payload: BugReportPayload): void {
    console.groupCollapsed('Bug report payload (table)');

    console.table([
      {
        section: 'report',
        title: payload.report.title,
        category: payload.report.category,
        description: payload.report.description,
        expectedBehavior: payload.report.expectedBehavior
      },
      {
        section: 'environment',
        route: payload.environment.route ?? '',
        timestamp: payload.environment.timestamp,
        userAgent: payload.environment.userAgent ?? '',
        appVersion: payload.environment.appVersion
      },
      {
        section: 'confidence',
        score: payload.confidence.score,
        level: payload.confidence.level,
        reasons: payload.confidence.reasons.join(' | ')
      }
    ]);

    console.table(
      payload.diagnostics.events.map(event => ({
        timestamp: event.timestamp,
        type: event.type,
        action: event.action,
        route: event.route ?? '',
        method: event.method ?? '',
        endpoint: event.endpoint ?? '',
        statusCode: event.statusCode ?? '',
        durationMs: event.durationMs ?? '',
        success: event.success ?? ''
      }))
    );

    console.groupEnd();
  }
}