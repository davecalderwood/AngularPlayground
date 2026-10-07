import {
  GroupedDataNode,
  GroupedDataPagePlan,
  GroupedDataSortRequest,
} from '../../grouped-data-browser';
import {
  AssetQueryTableRequest,
  AssetRecordDto,
  AssetTableDescResponse,
} from '../api/asset-catalog-api.models';

// Outgoing: the shape the grid renders.
export interface AssetRow {
  id: string;
  assetName: string;
  assetType: string;
  site: string;
  condition: string;
}

// Grid field -> backend column, used when building order_by.
const ROW_FIELD_TO_BACKEND_COLUMN: Record<string, string> = {
  assetName: 'asset_name',
  assetType: 'asset_type',
  site: 'site_name',
  condition: 'condition_desc',
};

/**
 * Incoming: { "Access Systems": [{ section_id, section_desc, category_id, parent_desc, subcategory_id, desc, count }] }
 * Outgoing: All Assets > Section > Category > Subcategory as GroupedDataNode[].
 */
export function mapTableDescToNodes(response: AssetTableDescResponse): GroupedDataNode[] {
  interface CategoryBucket { node: GroupedDataNode; children: GroupedDataNode[] }
  interface SectionBucket { node: GroupedDataNode; categories: Map<string, CategoryBucket> }

  const sections = new Map<string, SectionBucket>();
  let total = 0;

  for (const items of Object.values(response)) {
    for (const item of items) {
      let section = sections.get(item.section_id);
      if (!section) {
        section = {
          node: { id: `section-${item.section_id}`, label: item.section_desc, count: 0, type: 'section', metadata: { sectionId: item.section_id }, children: [] },
          categories: new Map(),
        };
        sections.set(item.section_id, section);
      }

      let category = section.categories.get(item.category_id);
      if (!category) {
        const children: GroupedDataNode[] = [];
        category = {
          node: { id: `category-${item.category_id}`, label: item.parent_desc, count: 0, type: 'category', metadata: { sectionId: item.section_id, categoryId: item.category_id }, children },
          children,
        };
        section.categories.set(item.category_id, category);
        section.node.children!.push(category.node);
      }

      category.children.push({
        id: `subcategory-${item.subcategory_id}`,
        label: item.desc,
        count: item.count,
        type: 'subcategory',
        metadata: { sectionId: item.section_id, categoryId: item.category_id, subcategoryId: item.subcategory_id },
      });
      category.node.count += item.count;
      section.node.count += item.count;
      total += item.count;
    }
  }

  if (sections.size === 0) {
    return [];
  }

  return [{
    id: 'all-assets',
    label: 'All Assets',
    count: total,
    type: 'all',
    children: [...sections.values()].map(section => section.node),
  }];
}

/** Incoming: AssetRecordDto (snake_case). Outgoing: AssetRow (grid shape). */
export function mapAssetRecordToRow(record: AssetRecordDto): AssetRow {
  return {
    id: record.asset_id,
    assetName: record.asset_name,
    assetType: record.asset_type,
    site: record.site_name,
    condition: record.condition_desc,
  };
}

/** Incoming: page plan segments with leaf metadata. Outgoing: one query-table request per segment. */
export function mapPagePlanToQueries(
  plan: GroupedDataPagePlan,
  sort: GroupedDataSortRequest | null,
): AssetQueryTableRequest[] {
  const backendColumn = sort?.direction ? ROW_FIELD_TO_BACKEND_COLUMN[sort.column] : undefined;
  const orderBy = backendColumn && sort?.direction ? `${backendColumn} ${sort.direction}` : '';

  return plan.segments.map(segment => ({
    offset: segment.offset,
    page_size: segment.take,
    filter_by: `subcategory_id = '${String(segment.metadata?.['subcategoryId'])}'`,
    order_by: orderBy,
  }));
}
