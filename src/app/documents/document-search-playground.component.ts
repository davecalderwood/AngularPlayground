import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  ColDef,
  GridApi,
  GridOptions,
  GridReadyEvent,
  RowGroupOpenedEvent,
} from 'ag-grid-community';
import { AgGridAngular } from 'ag-grid-angular';
import { EMPTY } from 'rxjs';
import {
  catchError,
  filter,
  finalize,
  map,
  switchMap,
  tap,
} from 'rxjs/operators';
import { DocumentJobService } from './document-job.service';
import {
  DocumentTreeDatasourceFactory,
  CustomServerSideDatasource,
} from './document-tree-datasource.factory';
import { PaginationCellRendererComponent } from './pagination-cell-renderer.component';
import {
  DocumentCategoryCountsResponse,
  DocumentSearchRequest,
  DocumentTreeRow,
  DocumentTreeSummaryDto,
} from './document.models';

import 'ag-grid-enterprise';
import {
  DocumentAdvancedQuery,
  DocumentQueryBuilderComponent,
  QueryFieldDefinition,
} from './document-query-builder/document-query-builder.component';

interface ExpandedNode {
  id: string;
  isLeft: boolean;
  route: string[];
  pageSize: number;
  timestamp: number;
}

@Component({
  selector: 'app-document-search-playground',
  standalone: true,
  imports: [
    CommonModule,
    AgGridAngular,
    ReactiveFormsModule,
    PaginationCellRendererComponent,
    DocumentQueryBuilderComponent,
  ],
  templateUrl: './document-search-playground.component.html',
  styleUrls: ['./document-search-playground.component.scss'],
})
export class DocumentSearchPlaygroundComponent {
  searchControl = new FormControl<string>('', { nonNullable: true });
  groupingControl = new FormControl<string>('category', { nonNullable: true });

  private leftGridApi?: GridApi<DocumentTreeRow>;
  private rightGridApi?: GridApi<DocumentTreeRow>;

  private pendingSummary?: DocumentTreeSummaryDto;
  private pendingJobId?: string;
  private currentDatasource?: CustomServerSideDatasource;

  private expandedNodesHistory: ExpandedNode[] = [];
  private readonly MAX_TOTAL_DOCUMENTS = 250;
  private readonly MIN_PAGE_SIZE = 5;

  searching = false;
  showGrid = true;
  isSplitView = false;
  errorMessage = '';
  isGroupedBySection = false;

  showAdvancedSearch = false;

  readonly advancedSearchFields: QueryFieldDefinition[] = [
    {
      key: 'mNumber',
      label: 'M#',
      backendName: 'M#',
      placeholder: 'Enter 123 or abc',
      operators: [
        'contains',
        'notContains',
        'equals',
        'notEquals',
        'startsWith',
        'endsWith',
        'isEmpty',
        'isNotEmpty',
      ],
    },
    {
      key: 'documentName',
      label: 'Document name',
      backendName: 'Name',
      placeholder: 'Enter all or part of the document name',
    },
    {
      key: 'type',
      label: 'Document type',
      backendName: 'Type',
      placeholder: 'Enter a document type',
    },
    {
      key: 'status',
      label: 'Status',
      backendName: 'Status',
      placeholder: 'Enter a document status',
    },
    {
      key: 'author',
      label: 'Author',
      backendName: 'Author',
      placeholder: 'Enter an author name',
    },
    {
      key: 'createdDate',
      label: 'Created date',
      backendName: 'CreatedDate',
      placeholder: 'Enter a date',
    },
  ];

  public changePageSubcategory = (
    route: string[],
    direction: number,
    api?: GridApi,
  ) => {
    if (this.currentDatasource && this.currentDatasource.changePage && api) {
      const category = route[route.length - 2];
      const subcategory = route[route.length - 1];

      api.forEachNode((node) => {
        if (
          node.data?.category === category &&
          node.data?.subcategory === subcategory &&
          node.data?.rowType === 'document'
        ) {
          node.data['isLoading'] = true;
        }
      });
      api.refreshCells({ force: true });

      this.currentDatasource.changePage(route, direction, api);
    }
  };

