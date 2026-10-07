import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { forkJoin, of, Subscription } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
  GroupedDataBrowserComponent,
  GroupedDataBrowserConfig,
  GroupedDataBrowserSearchCommand,
  GroupedDataNode,
  GroupedDataPageRequest,
  GroupedDataRowActionRequest,
  GroupedDataSortRequest,
} from '../grouped-data-browser';
import { AssetCatalogApiService } from './api/asset-catalog-api.service';
import {
  AssetRow,
  mapAssetRecordToRow,
  mapPagePlanToQueries,
  mapTableDescToNodes,
} from './mappers/asset-catalog.mappers';

@Component({
  selector: 'app-asset-catalog-demo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    GroupedDataBrowserComponent,
  ],
  templateUrl: './asset-catalog-demo.component.html',
  styleUrl: './asset-catalog-demo.component.scss',
})
export class AssetCatalogDemoComponent implements OnDestroy {
  readonly browserConfig: GroupedDataBrowserConfig<AssetRow> = {
    pageSize: 250,
    columns: [
      { field: 'assetName', headerName: 'Asset', sortable: true, flex: 1 },
      { field: 'assetType', headerName: 'Type', sortable: true, flex: 1 },
      { field: 'site', headerName: 'Site', sortable: true, flex: 1 },
      { field: 'condition', headerName: 'Condition', sortable: true, flex: 1 },
    ],
    navigation: {
      enabled: true,
      defaultExpanded: true,
      showCounts: true,
      rootLabel: 'All Assets',
    },
    pagination: { enabled: true, showTotal: true },
    sorting: { enabled: true, serverSide: true },
    getRowId: row => row.id,
    rowActions: {
      headerName: 'Actions',
      actions: [
        { id: 'flag-for-review', label: 'Flag for review', icon: 'flag' },
        { id: 'mark-for-deletion', label: 'Mark for deletion', icon: 'delete' },
        { id: 'mark-for-deletion2', label: 'Mark for deletion', icon: 'check' },
      ],
    },
    emptyMessage: 'No assets match this selection.',
  };

  searchText = '';
  searchCommand: GroupedDataBrowserSearchCommand | null = null;
  selectedNodeId: string | null = null;
  hierarchy: GroupedDataNode[] = [];
  rows: AssetRow[] = [];
  totalRecords = 0;
  currentPage = 0;
  loading = false;
  searching = false;
  actionFeedback = '';

  private jobId: string | null = null;
  private readonly markedForDeletionIds = new Set<string>();
  private searchRequestId = 0;
  private lastPageRequest: GroupedDataPageRequest | null = null;
  private activeSort: GroupedDataSortRequest | null = null;
  private searchSubscription?: Subscription;
  private pageSubscription?: Subscription;

  constructor(private readonly api: AssetCatalogApiService) {}

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.pageSubscription?.unsubscribe();
  }

  requestSearch(): void {
    this.searchCommand = {
      requestId: ++this.searchRequestId,
      query: this.searchText,
    };
  }

  // Step 1: start the job, poll it, then get the table desc (counts) and build the nav.
  onBrowserSearch(query: string): void {
    this.searchSubscription?.unsubscribe();
    this.pageSubscription?.unsubscribe();

    this.searching = true;
    this.loading = false;
    this.jobId = null;
    this.hierarchy = [];
    this.rows = [];
    this.totalRecords = 0;
    this.currentPage = 0;
    this.selectedNodeId = null;
    this.lastPageRequest = null;

    this.searchSubscription = this.api.startSearch(query).pipe(
      switchMap(jobId => this.api.pollUntilFinished(jobId).pipe(
        switchMap(() => this.api.getTableDesc(jobId)),
        map(tableDesc => ({ jobId, tableDesc }))
      ))
    ).subscribe({
      next: ({ jobId, tableDesc }) => {
        this.jobId = jobId;
        this.searching = false;
        // Setting the hierarchy makes the browser select the root and request page 0.
        this.hierarchy = mapTableDescToNodes(tableDesc);
      },
      error: () => { this.searching = false; },
    });
  }

  onNodeSelected(node: GroupedDataNode): void {
    this.totalRecords = node.count;
  }

  // Step 2: the nav exists, so query the table once per page-plan segment.
  loadPage(request: GroupedDataPageRequest): void {
    const jobId = this.jobId;
    if (!jobId) {
      return;
    }

    this.pageSubscription?.unsubscribe();
    this.lastPageRequest = request;
    this.currentPage = request.pageIndex;
    this.loading = true;

    const queries = mapPagePlanToQueries(request.pagePlan, this.activeSort);
    const segmentResults$ = queries.length
      ? forkJoin(queries.map(query => this.api.queryTable(jobId, query)))
      : of([]);

    this.pageSubscription = segmentResults$.pipe(
      map(results => results.flat().map(mapAssetRecordToRow)),
      map(rows => rows.map(row =>
        this.markedForDeletionIds.has(row.id) ? { ...row, condition: 'Marked for deletion' } : row
      ))
    ).subscribe({
      next: rows => {
        this.rows = rows;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  onRowAction(request: GroupedDataRowActionRequest<AssetRow>): void {
    console.info('Asset row action requested', request);

    if (request.action.id === 'mark-for-deletion' && request.rowId) {
      this.markedForDeletionIds.add(request.rowId);
      this.rows = this.rows.map(row =>
        row.id === request.rowId ? { ...row, condition: 'Marked for deletion' } : row
      );
      this.actionFeedback = `${request.row.assetName} marked for deletion.`;
      return;
    }

    this.actionFeedback = `${request.row.assetName} flagged for review.`;
  }

  onSortChanged(request: GroupedDataSortRequest): void {
    this.activeSort = request;
    if (this.lastPageRequest) {
      this.loadPage(this.lastPageRequest);
    }
  }

}