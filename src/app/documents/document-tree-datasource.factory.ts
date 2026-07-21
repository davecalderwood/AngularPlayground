import { Injectable } from '@angular/core';
import {
  GridApi,
  IServerSideDatasource,
  IServerSideGetRowsParams
} from 'ag-grid-community';
import { DocumentDataService } from './document-data.service';
import {
  CategorySummaryDto,
  DocumentTreeRow,
  DocumentTreeSummaryDto,
  PaginatedTableSet,
  QueryTableRequest,
  SubcategorySummaryDto
} from './document.models';

export interface CustomServerSideDatasource extends IServerSideDatasource {
  changePage?: (route: string[], direction: number, api: GridApi) => void;
  changePageSize?: (route: string[], size: number, api: GridApi) => void;
}

@Injectable({ providedIn: 'root' })
export class DocumentTreeDatasourceFactory {
  constructor(private documentDataService: DocumentDataService) {}

  create(
    summary: DocumentTreeSummaryDto,
    jobId: string
  ): CustomServerSideDatasource {
    const flatRows = this.flattenSummary(summary);
    const pageMap = new Map<string, number>();
    const pageSizeMap = new Map<string, number>();

    return {
      changePage: (route: string[], direction: number, api: GridApi) => {
        const category = route[route.length - 2];
        const subcategory = route[route.length - 1];
        const key = `${category}|${subcategory}`;
        const current = pageMap.get(key) ?? 0;
        pageMap.set(key, Math.max(0, current + direction));
        api.refreshServerSide({ route, purge: false });
      },
      changePageSize: (route: string[], size: number, api: GridApi) => {
        const category = route[route.length - 2];
        const subcategory = route[route.length - 1];
        const key = `${category}|${subcategory}`;
        pageSizeMap.set(key, size);
        pageMap.set(key, 0); // reset page map
        api.refreshServerSide({ route, purge: true });
      },
      getRows: (params: IServerSideGetRowsParams) => {
        const groupKeys = params.request.groupKeys ?? [];
        const rowGroupCols = params.request.rowGroupCols ?? [];
        const hasSection = rowGroupCols.length > 0 && rowGroupCols[0].field === 'section';

        const startRow = params.request.startRow ?? 0;
        const endRow = params.request.endRow ?? startRow + 15;

        console.log('AG Grid request:', params.request);
        console.log('groupKeys:', groupKeys, 'hasSection:', hasSection);

        // State machine based on current depth and whether sections are used
        const level = groupKeys.length;

        if (level === 0) {
          if (hasSection) {
            // Return unique sections
            const sectionNames = Array.from(new Set(flatRows.filter(row => row.rowType === 'category').map(row => row.section!).filter(Boolean)));
            const sectionRows = sectionNames.map(section => {
              const count = flatRows.filter(row => row.rowType === 'subcategory' && row.section === section).reduce((acc, curr) => acc + (curr.documentCount ?? 0), 0);
              return {
                id: `section|${section}`,
                rowType: 'section',
                name: section,
                section: section,
                documentCount: count
              } as DocumentTreeRow;
            });
            params.success({ rowData: sectionRows.slice(startRow, endRow), rowCount: sectionRows.length });
          } else {
            // Return categories
            const categoryRows = flatRows.filter(row => row.rowType === 'category');
            params.success({ rowData: categoryRows.slice(startRow, endRow), rowCount: categoryRows.length });
          }
          return;
        }

        if (level === 1) {
          if (hasSection) {
            const sectionName = groupKeys[0];
            const categoryRows = flatRows.filter(row => row.rowType === 'category' && row.section === sectionName);
            params.success({ rowData: categoryRows.slice(startRow, endRow), rowCount: categoryRows.length });
          } else {
            const categoryName = groupKeys[0];
            const subcategoryRows = flatRows.filter(row => row.rowType === 'subcategory' && row.category === categoryName);
            params.success({ rowData: subcategoryRows.slice(startRow, endRow), rowCount: subcategoryRows.length });
          }
          return;
        }

        if (level === 2) {
          if (hasSection) {
            const [section, categoryName] = groupKeys;
            const subcategoryRows = flatRows.filter(row => row.rowType === 'subcategory' && row.category === categoryName);
            params.success({ rowData: subcategoryRows.slice(startRow, endRow), rowCount: subcategoryRows.length });
          } else {
            const [category, subcategory] = groupKeys;
            this.fetchDocumentsForSubcategory(jobId, flatRows, category, subcategory, params, pageMap, pageSizeMap);
          }
          return;
        }

        if (level === 3 && hasSection) {
          const [section, category, subcategory] = groupKeys;
          this.fetchDocumentsForSubcategory(jobId, flatRows, category, subcategory, params, pageMap, pageSizeMap);
          return;
        }

        params.success({
          rowData: [],
          rowCount: 0
        });
      }
    };
  }

