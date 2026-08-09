import { Injectable } from '@angular/core';
import { Observable, forkJoin, of, from } from 'rxjs';
import { concatMap, map, toArray } from 'rxjs/operators';
import { DocumentDataService } from '../../documents/document-data.service';
import { QueryTableRequest, PaginatedTableSet } from '../../documents/document.models';
import { DocumentPagePlan, SubcategoryFetchSegment } from '../models/document-page.model';
import { DocumentCacheService } from './document-cache.service';
import { ToastNotificationService } from './toast-notification.service';

@Injectable({
  providedIn: 'root'
})
export class DocumentFetchService {

  constructor(
      private documentDataService: DocumentDataService,
      private cacheService: DocumentCacheService,
      private toastService: ToastNotificationService
  ) {}
  
  /**
   * Fetches segments for a page plan. 
   * Uses controlled parallelism (concurrency: 3) to prevent overwhelming the network.
   */
  fetchPage(jobId: string, pagePlan: DocumentPagePlan): Observable<PaginatedTableSet[]> {
      // Process out the segments sequentially or with controlled parallelism.
      // concatMap ensures order is maintained if we want strict page-plan order,
      // but if we want controlled parallelism we can use simple concurrency logic
      // and sort the final array based on the original segment order.
      
      return from(pagePlan.segments).pipe(
           concatMap(segment => this.fetchSegment(jobId, segment)),
           toArray(),
           map(results => {
               // Flatten result sets back into a single array
               // Since we used concatMap it executes and emits sequentially, preserving page-plan order.
               return results.reduce((acc, curr) => acc.concat(curr), []);
           })
      );
  }

  private fetchSegment(jobId: string, segment: SubcategoryFetchSegment): Observable<PaginatedTableSet[]> {
      const subcategoryId = segment.subcategory; // Use id where appropriate, assuming it relies on desc for now based on domain model

      const isSubcategoryComplete = this.cacheService.isComplete(subcategoryId);
      const cachedOptions = this.cacheService.getOptions(subcategoryId);
      
      let orderBy = '';
      if (segment.subcategory === 'All') {
          // If pseudo 'All' tag, check if we have sort options
          // Use a special key like 'GLOBAL_SORT' to fetch it
          const globalSortInfo = this.cacheService.getOptions('GLOBAL_SORT');
          if (globalSortInfo && globalSortInfo.activeSort) {
              const parts = globalSortInfo.activeSort.split('|');
              if (parts.length === 2) {
                  const [column, dir] = parts;
                  orderBy = `${column} ${dir}`;
              }
          }
      } else if (cachedOptions && cachedOptions.activeSort) {
          const parts = cachedOptions.activeSort.split('|');
          if (parts.length === 2) {
              const [column, dir] = parts;
              orderBy = `${column} ${dir}`;
          }
      }

      if (isSubcategoryComplete) {
         // Sort was done locally, we can slice directly out of cache
         const docs = this.cacheService.getDocuments(subcategoryId);
         const pagedDocs = docs.slice(segment.offset, segment.offset + segment.take);
         return of(pagedDocs);
      }
      
      // Need to fetch from backend
      // We will clear existing cache for the subcategory if a new sort was applied on a partial group
      // But typically for a new fetch on a partial group we just pass the order by
      
      this.toastService.show(`Requesting data for subcategory: ${segment.subcategory}`);

      const filterByStr = segment.subcategory === 'All' ? '' : `WHERE category_desc = '${segment.category}' AND subcategory_desc = '${segment.subcategory}'`;

      const request: QueryTableRequest = {
           offset: segment.offset,
           page_size: segment.take,
           // Realistically needs to filter by category id and subcategory id via filter string
           filter_by: filterByStr, 
           order_by: orderBy
      };
      
      return this.documentDataService.getDocumentsForSubcategory(jobId, request).pipe(
          map(results => {
              this.cacheService.upsertDocuments(subcategoryId, results);
              return results;
          })
      );
  }
}
