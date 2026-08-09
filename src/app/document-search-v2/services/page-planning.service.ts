import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { SubcategoryCount, DocumentPagePlan, SubcategoryFetchSegment } from '../models/document-page.model';

@Injectable({
  providedIn: 'root'
})
export class PagePlanningService {
  private _searchAction = new Subject<string>();
  searchAction$ = this._searchAction.asObservable();

  triggerSearch(query: string) {
    this._searchAction.next(query);
  }

  /**
   * Calculates the exact fetch requirements for a given page, 
   * independent of any state other than the input list.
   */
  calculatePagePlan(
    orderedSubcategories: SubcategoryCount[], 
    pageIndex: number, 
    pageSize: number
  ): DocumentPagePlan {
    const targetStartDocumentIndex = pageIndex * pageSize;
    const targetEndDocumentIndex = targetStartDocumentIndex + pageSize; // exclusive

    let currentDocumentIndex = 0;
    const segments: SubcategoryFetchSegment[] = [];

    for (const subcategory of orderedSubcategories) {
      if (subcategory.documentCount <= 0) continue;

      const subcategoryStartGlobalIndex = currentDocumentIndex;
      const subcategoryEndGlobalIndex = currentDocumentIndex + subcategory.documentCount; // exclusive

      // Check if this subcategory overlaps with our target page window
      if (subcategoryEndGlobalIndex > targetStartDocumentIndex && subcategoryStartGlobalIndex < targetEndDocumentIndex) {
        // There is an overlap, so we need to fetch documents from this subcategory
        const fetchStartGlobalIndex = Math.max(targetStartDocumentIndex, subcategoryStartGlobalIndex);
        const fetchEndGlobalIndex = Math.min(targetEndDocumentIndex, subcategoryEndGlobalIndex);

        // Convert global indices back to local subcategory offset/take
        const localOffset = fetchStartGlobalIndex - subcategoryStartGlobalIndex;
        const localTake = fetchEndGlobalIndex - fetchStartGlobalIndex;
        
        segments.push({
            category: subcategory.category,
            subcategory: subcategory.subcategory,
            offset: localOffset,
            take: localTake
        });
      }

      currentDocumentIndex = subcategoryEndGlobalIndex;

      // Optimization: if we've passed the target page window, we can stop evaluating remaining subcategories
      if (currentDocumentIndex >= targetEndDocumentIndex) {
          break;
      }
    }

    return {
        pageNumber: pageIndex,
        pageSize: pageSize,
        segments: segments
    };
  }
}
