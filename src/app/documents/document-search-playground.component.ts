import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  ColDef,
  GridApi,
  GridOptions,
  GridReadyEvent
} from 'ag-grid-community';
import { AgGridAngular } from 'ag-grid-angular';
import { EMPTY } from 'rxjs';
import {
  catchError,
  filter,
  finalize,
  map,
  switchMap,
  tap
} from 'rxjs/operators';
import { DocumentJobService } from './document-job.service';
import { DocumentTreeDatasourceFactory, CustomServerSideDatasource } from './document-tree-datasource.factory';
import { PaginationCellRendererComponent } from './pagination-cell-renderer.component';
import {
  DocumentCategoryCountsResponse,
  DocumentSearchRequest,
  DocumentTreeRow,
  DocumentTreeSummaryDto
} from './document.models';

import 'ag-grid-enterprise';

@Component({
  selector: 'app-document-search-playground',
  standalone: true,
  imports: [CommonModule, AgGridAngular, ReactiveFormsModule, PaginationCellRendererComponent],
  templateUrl: './document-search-playground.component.html',
  styleUrls: ['./document-search-playground.component.scss']
})
export class DocumentSearchPlaygroundComponent {
  searchControl = new FormControl<string>('', { nonNullable: true });

  private leftGridApi?: GridApi<DocumentTreeRow>;
  private rightGridApi?: GridApi<DocumentTreeRow>;
  
  private pendingSummary?: DocumentTreeSummaryDto;
  private pendingJobId?: string;
  private currentDatasource?: CustomServerSideDatasource;

  searching = false;
  showGrid = true;
  isSplitView = false;
  errorMessage = '';
  isGroupedBySection = false;

  public changePageSubcategory = (route: string[], direction: number, api?: GridApi) => {
    if (this.currentDatasource && this.currentDatasource.changePage && api) {
      const category = route[route.length - 2];
      const subcategory = route[route.length - 1];
      
      api.forEachNode(node => {
        if (node.data?.category === category && node.data?.subcategory === subcategory && node.data?.rowType === 'document') {
          node.data['isLoading'] = true;
        }
      });
      api.refreshCells({ force: true });

      this.currentDatasource.changePage(route, direction, api);
    }
  };

  public changePageSizeSubcategory = (route: string[], size: number, api?: GridApi) => {
    if (this.currentDatasource && this.currentDatasource.changePageSize && api) {
      const category = route[route.length - 2];
      const subcategory = route[route.length - 1];
      
      api.forEachNode(node => {
        if (node.data?.category === category && node.data?.subcategory === subcategory && node.data?.rowType === 'document') {
          node.data['isLoading'] = true;
        }
      });
      api.refreshCells({ force: true });

      this.currentDatasource.changePageSize(route, size, api);
    }
  };

  toggleSplitView(): void {
    this.isSplitView = !this.isSplitView;
    if (this.isSplitView && this.currentDatasource && this.rightGridApi) {
        this.rightGridApi.setGridOption('serverSideDatasource', this.currentDatasource);
    }
  }

  toggleSectionGroup(): void {
    this.isGroupedBySection = !this.isGroupedBySection;
    
    const applyToApi = (api?: GridApi) => {
      if (api) {
        if (this.isGroupedBySection) {
          api.applyColumnState({
            state: [
              { colId: 'section', rowGroupIndex: 0 },
              { colId: 'category', rowGroupIndex: 1 },
              { colId: 'subcategory', rowGroupIndex: 2 }
            ]
          });
        } else {
          api.applyColumnState({
            state: [
              { colId: 'section', rowGroupIndex: null },
              { colId: 'category', rowGroupIndex: 0 },
              { colId: 'subcategory', rowGroupIndex: 1 }
            ]
          });
        }
      }
    };
    
    applyToApi(this.leftGridApi);
    applyToApi(this.rightGridApi);
    
    // Trigger a fresh search to rebuild tree if necessary
    if (this.searchControl.value.trim()) {
       this.runSearch();
    }
  }

  columnDefs: ColDef<DocumentTreeRow>[] = [
    {
      field: 'section',
      rowGroup: false, // Initially un-grouped
      enableRowGroup: true,
      hide: true
    },
    {
      field: 'category',
      rowGroup: true,
      enableRowGroup: true,
      hide: true
    },
    {
      field: 'subcategory',
      rowGroup: true,
      enableRowGroup: true,
      hide: true
    },
    {
      field: 'name',
      headerName: 'Document Name',
      flex: 2,
      minWidth: 250,
      cellRenderer: (params: any) => params.data?.rowType === 'document' ? (params.data?.['isLoading'] ? '<div class="skeleton-loader" style="width: 80%;"></div>' : params.data.name) : ''
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 120,
      cellRenderer: (params: any) => params.data?.rowType === 'document' ? (params.data?.['isLoading'] ? '<div class="skeleton-loader" style="width: 50%;"></div>' : params.data.type) : ''
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      cellRenderer: (params: any) => params.data?.rowType === 'document' ? (params.data?.['isLoading'] ? '<div class="skeleton-loader" style="width: 60%;"></div>' : params.data.status) : ''
    },
    {
      field: 'author',
      headerName: 'Author',
      width: 180,
      cellRenderer: (params: any) => params.data?.rowType === 'document' ? (params.data?.['isLoading'] ? '<div class="skeleton-loader" style="width: 80%;"></div>' : params.data.author) : ''
    },
    {
      field: 'createdDate',
      headerName: 'Created Date',
      width: 160,
      cellRenderer: (params: any) => params.data?.rowType === 'document' ? (params.data?.['isLoading'] ? '<div class="skeleton-loader" style="width: 70%;"></div>' : params.data.createdDate) : ''
    }
  ];

