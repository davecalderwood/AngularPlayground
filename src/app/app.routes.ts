import { Routes } from '@angular/router';
import { CalendarComponent } from './calendar/calendar.component';
import { DocumentsComponent } from './documents/documents.component';

export const routes: Routes = [
  { path: 'calendar', component: CalendarComponent },
  { path: 'documents', component: DocumentsComponent },
  {
    path: 'grouped-data-browser-demo',
    loadComponent: () =>
      import('./grouped-data-browser-demo/grouped-data-browser-demo.component').then(
        m => m.GroupedDataBrowserDemoComponent
      )
  },
  {
    path: 'asset-catalog-demo',
    loadComponent: () =>
      import('./asset-catalog-demo/asset-catalog-demo.component').then(
        m => m.AssetCatalogDemoComponent
      )
  },
  {
    path: 'bug-report-demo',
    loadComponent: () =>
      import('./bug-reporting/bug-report-demo/bug-report-demo.component').then(
        m => m.BugReportDemoComponent
      )
  },
  { 
    path: 'document-search-v2', 
    loadComponent: () => import('./document-search-v2/components/document-search-v2.component').then(m => m.DocumentSearchV2Component) 
  },
  {
    path: 'us-regional-map',
    loadComponent: () =>
      import('./us-regional-map-demo/us-regional-map-demo.component').then(m => m.UsRegionalMapDemoComponent)
  },
  { path: '', redirectTo: '/calendar', pathMatch: 'full' },
];
