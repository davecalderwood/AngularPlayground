import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { GroupedDataBrowserRowAction } from '../../models/grouped-data-browser-config.model';

interface GroupedDataBrowserActionsCellParams extends ICellRendererParams<unknown> {
  actions: GroupedDataBrowserRowAction[];
  onAction: (
    action: GroupedDataBrowserRowAction,
    row: unknown,
    rowIndex: number | null,
  ) => void;
}

@Component({
  selector: 'app-grouped-data-browser-actions-cell',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="row-actions">
      <button
        *ngFor="let action of actions"
        mat-icon-button
        type="button"
        [attr.aria-label]="action.label"
        [title]="action.tooltip || action.label"
        (click)="runAction(action, $event)">
        <mat-icon>{{ action.icon }}</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .row-actions { display: flex; align-items: center; gap: 2px; height: 100%; }
  `],
})
export class GroupedDataBrowserActionsCellRendererComponent implements ICellRendererAngularComp {
  actions: GroupedDataBrowserRowAction[] = [];
  private params!: GroupedDataBrowserActionsCellParams;

  agInit(params: GroupedDataBrowserActionsCellParams): void {
    this.setParams(params);
  }

  refresh(params: GroupedDataBrowserActionsCellParams): boolean {
    this.setParams(params);
    return true;
  }

  runAction(action: GroupedDataBrowserRowAction, event: MouseEvent): void {
    event.stopPropagation();
    if (this.params.data !== undefined && this.params.data !== null) {
      this.params.onAction(action, this.params.data, this.params.node.rowIndex);
    }
  }

  private setParams(params: GroupedDataBrowserActionsCellParams): void {
    this.params = params;
    this.actions = params.actions;
  }
}