  toggleSplitView(): void {
    this.isSplitView = !this.isSplitView;
    if (this.isSplitView && this.currentDatasource && this.rightGridApi) {
      this.rightGridApi.setGridOption(
        'serverSideDatasource',
        this.currentDatasource,
      );
    }
  }

  onGroupingChange(): void {
    const value = this.groupingControl.value;
    this.isGroupedBySection = value === 'section';
    this.applyGroupingToApi(this.leftGridApi);
    this.applyGroupingToApi(this.rightGridApi);

    if (this.searchControl.value.trim()) {
      this.runSearch();
    }
  }

  toggleSectionGroup(): void {
    this.isGroupedBySection = !this.isGroupedBySection;
    this.groupingControl.setValue(
      this.isGroupedBySection ? 'section' : 'category',
    );

    this.applyGroupingToApi(this.leftGridApi);
    this.applyGroupingToApi(this.rightGridApi);

    // Trigger a fresh search to rebuild tree if necessary
    if (this.searchControl.value.trim()) {
      this.runSearch();
    }
  }

  private applyGroupingToApi(api?: GridApi): void {
    if (api) {
      if (this.isGroupedBySection) {
        api.applyColumnState({
          state: [
            { colId: 'section', rowGroupIndex: 0 },
            { colId: 'category', rowGroupIndex: 1 },
            { colId: 'subcategory', rowGroupIndex: 2 },
          ],
        });
      } else {
        api.applyColumnState({
          state: [
            { colId: 'section', rowGroupIndex: null },
            { colId: 'category', rowGroupIndex: 0 },
            { colId: 'subcategory', rowGroupIndex: 1 },
          ],
        });
      }
    }
  }

  columnDefs: ColDef<DocumentTreeRow>[] = [
    {
      field: 'section',
      rowGroup: false, // Initially un-grouped
      enableRowGroup: true,
      hide: true,
    },
    {
      field: 'category',
      rowGroup: true,
      enableRowGroup: true,
      hide: true,
    },
    {
      field: 'subcategory',
      rowGroup: true,
      enableRowGroup: true,
      hide: true,
    },
    {
      field: 'name',
      headerName: 'Document Name',
      flex: 2,
      minWidth: 250,
      cellRenderer: (params: any) =>
        params.data?.rowType === 'document'
          ? params.data?.['isLoading']
            ? '<div class="skeleton-loader" style="width: 80%;"></div>'
            : params.data.name
          : '',
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 120,
      cellRenderer: (params: any) =>
        params.data?.rowType === 'document'
          ? params.data?.['isLoading']
            ? '<div class="skeleton-loader" style="width: 50%;"></div>'
            : params.data.type
          : '',
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      cellRenderer: (params: any) =>
        params.data?.rowType === 'document'
          ? params.data?.['isLoading']
            ? '<div class="skeleton-loader" style="width: 60%;"></div>'
            : params.data.status
          : '',
    },
    {
      field: 'author',
      headerName: 'Author',
      width: 180,
      cellRenderer: (params: any) =>
        params.data?.rowType === 'document'
          ? params.data?.['isLoading']
            ? '<div class="skeleton-loader" style="width: 80%;"></div>'
            : params.data.author
          : '',
    },
    {
      field: 'createdDate',
      headerName: 'Created Date',
      width: 160,
      cellRenderer: (params: any) =>
        params.data?.rowType === 'document'
          ? params.data?.['isLoading']
            ? '<div class="skeleton-loader" style="width: 70%;"></div>'
            : params.data.createdDate
          : '',
    },
  ];

  defaultColDef: ColDef<DocumentTreeRow> = {
    flex: 1,
    minWidth: 100,
    resizable: true,
    sortable: true,
    filter: true,
  };

