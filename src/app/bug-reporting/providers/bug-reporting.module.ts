import { HttpClientModule } from '@angular/common/http';
import { NgModule, ModuleWithProviders } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BugReportDemoComponent } from '../bug-report-demo/bug-report-demo.component';
import { BugReportFormComponent } from '../bug-report-form/bug-report-form.component';
import { BugReportingConfig } from './bug-reporting.config';
import { provideBugReportingProviders } from './bug-reporting.bootstrap';

@NgModule({
  imports: [HttpClientModule, RouterModule, BugReportDemoComponent, BugReportFormComponent],
  exports: [BugReportDemoComponent, BugReportFormComponent]
})
export class BugReportingModule {
  static forRoot(config: Partial<BugReportingConfig> = {}): ModuleWithProviders<BugReportingModule> {
    return {
      ngModule: BugReportingModule,
      providers: provideBugReportingProviders(config)
    };
  }
}