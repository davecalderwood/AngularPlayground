import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { GroupedDataBrowserRowAction } from '../../models/grouped-data-browser-config.model';
import { GroupedDataBrowserRowActionsComponent } from '../grouped-data-browser-row-actions/grouped-data-browser-row-actions.component';

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
  imports: [GroupedDataBrowserRowActionsComponent],
  template: `
    <app-grouped-data-browser-row-actions
      [actions]="actions"
      (actionSelected)="runAction($event)" />
  `,
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

  runAction(action: GroupedDataBrowserRowAction): void {
    if (this.params.data !== undefined && this.params.data !== null) {
      this.params.onAction(action, this.params.data, this.params.node.rowIndex);
    }
  }

  private setParams(params: GroupedDataBrowserActionsCellParams): void {
    this.params = params;
    this.actions = params.actions;
  }
}