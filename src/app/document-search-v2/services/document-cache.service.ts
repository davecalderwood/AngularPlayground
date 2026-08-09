import { Injectable } from '@angular/core';
import { PaginatedTableSet } from '../../documents/document.models';

export interface SubcategoryCacheOptions {
  totalDocumentCount: number;
  activeSort?: string;
  activeFilters?: string;
}

export interface SubcategoryCacheContent {
    documents: PaginatedTableSet[];
    isComplete: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentCacheService {
    // Key: subcategoryId. Value: cached documents and state.
    private cache = new Map<string, SubcategoryCacheContent>();
    
    // Metadata about the subcategory
    private options = new Map<string, SubcategoryCacheOptions>();

    initializeSubcategory(subcategoryId: string, options: SubcategoryCacheOptions) {
        this.options.set(subcategoryId, { ...options });
        if (!this.cache.has(subcategoryId)) {
             this.cache.set(subcategoryId, {
                 documents: [],
                 isComplete: false
             });
        }
    }

    getDocuments(subcategoryId: string): PaginatedTableSet[] {
        return this.cache.get(subcategoryId)?.documents || [];
    }
    
    getOptions(subcategoryId: string): SubcategoryCacheOptions | undefined {
        return this.options.get(subcategoryId);
    }
    
    isComplete(subcategoryId: string): boolean {
        return this.cache.get(subcategoryId)?.isComplete || false;
    }
    
    upsertDocuments(subcategoryId: string, docs: PaginatedTableSet[]) {
        const cached = this.cache.get(subcategoryId) || { documents: [], isComplete: false };
        
        // Use a set to avoid duplicates based on document id
        const docMap = new Map<number, PaginatedTableSet>();
        cached.documents.forEach(d => docMap.set(d.id, d));
        docs.forEach(d => docMap.set(d.id, d));
        
        cached.documents = Array.from(docMap.values());
        
        const options = this.options.get(subcategoryId);
        if (options && cached.documents.length >= options.totalDocumentCount) {
             cached.isComplete = true;
        }
        
        this.cache.set(subcategoryId, cached);
    }

    sortSubcategoryLocally(subcategoryId: string, sortColumn: string, sortDirection: 'asc' | 'desc') {
        const cached = this.cache.get(subcategoryId);
        if (!cached || !cached.isComplete) return;

        const docs = [...cached.documents];
        docs.sort((a, b) => {
             const valA = a[sortColumn];
             const valB = b[sortColumn];
             
             if (typeof valA === 'string' && typeof valB === 'string') {
                  const comparison = valA.localeCompare(valB);
                  return sortDirection === 'asc' ? comparison : -comparison;
             }
             
             if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
             if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
             
             return 0;
        });

        cached.documents = docs;
        this.cache.set(subcategoryId, cached);
        
        const options = this.options.get(subcategoryId);
        if (options) {
             options.activeSort = `${sortColumn}|${sortDirection}`;
             this.options.set(subcategoryId, options);
        }
    }

    clearAllActiveSorts() {
        this.options.forEach(opt => opt.activeSort = undefined);
    }
    
    activeSortSubcategory(subcategoryId: string, sortColumn: string, sortDirection: 'asc' | 'desc') {
        const cached = this.cache.get(subcategoryId);
        const options = this.options.get(subcategoryId);

        if (cached && options && cached.isComplete) {
            this.sortSubcategoryLocally(subcategoryId, sortColumn, sortDirection);
        } else if (options) {
             options.activeSort = `${sortColumn}|${sortDirection}`;
             this.options.set(subcategoryId, options);
             this.clearCacheForSubcategory(subcategoryId); // clear incomplete cache so sorting causes network fetch
        }
    }

    clearCacheForSubcategory(subcategoryId: string) {
        const cached = this.cache.get(subcategoryId);
        if (cached) {
            cached.documents = [];
            cached.isComplete = false;
        }
    }
    
    clearAll() {
        this.cache.clear();
        this.options.clear();
    }
}
