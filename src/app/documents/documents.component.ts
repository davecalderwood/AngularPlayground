import { Component } from '@angular/core';
import { DocumentSearchPlaygroundComponent } from './document-search-playground.component';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [DocumentSearchPlaygroundComponent],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.css'
})
export class DocumentsComponent {

}
