import { ColDef, GridOptions } from 'ag-grid-community';

export interface GroupedDataBrowserRowAction {
  id: string;
  label: string;
  icon: string;
  tooltip?: string;
}

export interface GroupedDataBrowserRowActions {
  headerName?: string;
  width?: number;
  actions: GroupedDataBrowserRowAction[];
}

export interface GroupedDataBrowserConfig<T> {
  pageSize: number;
  columns: ColDef<T>[];
  navigation: {
    enabled: boolean;
    defaultExpanded: boolean;
    showCounts: boolean;
    rootLabel?: string;
    autoSelectRoot?: boolean;
  };
  pagination: {
    enabled: boolean;
    showTotal: boolean;
  };
  sorting: {
    enabled: boolean;
    serverSide: boolean;
  };
  search?: {
    enabled: boolean;
    placeholder?: string;
  };
  gridOptions?: GridOptions<T>;
  getRowId?: (row: T) => string;
  rowActions?: GroupedDataBrowserRowActions;
  emptyMessage?: string;
}