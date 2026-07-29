export interface TreeLevelDefinition {
  key: string;
  label: string;
  backendColumn: string;
}

export interface DocumentTreeConfiguration {
  levels: TreeLevelDefinition[];
  defaultPageSize: number;
}

export interface DocumentTreeNode {
  id: string;
  name: string;
  
  levelKey: string;
  levelIndex: number;
  value: string;
  
  documentCount: number;
  
  pathValues: Record<string, string>;
  
  children: DocumentTreeNode[];
}

export interface DocumentSearchRequest {
  Querytext: string;
}

export type DocumentJobStatus = 'processing' | 'done';

export interface DocumentCategoryCounts {
  section_desc: string;
  parent_desc: string | null;
  desc: string;
  count: number;
}

export type DocumentCategoryCountsResponse = Record<string, DocumentCategoryCounts[]>;

export interface DocumentTreeSummaryDto {
  categories: CategorySummaryDto[];
}

export interface CategorySummaryDto {
  category: string;
  section?: string; // Added section
  documentCount: number;
  subcategories: SubcategorySummaryDto[];

  // Allow future passthrough properties from API
  [key: string]: any;
}

export interface SubcategorySummaryDto {
  category: string;
  subcategory: string;
  section?: string; // Added section
  documentCount: number;

  // Allow future passthrough properties from API
  [key: string]: any;
}

export type DocumentTreeRowType = 'section' | 'category' | 'subcategory' | 'document' | 'pagination';

export interface DocumentTreeRow {
  id: string;
  rowType: DocumentTreeRowType;

  section?: string;
  category?: string;
  subcategory?: string;

  name?: string;
  documentCount?: number;

  documentId?: number;
  type?: string;
  status?: string;
  author?: string;
  createdDate?: string;

  category_desc?: string;
  subcategory_desc?: string;

  pageNumber?: number;
  totalPages?: number;
  pageSize?: number;

  [key: string]: any;
}

export interface QueryTableRequest {
  offset: number;
  page_size: number;
  filter_by: string;
  order_by: string;
}

export interface PaginatedTableSet {
  category: number;
  id: number;
  name: string;
  section_desc: string;
  category_desc: string;
  subcategory_desc: string;
  type: string;
  status: string;
  author: string;
  created_date: string;

  [key: string]: any;
}