  gridOptions: GridOptions<DocumentTreeRow> = {
    context: {
      componentParent: this,
    },
    rowModelType: 'serverSide',

    // Normal row grouping. Do not use treeData or pivotMode.
    groupDisplayType: 'singleColumn',

    // Define full width row handling exclusively for our custom pagination row
    isFullWidthRow: (params) => {
      return params.rowNode.data?.rowType === 'pagination';
    },
    fullWidthCellRenderer: PaginationCellRendererComponent,

    cacheBlockSize: 100, // Large enough to grab massive single top-level category hits without requesting more blocks

    maxBlocksInCache: 5,
    animateRows: false,
    suppressAggFuncInHeader: true,

    autoGroupColumnDef: {
      headerName: 'Group',
      minWidth: 320,
      cellRenderer: 'agGroupCellRenderer',
      cellRendererParams: {
        suppressCount: true,
        innerRenderer: (params: any) => {
          const row = params.data as DocumentTreeRow | undefined;
          const groupName = params.value ?? row?.name ?? '';

          if (!row) {
            return groupName;
          }

          if (
            row.rowType === 'section' ||
            row.rowType === 'category' ||
            row.rowType === 'subcategory'
          ) {
            return `${groupName} (${row.documentCount ?? 0})`;
          }

          return '';
        },
      },
      cellClassRules: {
        'document-group-level-0': (params) => params.node.level === 0,
        'document-group-level-1': (params) => params.node.level === 1,
        'document-group-level-2': (params) => params.node.level === 2,
      },
    },

    getRowId: (params) => {
      return params.data?.id ?? `${Date.now()}-${Math.random()}`;
    },
  };

  constructor(
    private documentJobService: DocumentJobService,
    private datasourceFactory: DocumentTreeDatasourceFactory,
  ) {}

  onLeftGridReady(params: GridReadyEvent<DocumentTreeRow>): void {
    this.leftGridApi = params.api;

    if (this.pendingSummary && this.pendingJobId) {
      this.applySummaryToGrid(this.pendingSummary, this.pendingJobId);
    }
  }

  onRightGridReady(params: GridReadyEvent<DocumentTreeRow>): void {
    this.rightGridApi = params.api;

    if (this.currentDatasource) {
      this.rightGridApi.setGridOption(
        'serverSideDatasource',
        this.currentDatasource,
      );
    }
  }

  private recentlyExpandedNodesLeft: string[] = [];
  private recentlyExpandedNodesRight: string[] = [];

  collapseAll(): void {
    if (this.leftGridApi) {
      this.leftGridApi.collapseAll();
      this.recentlyExpandedNodesLeft = [];
    }
    if (this.rightGridApi) {
      this.rightGridApi.collapseAll();
      this.recentlyExpandedNodesRight = [];
    }
    this.expandedNodesHistory = [];
  }

  onRowGroupOpened(
    params: RowGroupOpenedEvent<DocumentTreeRow>,
    isLeft: boolean,
  ): void {
    if (!params.node.expanded) {
      // Manual close
      const history = isLeft
        ? this.recentlyExpandedNodesLeft
        : this.recentlyExpandedNodesRight;
      const idx = history.indexOf(params.node.id!);
      if (idx > -1) history.splice(idx, 1);

      const combinedIdx = this.expandedNodesHistory.findIndex(
        (n) => n.id === params.node.id && n.isLeft === isLeft,
      );
      if (combinedIdx > -1) this.expandedNodesHistory.splice(combinedIdx, 1);
      return;
    }

    if (params.node.level !== (this.isGroupedBySection ? 2 : 1)) {
      return;
    }

    const history = isLeft
      ? this.recentlyExpandedNodesLeft
      : this.recentlyExpandedNodesRight;

    if (params.node.id && !history.includes(params.node.id)) {
      history.push(params.node.id);
    }

    // Add to global tracker
    if (params.node.id) {
      const route = params.node.getRoute() as string[] | undefined;
      if (route) {
        // Subcategory just opened, assume it loads with the default page size (10)
        this.expandedNodesHistory.push({
          id: params.node.id,
          isLeft,
          route,
          pageSize: 10,
          timestamp: Date.now(),
        });
      }
    }

    // Apply the "250 Document" cap logic instead of the hard '2 nodes' limit
    this.enforceDocumentLimit();
  }