  private fetchDocumentsForSubcategory(
    jobId: string,
    flatRows: DocumentTreeRow[],
    category: string,
    subcategory: string,
    params: IServerSideGetRowsParams,
    pageMap: Map<string, number>,
    pageSizeMap: Map<string, number>
  ): void {
    const PAGE_SIZE = pageSizeMap.get(`${category}|${subcategory}`) ?? 10;
    const currentPageIdx = pageMap.get(`${category}|${subcategory}`) ?? 0;
    const offset = currentPageIdx * PAGE_SIZE;

    const totalRowsForSubcategory = this.getSubcategoryDocumentCount(
      flatRows,
      category,
      subcategory
    );

    const request: QueryTableRequest = {
      offset: offset,
      page_size: PAGE_SIZE,
      filter_by: this.buildDocumentFilterBy(category, subcategory, params.request.filterModel),
      order_by: this.buildOrderBy(params.request.sortModel)
    };

    this.documentDataService
      .getDocumentsForSubcategory(jobId, request)
      .subscribe({
        next: documents => {
          const documentRows = documents.map(document =>
            this.toDocumentRow(document, category, subcategory)
          );

          if (totalRowsForSubcategory > 0) {
            documentRows.push({
              id: `pagination|${category}|${subcategory}`,
              rowType: 'pagination',
              category,
              subcategory,
              pageNumber: currentPageIdx + 1,
              totalPages: Math.ceil(totalRowsForSubcategory / PAGE_SIZE),
              pageSize: PAGE_SIZE
            } as any);
          }

          params.success({
            rowData: documentRows,
            rowCount: documentRows.length
          });
        },
        error: error => {
          console.error('Failed to load documents for subcategory', error);
          params.fail();
        }
      });
  }

  private flattenSummary(summary: DocumentTreeSummaryDto): DocumentTreeRow[] {
    const rows: DocumentTreeRow[] = [];

    summary.categories.forEach(category => {
      rows.push(this.toCategoryRow(category));

      category.subcategories.forEach(subcategory => {
        rows.push(this.toSubcategoryRow(category.category, subcategory));
      });
    });

    return rows;
  }

  private toCategoryRow(category: CategorySummaryDto): DocumentTreeRow {
    const categoryDocumentCount = category.subcategories.reduce(
      (total, subcategory) => total + (subcategory.documentCount ?? 0),
      0
    );

    return {
      ...category,

      id: `category|${category.category}`,
      rowType: 'category',

      name: category.category,
      category: category.category,
      subcategory: undefined,

      documentCount: categoryDocumentCount
    } as DocumentTreeRow;
  }

  private toSubcategoryRow(
    categoryName: string,
    subcategory: SubcategorySummaryDto
  ): DocumentTreeRow {
    return {
      ...subcategory,

      id: `subcategory|${categoryName}|${subcategory.subcategory}`,
      rowType: 'subcategory',

      name: subcategory.subcategory,
      category: categoryName,
      subcategory: subcategory.subcategory,

      documentCount: subcategory.documentCount
    } as DocumentTreeRow;
  }

  private getSubcategoryDocumentCount(
    flatRows: DocumentTreeRow[],
    category: string,
    subcategory: string
  ): number {
    const row = flatRows.find(item =>
      item.rowType === 'subcategory' &&
      item.category === category &&
      item.subcategory === subcategory
    );

    return row?.documentCount ?? 0;
  }

  private toDocumentRow(
    document: PaginatedTableSet,
    category: string,
    subcategory: string
  ): DocumentTreeRow {
    return {
      ...document,

      id: `document|${category}|${subcategory}|${document.id}`,
      rowType: 'document',

      category,
      subcategory,

      documentId: document.id,
      name: document.name,

      type: document.type,
      status: document.status,
      author: document.author,
      createdDate: document.created_date
    } as DocumentTreeRow;
  }

  private buildDocumentFilterBy(category: string, subcategory: string, filterModel?: any): string {
    const safeCategory = this.escapeSqlValue(category);
    const safeSubcategory = this.escapeSqlValue(subcategory);

    let filterString = `WHERE category_desc = '${safeCategory}' AND subcategory_desc = '${safeSubcategory}'`;

    if (filterModel) {
      const allowedColumns: Record<string, string> = {
        name: 'name',
        type: 'type',
        status: 'status',
        author: 'author',
        createdDate: 'created_date'
      };

      Object.keys(filterModel).forEach(colId => {
        const column = allowedColumns[colId];
        if (column && filterModel[colId]) {
          const filterInfo = filterModel[colId];
          if (filterInfo.filterType === 'text') {
            const filterValue = this.escapeSqlValue(filterInfo.filter);
            if (filterInfo.type === 'contains') {
              filterString += ` AND ${column} LIKE '%${filterValue}%'`;
            } else if (filterInfo.type === 'equals') {
              filterString += ` AND ${column} = '${filterValue}'`;
            } else if (filterInfo.type === 'startsWith') {
              filterString += ` AND ${column} LIKE '${filterValue}%'`;
            } else if (filterInfo.type === 'endsWith') {
              filterString += ` AND ${column} LIKE '%${filterValue}'`;
            } else if (filterInfo.type === 'notContains') {
              filterString += ` AND ${column} NOT LIKE '%${filterValue}%'`;
            } else if (filterInfo.type === 'notEqual') {
              filterString += ` AND ${column} != '${filterValue}'`;
            }
          }
        }
      });
    }

    return filterString;
  }

  private buildOrderBy(sortModel: any[] | undefined): string {
    if (!sortModel || sortModel.length === 0) {
      return 'ORDER BY name ASC';
    }

    const allowedColumns: Record<string, string> = {
      name: 'name',
      type: 'type',
      status: 'status',
      author: 'author',
      createdDate: 'created_date'
    };

    const sortParts = sortModel
      .map(sort => {
        const column = allowedColumns[sort.colId];

        if (!column) {
          return null;
        }

        const direction = sort.sort === 'desc' ? 'DESC' : 'ASC';

        return `${column} ${direction}`;
      })
      .filter((part): part is string => !!part);

    if (sortParts.length === 0) {
      return 'ORDER BY name ASC';
    }

    return `ORDER BY ${sortParts.join(', ')}`;
  }

  private escapeSqlValue(value: string): string {
    return value.replace(/'/g, "''");
  }
}
