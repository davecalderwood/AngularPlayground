import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  GroupedDataBrowserComponent,
  GroupedDataBrowserConfig,
  GroupedDataBrowserSearchCommand,
  GroupedDataNode,
  GroupedDataPageRequest,
  GroupedDataRowActionRequest,
  GroupedDataSortRequest,
} from '../grouped-data-browser';

interface AssetRow {
  id: string;
  assetName: string;
  assetType: string;
  site: string;
  condition: string;
  sectionId: string;
  categoryId: string;
  subcategoryId: string;
}

interface AssetSection {
  id: string;
  label: string;
  categories: AssetCategory[];
}

interface AssetCategory {
  id: string;
  label: string;
  subcategories: Array<{ id: string; label: string }>;
}

@Component({
  selector: 'app-asset-catalog-demo',
  standalone: true,
  imports: [
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
export class AssetCatalogDemoComponent {
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
      ],
    },
    emptyMessage: 'No assets match this selection.',
  };

  private readonly sections: AssetSection[] = [
    {
      id: 'buildings',
      label: 'Buildings',
      categories: [
        {
          id: 'access-systems',
          label: 'Access Systems',
          subcategories: [{ id: 'badge-readers', label: 'Badge Readers' }],
        },
        {
          id: 'climate-control',
          label: 'Climate Control',
          subcategories: [{ id: 'air-handlers', label: 'Air Handlers' }],
        },
      ],
    },
    {
      id: 'fleet',
      label: 'Fleet',
      categories: [
        {
          id: 'service-vehicles',
          label: 'Service Vehicles',
          subcategories: [
            { id: 'light-trucks', label: 'Light Trucks' },
            { id: 'utility-vans', label: 'Utility Vans' },
          ],
        },
        {
          id: 'safety-equipment',
          label: 'Safety Equipment',
          subcategories: [{ id: 'fire-extinguishers', label: 'Fire Extinguishers' }],
        },
      ],
    },
  ];

  private readonly allAssets: AssetRow[] = [
    { id: 'a-101', assetName: 'North lobby reader', assetType: 'Card reader', site: 'North Campus', condition: 'Operational', sectionId: 'buildings', categoryId: 'access-systems', subcategoryId: 'badge-readers' },
    { id: 'a-102', assetName: 'Loading dock reader', assetType: 'Card reader', site: 'North Campus', condition: 'Service due', sectionId: 'buildings', categoryId: 'access-systems', subcategoryId: 'badge-readers' },
    { id: 'a-103', assetName: 'Research wing reader', assetType: 'Card reader', site: 'West Campus', condition: 'Operational', sectionId: 'buildings', categoryId: 'access-systems', subcategoryId: 'badge-readers' },
    { id: 'a-201', assetName: 'Boiler room air handler', assetType: 'HVAC', site: 'North Campus', condition: 'Operational', sectionId: 'buildings', categoryId: 'climate-control', subcategoryId: 'air-handlers' },
    { id: 'a-202', assetName: 'Atrium air handler', assetType: 'HVAC', site: 'West Campus', condition: 'Inspection due', sectionId: 'buildings', categoryId: 'climate-control', subcategoryId: 'air-handlers' },
    { id: 'a-301', assetName: 'Field service truck 14', assetType: 'Pickup truck', site: 'North Depot', condition: 'Operational', sectionId: 'fleet', categoryId: 'service-vehicles', subcategoryId: 'light-trucks' },
    { id: 'a-302', assetName: 'Field service truck 22', assetType: 'Pickup truck', site: 'West Depot', condition: 'Operational', sectionId: 'fleet', categoryId: 'service-vehicles', subcategoryId: 'light-trucks' },
    { id: 'a-303', assetName: 'Utility van 08', assetType: 'Cargo van', site: 'North Depot', condition: 'Service due', sectionId: 'fleet', categoryId: 'service-vehicles', subcategoryId: 'utility-vans' },
    { id: 'a-401', assetName: 'Workshop extinguisher 3A', assetType: 'Fire safety', site: 'North Depot', condition: 'Inspection due', sectionId: 'fleet', categoryId: 'safety-equipment', subcategoryId: 'fire-extinguishers' },
  ];

  searchText = '';
  searchCommand: GroupedDataBrowserSearchCommand | null = null;
  selectedNodeId: string | null = null;
  hierarchy = this.createHierarchy(this.allAssets);
  rows = this.allAssets.slice(0, this.browserConfig.pageSize);
  totalRecords = this.allAssets.length;
  currentPage = 0;
  loading = false;
  actionFeedback = '';

  private activeAssets = this.allAssets;
  private readonly markedForDeletionIds = new Set<string>();
  private searchRequestId = 0;
  private lastPageRequest: GroupedDataPageRequest | null = null;
  private activeSort: GroupedDataSortRequest | null = null;

  requestSearch(): void {
    this.searchCommand = {
      requestId: ++this.searchRequestId,
      query: this.searchText,
    };
  }

  onBrowserSearch(query: string): void {
    const normalizedQuery = query.toLocaleLowerCase();
    this.activeAssets = this.allAssets.filter(asset =>
      `${asset.assetName} ${asset.assetType} ${asset.site} ${asset.condition}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    );
    this.hierarchy = this.createHierarchy(this.activeAssets);
    this.selectedNodeId = null;
    this.totalRecords = this.activeAssets.length;
    this.currentPage = 0;
    this.rows = this.activeAssets.slice(0, this.browserConfig.pageSize);
    this.lastPageRequest = null;
  }

  onNodeSelected(node: GroupedDataNode): void {
    this.totalRecords = node.count;
  }

  loadPage(request: GroupedDataPageRequest): void {
    this.lastPageRequest = request;
    this.currentPage = request.pageIndex;
    this.loading = true;

    const rows = request.pagePlan.segments.flatMap(segment => {
      const metadata = segment.metadata ?? {};
      const matchingAssets = this.activeAssets.filter(asset =>
        Object.entries(metadata).every(([key, value]) => asset[key as keyof AssetRow] === value)
      );
      return matchingAssets.slice(segment.offset, segment.offset + segment.take);
    });

    this.rows = this.sortRows(rows.map(row =>
      this.markedForDeletionIds.has(row.id) ? { ...row, condition: 'Marked for deletion' } : row
    ));
    this.loading = false;
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

  private sortRows(rows: AssetRow[]): AssetRow[] {
    if (!this.activeSort?.column || !this.activeSort.direction) {
      return rows;
    }

    const { column, direction } = this.activeSort;
    return [...rows].sort((left, right) => {
      const leftValue = String(left[column as keyof AssetRow] ?? '');
      const rightValue = String(right[column as keyof AssetRow] ?? '');
      return leftValue.localeCompare(rightValue) * (direction === 'asc' ? 1 : -1);
    });
  }

  private createHierarchy(rows: AssetRow[]): GroupedDataNode[] {
    const sections = this.sections.flatMap(section => {
      const categories = section.categories.flatMap(category => {
        const subcategories = category.subcategories.flatMap(subcategory => {
          const count = rows.filter(asset => asset.subcategoryId === subcategory.id).length;
          return count > 0 ? [{
            id: subcategory.id,
            label: subcategory.label,
            count,
            type: 'subcategory',
            metadata: {
              sectionId: section.id,
              categoryId: category.id,
              subcategoryId: subcategory.id,
            },
          }] : [];
        });
        const count = subcategories.reduce((total, subcategory) => total + subcategory.count, 0);
        return count > 0 ? [{
          id: category.id,
          label: category.label,
          count,
          type: 'category',
          metadata: { sectionId: section.id, categoryId: category.id },
          children: subcategories,
        }] : [];
      });
      const count = categories.reduce((total, category) => total + category.count, 0);
      return count > 0 ? [{
        id: section.id,
        label: section.label,
        count,
        type: 'section',
        metadata: { sectionId: section.id },
        children: categories,
      }] : [];
    });

    return [{
      id: 'all-assets',
      label: 'All Assets',
      count: rows.length,
      type: 'all',
      children: sections,
    }];
  }
}