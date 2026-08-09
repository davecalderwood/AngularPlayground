export interface SubcategoryCount {
    category: string;
    categoryId?: string; // Optional, might map from parent or use name
    subcategory: string;
    documentCount: number;
}

export interface SubcategoryFetchSegment {
    category: string;
    subcategory: string;
    offset: number;
    take: number;
}

export interface DocumentPagePlan {
    pageNumber: number; // 0-based
    pageSize: number;
    segments: SubcategoryFetchSegment[];
}
