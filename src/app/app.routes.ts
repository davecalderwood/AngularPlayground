import { Routes } from '@angular/router';
import { CalendarComponent } from './calendar/calendar.component';
import { DocumentsComponent } from './documents/documents.component';

export const routes: Routes = [
  { path: 'calendar', component: CalendarComponent },
  { path: 'documents', component: DocumentsComponent },
  { 
    path: 'document-search-v2', 
    loadComponent: () => import('./document-search-v2/components/document-search-v2.component').then(m => m.DocumentSearchV2Component) 
  },
  { path: '', redirectTo: '/calendar', pathMatch: 'full' },
];
