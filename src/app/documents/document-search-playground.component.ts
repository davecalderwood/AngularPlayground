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

  private gridApi?: GridApi<DocumentTreeRow>;
  private pendingSummary?: DocumentTreeSummaryDto;
  private pendingJobId?: string;
  private currentDatasource?: CustomServerSideDatasource;

  searching = false;
  showGrid = true;
  errorMessage = '';

  public changePageSubcategory = (route: string[], direction: number) => {
    if (this.currentDatasource && this.currentDatasource.changePage && this.gridApi) {
      const [category, subcategory] = route;
      
      this.gridApi.forEachNode(node => {
        if (node.data?.category === category && node.data?.subcategory === subcategory && node.data?.rowType === 'document') {
          node.data['isLoading'] = true;
        }
      });
      this.gridApi.refreshCells({ force: true });

      this.currentDatasource.changePage(route, direction, this.gridApi);
    }
  };

  public changePageSizeSubcategory = (route: string[], size: number) => {
    if (this.currentDatasource && this.currentDatasource.changePageSize && this.gridApi) {
      const [category, subcategory] = route;
      
      this.gridApi.forEachNode(node => {
        if (node.data?.category === category && node.data?.subcategory === subcategory && node.data?.rowType === 'document') {
          node.data['isLoading'] = true;
        }
      });
      this.gridApi.refreshCells({ force: true });

      this.currentDatasource.changePageSize(route, size, this.gridApi);
    }
  };

  columnDefs: ColDef<DocumentTreeRow>[] = [
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

    // Removed global pagination logic (pagination: true, paginateChildRows: true)
    // Server-Side Row Model instead relies on Infinite Scrolling per group!
    // As you scroll down an expanded subcategory, it fetches cacheBlockSize (15) at a time.
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

          if (row.rowType === 'category' || row.rowType === 'subcategory') {
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

  onGridReady(params: GridReadyEvent<DocumentTreeRow>): void {
    this.gridApi = params.api;

    if (this.pendingSummary && this.pendingJobId) {
      this.applySummaryToGrid(this.pendingSummary, this.pendingJobId);
    }
  }

  collapseAll(): void {
    if (this.gridApi) {
      this.gridApi.collapseAll();
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
    if (!this.gridApi || this.gridApi.isDestroyed()) {
      this.pendingSummary = summary;
      this.pendingJobId = jobId;
      return;
    }

    this.currentDatasource = this.datasourceFactory.create(summary, jobId);

    this.gridApi.setGridOption('serverSideDatasource', this.currentDatasource);

    this.pendingSummary = undefined;
    this.pendingJobId = undefined;
  }

  private clearGrid(): void {
    if (!this.gridApi || this.gridApi.isDestroyed()) {
      return;
    }

    const emptySummary: DocumentTreeSummaryDto = {
      categories: []
    };

    const emptyJobId = 'empty-job';

    this.gridApi.setGridOption(
      'serverSideDatasource',
      this.datasourceFactory.create(emptySummary, emptyJobId)
    );
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

      categoryMap.set(categoryName, {
        category: categoryName,
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
        category = {
          category: categoryName,
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
}
