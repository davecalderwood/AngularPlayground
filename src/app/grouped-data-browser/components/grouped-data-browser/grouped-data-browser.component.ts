import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTree, MatTreeModule } from '@angular/material/tree';
import { AgGridAngular } from 'ag-grid-angular';
import { GridOptions, SortChangedEvent } from 'ag-grid-community';
import { GroupedDataBrowserActionsCellRendererComponent } from './grouped-data-browser-actions-cell-renderer.component';
import { GroupedDataBrowserConfig } from '../../models/grouped-data-browser-config.model';
import {
  GroupedDataBrowserSearchCommand,
  GroupedDataPageRequest,
  GroupedDataRowActionRequest,
  GroupedDataSortRequest,
} from '../../models/grouped-data-browser-events.model';
import { GroupedDataNode } from '../../models/grouped-data-browser.models';
import { GroupedPagePlannerService } from '../../services/grouped-page-planner.service';

@Component({
  selector: 'app-grouped-data-browser',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTreeModule,
    AgGridAngular,
  ],
  templateUrl: './grouped-data-browser.component.html',
  styleUrl: './grouped-data-browser.component.scss',
})
export class GroupedDataBrowserComponent<T> implements AfterViewInit, OnChanges {
  @Input() config!: GroupedDataBrowserConfig<T>;
  @Input() navigationNodes: GroupedDataNode[] = [];
  @Input() rows: T[] = [];
  @Input() totalRecords = 0;
  @Input() loading = false;
  @Input() searching = false;
  @Input() currentPage = 0;
  @Input() searchCommand: GroupedDataBrowserSearchCommand | null = null;
  @Input() selectedNodeId: string | null = null;

  @Output() readonly nodeSelected = new EventEmitter<GroupedDataNode>();
  @Output() readonly selectedNodeIdChange = new EventEmitter<string | null>();
  @Output() readonly pageRequested = new EventEmitter<GroupedDataPageRequest>();
  @Output() readonly sortChanged = new EventEmitter<GroupedDataSortRequest>();
  @Output() readonly searchRequested = new EventEmitter<string>();
  @Output() readonly rowActionRequested = new EventEmitter<GroupedDataRowActionRequest<T>>();

  selectedNode: GroupedDataNode | null = null;
  searchText = '';
  private highlightedNodeIds = new Set<string>();
  private lastSearchRequestId: string | number | undefined;

  readonly childrenAccessor = (node: GroupedDataNode) => node.children ?? [];
  readonly hasChild = (_: number, node: GroupedDataNode) => !!node.children?.length;
  readonly gridComponents = {
    groupedDataBrowserActions: GroupedDataBrowserActionsCellRendererComponent,
  };

  @ViewChild(MatTree) private tree?: MatTree<GroupedDataNode, GroupedDataNode>;
  private cachedRowIdFunction: ((row: T) => string) | undefined;
  private cachedGridOptionsInput: GridOptions<T> | undefined;
  private composedGridOptions: GridOptions<T> | null = null;
  private cachedColumnSource: GroupedDataBrowserConfig<T>['columns'] | null = null;
  private cachedRowActionsSource: GroupedDataBrowserConfig<T>['rowActions'] | undefined;
  private cachedColumnDefinitions: GroupedDataBrowserConfig<T>['columns'] | null = null;

  constructor(private readonly pagePlanner: GroupedPagePlannerService) {}

  ngAfterViewInit(): void {
    this.expandTreeIfConfigured();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedNodeId'] || changes['navigationNodes']) {
      this.selectedNode = this.selectedNodeId
        ? this.findNodeById(this.navigationNodes, this.selectedNodeId)
        : null;
      if (!this.selectedNode) {
        this.selectedNodeId = null;
      }
      this.updateHighlightedBranch();
    }

    if (changes['navigationNodes']) {
      this.expandTreeIfConfigured();
    }

