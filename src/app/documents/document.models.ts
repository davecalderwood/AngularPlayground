export interface DocumentSearchRequest {
  Querytext: string;
}

export type DocumentJobStatus = 'processing' | 'done';

export interface DocumentCategoryCounts {
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
  category_desc: string;
  subcategory_desc: string;
  type: string;
  status: string;
  author: string;
  created_date: string;

  [key: string]: any;
}