  defaultColDef: ColDef<DocumentTreeRow> = {
    flex: 1,
    minWidth: 100,
    resizable: true,
    sortable: true,
    filter: true
  };

  gridOptions: GridOptions<DocumentTreeRow> = {
    context: {
      componentParent: this
    },
    rowModelType: 'serverSide',

    // Normal row grouping. Do not use treeData or pivotMode.
    groupDisplayType: 'singleColumn',

    // Define full width row handling exclusively for our custom pagination row
    isFullWidthRow: params => {
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

          if (row.rowType === 'section' || row.rowType === 'category' || row.rowType === 'subcategory') {
            return `${groupName} (${row.documentCount ?? 0})`;
          }

          return '';
        }
      },
      cellClassRules: {
        'document-group-level-0': params => params.node.level === 0,
        'document-group-level-1': params => params.node.level === 1,
        'document-group-level-2': params => params.node.level === 2
      }
    },

    getRowId: params => {
      return params.data?.id ?? `${Date.now()}-${Math.random()}`;
    }
  };

  constructor(
    private documentJobService: DocumentJobService,
    private datasourceFactory: DocumentTreeDatasourceFactory
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
      this.rightGridApi.setGridOption('serverSideDatasource', this.currentDatasource);
    }
  }

  collapseAll(): void {
    if (this.leftGridApi) {
      this.leftGridApi.collapseAll();
    }
    if (this.rightGridApi) {
      this.rightGridApi.collapseAll();
    }
  }

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
      Querytext: this.buildQueryText(searchText)
    };

    return this.documentJobService.startDocumentJob(request).pipe(
      switchMap((jobId: string) => {
        return this.documentJobService.pollUntilFinished(jobId).pipe(
          switchMap(() =>
            this.documentJobService.getCategoryCounts(jobId).pipe(
              map(categoryCountResponse => ({
                jobId,
                summary: this.mapCategoryCountsToTreeSummary(categoryCountResponse)
              }))
            )
          )
        );
      }),

      filter(result => result.summary.categories.length > 0),

      tap(result => {
        this.searching = false;
        this.showGrid = true;

        this.applySummaryToGrid(result.summary, result.jobId);
      }),

      catchError(error => {
        console.error('Document search failed', error);
        this.errorMessage = 'Something went wrong while searching documents.';
        return EMPTY;
      }),

      finalize(() => {
        this.searching = false;
      })
    );
  }

  private applySummaryToGrid(
    summary: DocumentTreeSummaryDto,
    jobId: string
  ): void {
    if (!this.leftGridApi || this.leftGridApi.isDestroyed()) {
      this.pendingSummary = summary;
      this.pendingJobId = jobId;
      return;
    }

    this.currentDatasource = this.datasourceFactory.create(summary, jobId);

    this.leftGridApi.setGridOption('serverSideDatasource', this.currentDatasource);
    if (this.isSplitView && this.rightGridApi) {
      this.rightGridApi.setGridOption('serverSideDatasource', this.currentDatasource);
    }

    this.pendingSummary = undefined;
    this.pendingJobId = undefined;
  }

  private clearGrid(): void {
    const emptySummary: DocumentTreeSummaryDto = {
      categories: []
    };

    const emptyJobId = 'empty-job';

    if (this.leftGridApi && !this.leftGridApi.isDestroyed()) {
      this.leftGridApi.setGridOption(
        'serverSideDatasource',
        this.datasourceFactory.create(emptySummary, emptyJobId)
      );
    }
    
    if (this.rightGridApi && !this.rightGridApi.isDestroyed()) {
      this.rightGridApi.setGridOption(
        'serverSideDatasource',
        this.datasourceFactory.create(emptySummary, emptyJobId)
      );
    }
  }

  private buildQueryText(searchText: string): string {
    return `(${searchText.trim()}) AND (Deleted: 0)`;
  }

  private mapCategoryCountsToTreeSummary(
    response: DocumentCategoryCountsResponse
  ): DocumentTreeSummaryDto {
    const categoryMap = new Map<string, any>();

    const topLevelRows = response['Unassigned'] ?? [];

    topLevelRows.forEach(row => {
      const categoryName = String(row.desc);
      const section = this.determineSection(categoryName);

      categoryMap.set(categoryName, {
        category: categoryName,
        section,
        documentCount: row.count ?? 0,
        subcategories: []
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
          subcategories: []
        };

        categoryMap.set(categoryName, category);
      }

      rows.forEach(row => {
        category.subcategories.push({
          ...row,

          category: categoryName,
          subcategory: row.desc,
          section: category.section,
          documentCount: row.count ?? 0
        });
      });

      category.documentCount = category.subcategories.reduce(
        (total: number, subcategory: any) =>
          total + (subcategory.documentCount ?? 0),
        0
      );
    });

    return {
      categories: Array.from(categoryMap.values())
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
}
