import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTreeModule, MatTree } from '@angular/material/tree';
// Remove deprecated NestedTreeControl
// import { NestedTreeControl } from '@angular/cdk/tree';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridReadyEvent } from 'ag-grid-community';

import { Subject, of, EMPTY, Subscription } from 'rxjs';
import {
  switchMap,
  filter,
  tap,
  catchError,
  finalize,
  map,
  takeUntil,
} from 'rxjs/operators';

import { DocumentJobService } from '../../documents/document-job.service';
import {
  DocumentSearchRequest,
  DocumentCategoryCountsResponse,
  PaginatedTableSet,
} from '../../documents/document.models';
import { PagePlanningService } from '../services/page-planning.service';
import { ToastNotificationService } from '../services/toast-notification.service';
import { NavigationStateService } from '../services/navigation-state.service';
import { PageCacheService } from '../services/page-cache.service';
import { DocumentFetchService } from '../services/document-fetch.service';
import { DocumentCacheService } from '../services/document-cache.service';
import { SubcategoryCount } from '../models/document-page.model';

interface DocumentNode {
  id: string;
  name: string;
  count: number;
  type: 'all' | 'section' | 'category' | 'subcategory';
  section?: string;
  category?: string;
  subcategory?: string;
  children?: DocumentNode[];
}

@Component({
  selector: 'app-document-search-v2',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTreeModule,
    AgGridAngular,
  ],
  templateUrl: './document-search-v2.component.html',
  styleUrls: ['./document-search-v2.component.scss'],
})
export class DocumentSearchV2Component implements OnInit, OnDestroy, AfterViewInit {
  searchText = '';
  groupBy = 'category';
  searching = false;
  loadingGrid = false;

  treeData: DocumentNode[] = [];

  // Use simple children accessor for generic tree
  childrenAccessor = (node: DocumentNode) => node.children ?? [];
  hasChild = (_: number, node: DocumentNode) =>
    !!node.children && node.children.length > 0;

  // Grid tracking
  rowData: PaginatedTableSet[] = [];
  columnDefs: ColDef[] = [
    { field: 'category_desc', headerName: 'Category', sortable: true },
    { field: 'subcategory_desc', headerName: 'Subcategory', sortable: true },
    { field: 'name', headerName: 'Name', sortable: true },
    { field: 'type', headerName: 'Type', sortable: true },
    { field: 'status', headerName: 'Status', sortable: true },
    { field: 'author', headerName: 'Author', sortable: true },
    { field: 'created_date', headerName: 'Created Date', sortable: true },
  ];

  // Pagination state
  currentPage = 0;
  pageSize = 250;
  totalFilteredDocs = 0;

  // Tracking
  activeFilterNode: DocumentNode | null = null;
  flattenedSubcategories: SubcategoryCount[] = [];
  currentJobId: string | null = null;

  // Cancellation handling
  private destroy$ = new Subject<void>();
  private currentRequest$ = new Subject<void>(); // triggers cancellation of in-flight requests

  // Custom sorting tracking
  activeSortColumn: string | null = null;
  activeSortDirection: 'asc' | 'desc' | null = null;

  @ViewChild(MatTree) tree!: MatTree<DocumentNode, DocumentNode>;

  constructor(
    private documentJobService: DocumentJobService,
    private pagePlanningService: PagePlanningService,
    private toastService: ToastNotificationService,
    private navStateService: NavigationStateService,
    private cacheService: PageCacheService,
    private documentFetchService: DocumentFetchService,
    private documentCacheService: DocumentCacheService, // To initialize cache opts
  ) {}

  ngOnInit(): void {
    const cachedTree = this.cacheService.get('docTree');
    if (cachedTree) {
      this.treeData = cachedTree;
      this.ensureExpansionAndSelection();
    }

    this.pagePlanningService.searchAction$
      .pipe(takeUntil(this.destroy$))
      .subscribe((query) => {
        this.executeSearch(query);
      });
  }

