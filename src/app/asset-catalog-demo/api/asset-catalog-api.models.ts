// Backend-shaped (snake_case) contracts: what the API returns, before mapping.

export type AssetJobStatus = 'processing' | 'done';

export interface AssetTableDescItem {
  section_id: string;
  section_desc: string;
  category_id: string;
  parent_desc: string;
  subcategory_id: string;
  desc: string;
  count: number;
}

// Keyed by category description: "this category has these subcategories".
export type AssetTableDescResponse = Record<string, AssetTableDescItem[]>;

export interface AssetQueryTableRequest {
  offset: number;
  page_size: number;
  filter_by: string;
  order_by: string;
}

export interface AssetRecordDto {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  site_name: string;
  condition_desc: string;
  section_id: string;
  category_id: string;
  subcategory_id: string;
}