  private enforceDocumentLimit(): void {
    let totalDocs = this.expandedNodesHistory.reduce(
      (sum, n) => sum + n.pageSize,
      0,
    );

    // If we're under the limit, do nothing
    if (totalDocs <= this.MAX_TOTAL_DOCUMENTS) {
      return;
    }

    // Sort by oldest first
    this.expandedNodesHistory.sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < this.expandedNodesHistory.length; i++) {
      const node = this.expandedNodesHistory[i];
      const api = node.isLeft ? this.leftGridApi : this.rightGridApi;

      if (!api) continue;

      // Try shrinking to 10
      if (node.pageSize > 10) {
        const reduction = node.pageSize - 10;
        node.pageSize = 10;
        totalDocs -= reduction;

        // Push the change to the grid via datasource
        this.currentDatasource?.changePageSize?.(node.route, 10, api);

        if (totalDocs <= this.MAX_TOTAL_DOCUMENTS) return; // Mission accomplished
      }

      // If still over limit, shrink to MIN_PAGE_SIZE (5)
      if (node.pageSize > this.MIN_PAGE_SIZE) {
        const reduction = node.pageSize - this.MIN_PAGE_SIZE;
        node.pageSize = this.MIN_PAGE_SIZE;
        totalDocs -= reduction;

        this.currentDatasource?.changePageSize?.(
          node.route,
          this.MIN_PAGE_SIZE,
          api,
        );

        if (totalDocs <= this.MAX_TOTAL_DOCUMENTS) return; // Mission accomplished
      }
    }