  // To make sure expandAll gets called when cached data is loaded
  ngAfterViewInit() {
    if(this.treeData.length > 0) {
      setTimeout(() => {
        this.ensureExpansionAndSelection();
      }, 0);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.currentRequest$.next();
    this.currentRequest$.complete();
  }

  onSearch() {
    const query = this.searchText.trim();
    if (!query) return;
    this.pagePlanningService.triggerSearch(query);
  }

  onGroupByChange() {
    if (this.searchText.trim()) {
      this.onSearch();
    }
  }

  private executeSearch(query: string) {
    // Cancel previous search and page loads
    this.cancelCurrentRequest('New search started');

    this.searching = true;
    this.treeData = [];
    this.rowData = [];
    this.activeFilterNode = null;
    this.currentJobId = null;

    // Clear document cache for new search
    this.documentCacheService.clearAll();

    const request: DocumentSearchRequest = {
      Querytext: query,
    };

    // Assuming we could pass groupBy logic, though not in the DocumentSearchRequest model yet
    // request.GroupBy = this.groupBy;

    this.documentJobService
      .startDocumentJob(request)
      .pipe(
        switchMap((jobId) =>
          this.documentJobService
            .pollUntilFinished(jobId)
            .pipe(
              switchMap(() =>
                this.documentJobService
                  .getCategoryCounts(jobId)
                  .pipe(map((res) => ({ jobId, res }))),
              ),
            ),
        ),
        takeUntil(this.currentRequest$),
        catchError((err) => {
          this.searching = false;
          return EMPTY;
        }),
        finalize(() => {
          this.searching = false;
        }),
      )
      .subscribe(({ jobId, res }) => {
        this.currentJobId = jobId;

        const treeData = this.buildTreeData(res);
        this.treeData = treeData;
        this.cacheService.set('docTree', treeData);

        // A timeout is needed to allow the tree to render before expanding it
        setTimeout(() => {
          this.ensureExpansionAndSelection();
        }, 0);
      });
  }

  private cancelCurrentRequest(reason: string) {
    this.currentRequest$.next();
  }

  private ensureExpansionAndSelection() {
    // Expand all nodes by default
    if (this.tree) {
      this.tree.expandAll();
    }

    // Default to "All Documents" if not already set, or if tree reloads
    if (!this.activeFilterNode) {
      const allDocs = this.treeData.find((n) => n.type === 'all');
      if (allDocs) {
        this.onNodeClick(allDocs);
      }
    }
  }

  private buildTreeData(
    response: DocumentCategoryCountsResponse,
  ): DocumentNode[] {
    const allDocsNode: DocumentNode = {
      id: 'all-documents',
      name: 'All Documents',
      count: 0,
      type: 'all',
      children: [],
    };

    let totalDocs = 0;

    if (this.groupBy === 'section') {
      const sectionMap = new Map<string, { count: number; categories: Map<string, { count: number; subcategories: DocumentNode[] }> }>();

      for (const [categoryName, countsArray] of Object.entries(response)) {
        for (const item of countsArray) {
          if (item.parent_desc !== null) {
            const sectionName = item.section_desc || 'Unassigned';
            if (!sectionMap.has(sectionName)) {
              sectionMap.set(sectionName, { count: 0, categories: new Map() });
            }
            const sectionData = sectionMap.get(sectionName)!;
            sectionData.count += item.count;
            
            if (!sectionData.categories.has(categoryName)) {
               sectionData.categories.set(categoryName, { count: 0, subcategories: [] });
            }
            const categoryData = sectionData.categories.get(categoryName)!;
            categoryData.count += item.count;

            categoryData.subcategories.push({
              id: `subcat-${item.parent_desc}-${item.desc}`,
              name: item.desc,
              count: item.count,
              type: 'subcategory',
              section: sectionName,
              category: item.parent_desc,
              subcategory: item.desc,
            });

            this.documentCacheService.initializeSubcategory(item.desc, {
              totalDocumentCount: item.count,
            });
            totalDocs += item.count;
          }
        }
      }

      for (const [sectionName, sectionData] of sectionMap.entries()) {
        const categoryNodes: DocumentNode[] = [];
        for (const [catName, catData] of sectionData.categories.entries()) {
           categoryNodes.push({
              id: `cat-${sectionName}-${catName}`,
              name: catName,
              count: catData.count,
              type: 'category',
              section: sectionName,
              category: catName,
              children: catData.subcategories,
           });
        }

        allDocsNode.children!.push({
          id: `sec-${sectionName}`,
          name: sectionName,
          count: sectionData.count,
          type: 'section',
          section: sectionName,
          children: categoryNodes,
        });
      }

    } else {
      // Default: category/subcategory
      for (const [categoryName, countsArray] of Object.entries(response)) {
        let catTotal = 0;
        const subcatNodes: DocumentNode[] = [];

        for (const item of countsArray) {
          if (item.parent_desc !== null) {
            catTotal += item.count;
            subcatNodes.push({
              id: `subcat-${item.parent_desc}-${item.desc}`,
              name: item.desc,
              count: item.count,
              type: 'subcategory',
              category: item.parent_desc,
              subcategory: item.desc,
            });

            // Initialize cache tracking for each subcategory
            this.documentCacheService.initializeSubcategory(item.desc, {
              totalDocumentCount: item.count,
            });
          }
        }

        if (subcatNodes.length > 0) {
          allDocsNode.children!.push({
            id: `cat-${categoryName}`,
            name: categoryName,
            count: catTotal,
            type: 'category',
            category: categoryName,
            children: subcatNodes,
          });
          totalDocs += catTotal;
        }
      }
    }

    allDocsNode.count = totalDocs;
    return [allDocsNode];
  }

  onNodeClick(node: DocumentNode) {
    this.cancelCurrentRequest('Changed filters');
    this.navStateService.setSelectedNode(node.id);
    this.activeFilterNode = node;

    // Calculate flattened subcategories based on the node clicked
    this.flattenedSubcategories = this.flattenTreeForFilter(node);
    this.totalFilteredDocs = node.count;

    this.loadPage(0);
  }

  private flattenTreeForFilter(filterNode: DocumentNode): SubcategoryCount[] {
    const result: SubcategoryCount[] = [];

    if (filterNode.type === 'subcategory') {
      result.push({
        category: filterNode.category!,
        subcategory: filterNode.subcategory!,
        documentCount: filterNode.count,
      });
    } else if (filterNode.type === 'category') {
      if (filterNode.children) {
        for (const child of filterNode.children) {
          result.push({
            category: child.category!,
            subcategory: child.subcategory!,
            documentCount: child.count,
          });
        }
      }
    } else if (filterNode.type === 'section') {
      if (filterNode.children) {
        for (const cat of filterNode.children) {
          if (cat.children) {
            for (const child of cat.children) {
              result.push({
                category: child.category!,
                subcategory: child.subcategory!,
                documentCount: child.count,
              });
            }
          }
        }
      }
    } else if (filterNode.type === 'all') {
      // If "all" is selected, we push a single special entry to bypass subcategory grouping
      result.push({
        category: 'All',
        subcategory: 'All',
        documentCount: filterNode.count,
      });
    }

    return result;
  }

  onSortChanged(event: any) {
    const sortState = event.api.getSortModel();
    if (sortState.length > 0) {
      const { colId, sort } = sortState[0];
      this.activeSortColumn = colId;
      this.activeSortDirection = sort;
      this.documentCacheService.clearAllActiveSorts();
      
      let sortingLocally = true;
      if (this.activeFilterNode?.type === 'all') {
          this.documentCacheService.initializeSubcategory('GLOBAL_SORT', { totalDocumentCount: 0, activeSort: `${colId}|${sort}`});
      }

      this.flattenedSubcategories.forEach((subcat) => {
          this.documentCacheService.activeSortSubcategory(subcat.subcategory, colId, sort);
          if (!this.documentCacheService.isComplete(subcat.subcategory)) {
              sortingLocally = false;
          }
      });
      // Force reload page 0 from backend with sort on entire set
      if(!sortingLocally || this.activeFilterNode?.type === 'all'){
          // This will re-fetch the page from backend with the new active sort
          this.loadPage(0);
      } else {
         // Sort was done locally in the cache already
         this.loadPage(0);
      }
    } else {
        this.activeSortColumn = null;
        this.activeSortDirection = null;
        this.documentCacheService.clearAllActiveSorts();
        this.loadPage(0);
    }
  }

  // Paging controls
  nextPage() {
    if ((this.currentPage + 1) * this.pageSize < this.totalFilteredDocs) {
      this.cancelCurrentRequest('Changed pages');
      this.loadPage(this.currentPage + 1);
    }
  }

  prevPage() {
    if (this.currentPage > 0) {
      this.cancelCurrentRequest('Changed pages');
      this.loadPage(this.currentPage - 1);
    }
  }

  get paginationDisplay(): string {
    const start = this.currentPage * this.pageSize + 1;
    const end = Math.min(
      (this.currentPage + 1) * this.pageSize,
      this.totalFilteredDocs,
    );
    const totalPages = Math.ceil(this.totalFilteredDocs / this.pageSize);

    if (this.totalFilteredDocs === 0) return 'No documents found';

    return `Showing ${start}-${end} of ${this.totalFilteredDocs} | Page ${this.currentPage + 1} of ${totalPages || 1}`;
  }

  private loadPage(pageIndex: number) {
    if (!this.currentJobId) return;

    this.currentPage = pageIndex;

    const pagePlan = this.pagePlanningService.calculatePagePlan(
      this.flattenedSubcategories,
      this.currentPage,
      this.pageSize,
    );

    this.loadingGrid = true;
    this.rowData = []; // clear while loading

    this.documentFetchService
      .fetchPage(this.currentJobId, pagePlan)
      .pipe(
        takeUntil(this.currentRequest$),
        tap(() => {
          // Detailed segment toasts can be annoying, just doing a summary log
        }),
        finalize(() => {
          this.loadingGrid = false;
        }),
      )
      .subscribe((docs) => {
        this.rowData = docs;
      });
  }

  isNodeActive(node: DocumentNode): boolean {
    return this.activeFilterNode?.id === node.id;
  }

  isNodeHighlighted(node: DocumentNode): boolean {
    if (!this.activeFilterNode) return false;

    // If we clicked All, everything is highlighted
    if (this.activeFilterNode.type === 'all') return true;

    // If section, highlight section and its children (categories and subcategories)
    if (
      this.activeFilterNode.type === 'section' &&
      (node.id === this.activeFilterNode.id ||
        node.section === this.activeFilterNode.section)
    ) {
      return true;
    }

    // If category, highlight category and its children
    if (
      this.activeFilterNode.type === 'category' &&
      (node.id === this.activeFilterNode.id ||
        node.category === this.activeFilterNode.category)
    ) {
      return true;
    }

    // If subcategory, highlight just the subcategory and its parent category (and section if applicable)
    if (this.activeFilterNode.type === 'subcategory') {
      if (
        node.id === this.activeFilterNode.id ||
        (node.type === 'category' &&
          node.category === this.activeFilterNode.category) ||
        (node.type === 'section' &&
          node.section === this.activeFilterNode.section)
      ) {
        return true;
      }
    }

    return false;
  }
}
