import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GroupedDataBrowserRowAction } from '../../models/grouped-data-browser-config.model';

@Component({
  selector: 'app-grouped-data-browser-row-actions',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './grouped-data-browser-row-actions.component.html',
  styleUrl: './grouped-data-browser-row-actions.component.scss',
})
export class GroupedDataBrowserRowActionsComponent {
  @Input() actions: GroupedDataBrowserRowAction[] = [];

  @Output() readonly actionSelected = new EventEmitter<GroupedDataBrowserRowAction>();

  onActionClick(action: GroupedDataBrowserRowAction, event: MouseEvent): void {
    event.stopPropagation();
    this.actionSelected.emit(action);
  }
}
