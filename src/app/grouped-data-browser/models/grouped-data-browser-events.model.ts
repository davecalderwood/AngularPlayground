import { GroupedDataNode, GroupedDataPagePlan } from './grouped-data-browser.models';
import { GroupedDataBrowserRowAction } from './grouped-data-browser-config.model';

export interface GroupedDataPageRequest {
  pageIndex: number;
  pageSize: number;
  selectedNode: GroupedDataNode | null;
  pagePlan: GroupedDataPagePlan;
}

export interface GroupedDataSortRequest {
  column: string;
  direction: 'asc' | 'desc' | null;
  selectedNode: GroupedDataNode | null;
}

export interface GroupedDataBrowserSearchCommand {
  requestId: string | number;
  query: string;
}

export interface GroupedDataRowActionRequest<T> {
  action: GroupedDataBrowserRowAction;
  row: T;
  rowId: string | null;
  rowIndex: number | null;
  selectedNode: GroupedDataNode | null;
  pageIndex: number;
}