    // If STILL over limit (e.g. 51 nodes open at size 5 = 255 docs), start closing the oldest ones entirely
    while (
      totalDocs > this.MAX_TOTAL_DOCUMENTS &&
      this.expandedNodesHistory.length > 0
    ) {
      const oldestNode = this.expandedNodesHistory.shift()!;
      const api = oldestNode.isLeft ? this.leftGridApi : this.rightGridApi;

      if (api) {
        const rowNode = api.getRowNode(oldestNode.id);
        if (rowNode && rowNode.expanded) {
          api.setRowNodeExpanded(rowNode, false);
        }
      }

      // Also remove from the specific side's tracker so our histories stay in sync
      const history = oldestNode.isLeft
        ? this.recentlyExpandedNodesLeft
        : this.recentlyExpandedNodesRight;
      const idx = history.indexOf(oldestNode.id);
      if (idx > -1) history.splice(idx, 1);

      totalDocs -= oldestNode.pageSize;
    }
  }

  public changePageSizeSubcategory = (
    route: string[],
    size: number,
    api?: GridApi,
  ) => {
    if (
      this.currentDatasource &&
      this.currentDatasource.changePageSize &&
      api
    ) {
      const isLeft = api === this.leftGridApi;
      const category = route[route.length - 2];
      const subcategory = route[route.length - 1];

      // Update our global tracking when a user interacts with the pagination UI
      const id = `subcategory|${category}|${subcategory}`;
      const trackerNode = this.expandedNodesHistory.find(
        (n) => n.id === id && n.isLeft === isLeft,
      );
      if (trackerNode) {
        trackerNode.pageSize = size;
        trackerNode.timestamp = Date.now(); // bump it to 'newest' since they just interacted with it
      }

      api.forEachNode((node) => {
        if (
          node.data?.category === category &&
          node.data?.subcategory === subcategory &&
          node.data?.rowType === 'document'
        ) {
          node.data['isLoading'] = true;
        }
      });
      api.refreshCells({ force: true });

      this.currentDatasource.changePageSize(route, size, api);

      // Enforce limits immediately after changing size
      this.enforceDocumentLimit();
    }
  };

  runSearch(): void {
    const searchText = this.searchControl.value.trim();

    if (!searchText) {
      return;
    }

    this.executeSearch(searchText).subscribe();
  }

  private executeSearch(searchText: string) {
    this.searching = true;
    this.errorMessage = '';

    this.clearGrid();

    const request: DocumentSearchRequest = {
      Querytext: this.buildQueryText(searchText),
    };

    return this.documentJobService.startDocumentJob(request).pipe(
      switchMap((jobId: string) => {
        return this.documentJobService.pollUntilFinished(jobId).pipe(
          switchMap(() =>
            this.documentJobService.getCategoryCounts(jobId).pipe(
              map((categoryCountResponse) => ({
                jobId,
                summary: this.mapCategoryCountsToTreeSummary(
                  categoryCountResponse,
                ),
              })),
            ),
          ),
        );
      }),

      filter((result) => result.summary.categories.length > 0),

      tap((result) => {
        this.searching = false;
        this.showGrid = true;

        this.applySummaryToGrid(result.summary, result.jobId);
      }),

      catchError((error) => {
        console.error('Document search failed', error);
        this.errorMessage = 'Something went wrong while searching documents.';
        return EMPTY;
      }),

      finalize(() => {
        this.searching = false;
      }),
    );
  }

  private applySummaryToGrid(
    summary: DocumentTreeSummaryDto,
    jobId: string,
  ): void {
    if (!this.leftGridApi || this.leftGridApi.isDestroyed()) {
      this.pendingSummary = summary;
      this.pendingJobId = jobId;
      return;
    }

    this.currentDatasource = this.datasourceFactory.create(summary, jobId);

    this.leftGridApi.setGridOption(
      'serverSideDatasource',
      this.currentDatasource,
    );
    if (this.isSplitView && this.rightGridApi) {
      this.rightGridApi.setGridOption(
        'serverSideDatasource',
        this.currentDatasource,
      );
    }

    this.pendingSummary = undefined;
    this.pendingJobId = undefined;
  }

  private clearGrid(): void {
    const emptySummary: DocumentTreeSummaryDto = {
      categories: [],
    };

    const emptyJobId = 'empty-job';

    if (this.leftGridApi && !this.leftGridApi.isDestroyed()) {
      this.leftGridApi.setGridOption(
        'serverSideDatasource',
        this.datasourceFactory.create(emptySummary, emptyJobId),
      );
    }

    if (this.rightGridApi && !this.rightGridApi.isDestroyed()) {
      this.rightGridApi.setGridOption(
        'serverSideDatasource',
        this.datasourceFactory.create(emptySummary, emptyJobId),
      );
    }
  }

  private buildQueryText(searchText: string): string {
    return `(${searchText.trim()}) AND (Deleted: 0)`;
  }

  private mapCategoryCountsToTreeSummary(
    response: DocumentCategoryCountsResponse,
  ): DocumentTreeSummaryDto {
    const categoryMap = new Map<string, any>();

    const topLevelRows = response['Unassigned'] ?? [];

    topLevelRows.forEach((row) => {
      const categoryName = String(row.desc);
      const section = this.determineSection(categoryName);

      categoryMap.set(categoryName, {
        category: categoryName,
        section,
        documentCount: row.count ?? 0,
        subcategories: [],
      });
    });

    Object.entries(response).forEach(([categoryName, rows]) => {
      if (categoryName === 'Unassigned') {
        return;
      }

      let category = categoryMap.get(categoryName);

      if (!category) {
        const section = this.determineSection(categoryName);
        category = {
          category: categoryName,
          section,
          documentCount: 0,
          subcategories: [],
        };

        categoryMap.set(categoryName, category);
      }

      rows.forEach((row) => {
        category.subcategories.push({
          ...row,

          category: categoryName,
          subcategory: row.desc,
          section: category.section,
          documentCount: row.count ?? 0,
        });
      });

      category.documentCount = category.subcategories.reduce(
        (total: number, subcategory: any) =>
          total + (subcategory.documentCount ?? 0),
        0,
      );
    });

    return {
      categories: Array.from(categoryMap.values()),
    };
  }

  private determineSection(categoryName: string): string {
    if (categoryName === 'Finance' || categoryName === 'Legal') {
      return 'Section A';
    }
    if (categoryName === 'Management' || categoryName === 'Human Resources') {
      return 'Section B';
    }
    return 'Section C';
  }

  openAdvancedSearch(): void {
    this.showAdvancedSearch = true;
  }

  closeAdvancedSearch(): void {
    this.showAdvancedSearch = false;
  }

  runAdvancedSearch(query: DocumentAdvancedQuery): void {
    this.showAdvancedSearch = false;

    console.log('Advanced Query Object:', query);
    console.log('Query Text:', query.queryText);
    console.log('Summary:', query.summary);
    console.log('Model:', query.model);

    // Optional: show the summary in the search box
    this.searchControl.setValue(query.summary);
  }
}