    const searchCommand = this.searchCommand;
    if (changes['searchCommand'] && searchCommand && searchCommand.requestId !== this.lastSearchRequestId) {
      this.lastSearchRequestId = searchCommand.requestId;
      this.searchText = searchCommand.query;
      this.selectedNode = null;
      this.selectedNodeId = null;
      this.selectedNodeIdChange.emit(null);
      this.updateHighlightedBranch();
      const query = searchCommand.query.trim();
      queueMicrotask(() => this.searchRequested.emit(query));
    }
  }

  get pageSize(): number {
    const configuredPageSize = this.config?.pageSize > 0 ? Math.floor(this.config.pageSize) : 250;
    const recordsWithinLimit = Math.min(Math.max(0, this.totalRecords), 250);
    return Math.min(250, Math.max(1, configuredPageSize, recordsWithinLimit));
  }

  get pageCount(): number {
    return Math.ceil(Math.max(0, this.totalRecords) / this.pageSize);
  }

  get searchPlaceholder(): string {
    return this.config.search?.placeholder || 'Search rows';
  }

  get gridOptionsForGrid(): GridOptions<T> {
    const getRowId = this.config.getRowId;
    if (
      this.composedGridOptions === null ||
      this.config.gridOptions !== this.cachedGridOptionsInput ||
      getRowId !== this.cachedRowIdFunction
    ) {
      this.cachedGridOptionsInput = this.config.gridOptions;
      this.cachedRowIdFunction = getRowId;
      const baseOptions = this.config.gridOptions ?? {};
      this.composedGridOptions = {
        ...baseOptions,
        ...(getRowId ? { getRowId: (params: { data: T }) => getRowId(params.data) } : {}),
      };
    }

    return this.composedGridOptions;
  }

  get columnDefinitions(): GroupedDataBrowserConfig<T>['columns'] {
    const { columns, rowActions } = this.config;
    if (columns !== this.cachedColumnSource || rowActions !== this.cachedRowActionsSource) {
      this.cachedColumnSource = columns;
      this.cachedRowActionsSource = rowActions;
      this.cachedColumnDefinitions = rowActions
        ? [
            ...columns,
            {
              colId: 'groupedDataBrowserActions',
              headerName: rowActions.headerName || 'Actions',
              width: rowActions.width || Math.max(96, rowActions.actions.length * 44 + 12),
              sortable: false,
              filter: false,
              resizable: false,
              cellRenderer: 'groupedDataBrowserActions',
              cellRendererParams: {
                actions: rowActions.actions,
                onAction: (action: NonNullable<typeof rowActions>['actions'][number], row: unknown, rowIndex: number | null) => {
                  this.emitRowAction(action, row, rowIndex);
                },
              },
            },
          ]
        : columns;
    }

    return this.cachedColumnDefinitions ?? columns;
  }

  get pageSummary(): string {
    const firstRecord = this.totalRecords > 0 ? this.currentPage * this.pageSize + 1 : 0;
    const lastRecord = Math.min((this.currentPage + 1) * this.pageSize, this.totalRecords);
    const range = this.totalRecords > 0 ? `${firstRecord}-${lastRecord}` : '0';
    const total = this.config.pagination.showTotal ? ` of ${this.totalRecords}` : '';
    const page = this.pageCount ? this.currentPage + 1 : 0;
    return `Showing ${range}${total} | Page ${page} of ${this.pageCount}`;
  }

  selectNode(nodeId: string): void {
    const node = this.findNodeById(this.navigationNodes, nodeId);
    if (!node) {
      return;
    }

    this.selectedNode = node;
    this.selectedNodeId = node.id;
    this.updateHighlightedBranch();
    this.nodeSelected.emit(node);
    this.selectedNodeIdChange.emit(node.id);
    this.requestPage(0);
  }

  isNodeHighlighted(nodeId: string): boolean {
    return this.highlightedNodeIds.has(nodeId);
  }

  isNodeSelected(nodeId: string): boolean {
    return this.selectedNodeId === nodeId;
  }

  requestPage(pageIndex: number): void {
    const leaves = this.getLeafDescendants(this.selectedNode ? [this.selectedNode] : this.navigationNodes);
    const pagePlan = this.pagePlanner.calculatePagePlan(leaves, pageIndex, this.pageSize);

    this.pageRequested.emit({
      pageIndex: pagePlan.pageIndex,
      pageSize: pagePlan.pageSize,
      selectedNode: this.selectedNode,
      pagePlan,
    });
  }

  previousPage(): void {
    if (this.currentPage > 0 && !this.loading) {
      this.requestPage(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage + 1 < this.pageCount && !this.loading) {
      this.requestPage(this.currentPage + 1);
    }
  }

  onGridSortChanged(event: SortChangedEvent<T>): void {
    if (!this.config.sorting.enabled || !this.config.sorting.serverSide) {
      return;
    }

    const sortedColumn = event.api.getColumnState().find((column) => column.sort);
    this.sortChanged.emit({
      column: sortedColumn?.colId ?? '',
      direction: sortedColumn?.sort ?? null,
      selectedNode: this.selectedNode,
    });
  }

  private emitRowAction(
    action: NonNullable<GroupedDataBrowserConfig<T>['rowActions']>['actions'][number],
    row: unknown,
    rowIndex: number | null,
  ): void {
    if (row === undefined || row === null) {
      return;
    }

    const rowData = row as T;
    this.rowActionRequested.emit({
      action,
      row: rowData,
      rowId: this.config.getRowId?.(rowData) ?? null,
      rowIndex,
      selectedNode: this.selectedNode,
      pageIndex: this.currentPage,
    });
  }


  submitSearch(): void {
    const query = this.searchText.trim();
    if (this.config.search?.enabled && query) {
      this.searchRequested.emit(query);
    }
  }

  private getLeafDescendants(nodes: GroupedDataNode[]): GroupedDataNode[] {
    const leaves: GroupedDataNode[] = [];

    const visit = (node: GroupedDataNode): void => {
      if (!node.children?.length) {
        leaves.push(node);
        return;
      }

      node.children.forEach(visit);
    };

    nodes.forEach(visit);
    return leaves;
  }

  private updateHighlightedBranch(): void {
    this.highlightedNodeIds = new Set<string>();
    if (this.selectedNodeId) {
      this.collectSelectedBranch(this.navigationNodes, this.selectedNodeId, []);
    }
  }

  private collectSelectedBranch(
    nodes: GroupedDataNode[],
    selectedId: string,
    ancestors: string[],
  ): boolean {
    for (const node of nodes) {
      const branch = [...ancestors, node.id];
      if (node.id === selectedId) {
        branch.forEach((id) => this.highlightedNodeIds.add(id));
        this.collectDescendantIds(node.children ?? []);
        return true;
      }

      if (this.collectSelectedBranch(node.children ?? [], selectedId, branch)) {
        branch.forEach((id) => this.highlightedNodeIds.add(id));
        return true;
      }
    }

    return false;
  }

  private collectDescendantIds(nodes: GroupedDataNode[]): void {
    for (const node of nodes) {
      this.highlightedNodeIds.add(node.id);
      this.collectDescendantIds(node.children ?? []);
    }
  }

  private findNodeById(nodes: GroupedDataNode[], id: string): GroupedDataNode | null {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }

      const match = this.findNodeById(node.children ?? [], id);
      if (match) {
        return match;
      }
    }

    return null;
  }

  private expandTreeIfConfigured(): void {
    if (this.config?.navigation.defaultExpanded) {
      queueMicrotask(() => this.tree?.expandAll());
    }
  }
}