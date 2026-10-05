export interface GroupedDataNode {
  id: string;
  label: string;
  count: number;
  type: string;
  metadata?: Record<string, unknown>;
  children?: GroupedDataNode[];
}

export interface GroupedDataPageSegment {
  nodeId: string;
  offset: number;
  take: number;
  totalCount: number;
  metadata?: Record<string, unknown>;
}

export interface GroupedDataPagePlan {
  pageIndex: number;
  pageSize: number;
  segments: GroupedDataPageSegment[];
}