import { Routes } from '@angular/router';
import { CalendarComponent } from './calendar/calendar.component';
import { DocumentsComponent } from './documents/documents.component';

export const routes: Routes = [
  { path: 'calendar', component: CalendarComponent },
  { path: 'documents', component: DocumentsComponent },
  { path: '', redirectTo: '/calendar', pathMatch: 'full' },
];
