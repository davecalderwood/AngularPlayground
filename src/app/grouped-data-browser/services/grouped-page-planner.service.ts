import { Injectable } from '@angular/core';
import { GroupedDataNode, GroupedDataPagePlan, GroupedDataPageSegment } from '../models/grouped-data-browser.models';

@Injectable({ providedIn: 'root' })
export class GroupedPagePlannerService {
  calculatePagePlan(
    orderedLeafNodes: GroupedDataNode[],
    pageIndex: number,
    pageSize: number,
  ): GroupedDataPagePlan {
    const normalizedPageIndex = Math.max(0, Math.floor(pageIndex));
    const normalizedPageSize = Math.max(1, Math.floor(pageSize));
    const pageStart = normalizedPageIndex * normalizedPageSize;
    const pageEnd = pageStart + normalizedPageSize;
    const segments: GroupedDataPageSegment[] = [];
    let groupStart = 0;

    for (const node of orderedLeafNodes) {
      const totalCount = Math.max(0, Math.floor(node.count));
      const groupEnd = groupStart + totalCount;

      if (groupEnd > pageStart && groupStart < pageEnd) {
        const overlapStart = Math.max(pageStart, groupStart);
        const overlapEnd = Math.min(pageEnd, groupEnd);
        const segment: GroupedDataPageSegment = {
          nodeId: node.id,
          offset: overlapStart - groupStart,
          take: overlapEnd - overlapStart,
          totalCount,
        };

        if (node.metadata) {
          segment.metadata = { ...node.metadata };
        }

        segments.push(segment);
      }

      groupStart = groupEnd;
      if (groupStart >= pageEnd) {
        break;
      }
    }

    return {
      pageIndex: normalizedPageIndex,
      pageSize: normalizedPageSize,
      segments,
    };
  }
}