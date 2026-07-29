import { Injectable } from '@angular/core';
import {
  GridApi,
  IServerSideDatasource,
  IServerSideGetRowsParams
} from 'ag-grid-community';
import { DocumentDataService } from './document-data.service';
import {
  DocumentTreeConfiguration,
  DocumentTreeNode,
  DocumentTreeRow,
  DocumentTreeSummaryDto,
  PaginatedTableSet,
  QueryTableRequest,
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
    jobId: string,
    config: DocumentTreeConfiguration = {
      levels: [
        { key: 'category', label: 'Category', backendColumn: 'category_desc' },
        { key: 'subcategory', label: 'Subcategory', backendColumn: 'subcategory_desc' }
      ],
      defaultPageSize: 10
    }
  ): CustomServerSideDatasource {
    const rootNodes = this.buildTree(summary, config);
    const pageMap = new Map<string, number>();
    const pageSizeMap = new Map<string, number>();

    return {
      changePage: (route: string[], direction: number, api: GridApi) => {
        const key = route.join('|');
        const current = pageMap.get(key) ?? 0;
        pageMap.set(key, Math.max(0, current + direction));
        api.refreshServerSide({ route, purge: false });
      },
      changePageSize: (route: string[], size: number, api: GridApi) => {
        const key = route.join('|');
        pageSizeMap.set(key, size);
        pageMap.set(key, 0); // reset page map
        api.refreshServerSide({ route, purge: true });
      },
      getRows: (params: IServerSideGetRowsParams) => {
        const groupKeys = params.request.groupKeys ?? [];
        
        const startRow = params.request.startRow ?? 0;
        const endRow = params.request.endRow ?? startRow + 15;

        // 1. Walk the tree using AG Grid groupKeys
        let currentNodes = rootNodes;
        let selectedNode: DocumentTreeNode | undefined = undefined;

        for (const key of groupKeys) {
          selectedNode = currentNodes.find(n => n.value === key);
          if (!selectedNode) break;
          currentNodes = selectedNode.children;
        }

        // 2. Find the selected node
        if (groupKeys.length === 0) {
          // Root level
          const rows = rootNodes.map(n => this.toTreeRow(n));
          params.success({ rowData: rows.slice(startRow, endRow), rowCount: rows.length });
          return;
        }

        if (!selectedNode) {
          params.success({ rowData: [], rowCount: 0 });
          return;
        }

        // 3. If it has children: return child groups.
        if (selectedNode.children.length > 0) {
          const childRows = selectedNode.children.map(n => this.toTreeRow(n));
          params.success({ rowData: childRows.slice(startRow, endRow), rowCount: childRows.length });
          return;
        }

        // 4. If it has no children: fetch paginated documents.
        this.fetchDocumentsForNode(jobId, selectedNode, config, params, pageMap, pageSizeMap, groupKeys);
      }
    };
  }

  private fetchDocumentsForNode(
    jobId: string,
    node: DocumentTreeNode,
    config: DocumentTreeConfiguration,
    params: IServerSideGetRowsParams,
    pageMap: Map<string, number>,
    pageSizeMap: Map<string, number>,
    route: string[]
  ): void {
    const routeKey = route.join('|');
    const PAGE_SIZE = pageSizeMap.get(routeKey) ?? config.defaultPageSize;
    const currentPageIdx = pageMap.get(routeKey) ?? 0;
    const offset = currentPageIdx * PAGE_SIZE;

    const request: QueryTableRequest = {
      offset: offset,
      page_size: PAGE_SIZE,
      filter_by: this.buildDocumentFilterBy(node, config, params.request.filterModel),
      order_by: this.buildOrderBy(params.request.sortModel)
    };

    this.documentDataService
      .getDocumentsForSubcategory(jobId, request)
      .subscribe({
        next: documents => {
          const documentRows = documents.map(document =>
            this.toDocumentRow(document, node)
          );

          if (node.documentCount > 0) {
            documentRows.push({
              id: `pagination|${routeKey}`,
              rowType: 'pagination',
              pageNumber: currentPageIdx + 1,
              totalPages: Math.ceil(node.documentCount / PAGE_SIZE),
              pageSize: PAGE_SIZE,
              ...node.pathValues
            } as any);
          }

          params.success({
            rowData: documentRows,
            rowCount: documentRows.length
          });
        },
        error: error => {
          console.error('Failed to load documents for node', error);
          params.fail();
        }
      });
  }

  private buildTree(summary: DocumentTreeSummaryDto, config: DocumentTreeConfiguration): DocumentTreeNode[] {
    const rootNodesMap = new Map<string, DocumentTreeNode>();

    // This converts the DTO to a set of paths. We use the config to pull values.
    // If the DTO gives us an array of paths:
    const flattened = this.flattenDto(summary);

    for (const item of flattened) {
      this.insertIntoTree(rootNodesMap, item, config);
    }

    return Array.from(rootNodesMap.values());
  }

  private flattenDto(summary: DocumentTreeSummaryDto): Record<string, any>[] {
    const items: Record<string, any>[] = [];
    summary.categories.forEach(c => {
      if (c.subcategories && c.subcategories.length > 0) {
        c.subcategories.forEach(s => items.push({ ...c, ...s }));
      } else {
        items.push({ ...c });
      }
    });
    return items;
  }

  private insertIntoTree(
    currentLevelMap: Map<string, DocumentTreeNode>,
    item: Record<string, any>,
    config: DocumentTreeConfiguration,
    levelIndex: number = 0,
    currentPath: Record<string, string> = {}
  ): void {
    if (levelIndex >= config.levels.length) {
      return;
    }

    const levelDef = config.levels[levelIndex];
    const value = item[levelDef.key] ?? 'Unknown';
    const newPath = { ...currentPath, [levelDef.key]: value };

    let node = currentLevelMap.get(value);
    if (!node) {
      node = {
        id: `${levelDef.key}|${Object.values(newPath).join('|')}`,
        name: value,
        levelKey: levelDef.key,
        levelIndex,
        value,
        documentCount: 0,
        pathValues: newPath,
        children: []
      };
      currentLevelMap.set(value, node);
    }
    
    // Add document count from leaf nodes
    if (levelIndex === config.levels.length - 1 && item['documentCount']) {
       node.documentCount += item['documentCount'];
    }

    // Recursively add children
    if (levelIndex < config.levels.length - 1) {
      const childMap = new Map<string, DocumentTreeNode>();
      node.children.forEach(c => childMap.set(c.value, c));
      this.insertIntoTree(childMap, item, config, levelIndex + 1, newPath);
      node.children = Array.from(childMap.values());
      // rollup counts
      node.documentCount = node.children.reduce((sum, child) => sum + child.documentCount, 0);
    }
  }

  private toTreeRow(node: DocumentTreeNode): DocumentTreeRow {
    return {
      id: node.id,
      rowType: node.levelKey as any,
      name: node.name,
      documentCount: node.documentCount,
      ...node.pathValues
    } as DocumentTreeRow;
  }

  private toDocumentRow(
    document: PaginatedTableSet,
    node: DocumentTreeNode
  ): DocumentTreeRow {
    const documentCopy = { ...document };
    delete (documentCopy as any).category;
    
    return {
      ...documentCopy,
      id: `document|${node.id}|${document.id}`,
      rowType: 'document',
      documentId: document.id,
      name: document.name,
      type: document.type,
      status: document.status,
      author: document.author,
      createdDate: document.created_date,
      ...node.pathValues
    } as unknown as DocumentTreeRow;
  }

  private buildDocumentFilterBy(node: DocumentTreeNode, config: DocumentTreeConfiguration, filterModel?: any): string {
    let filters: string[] = [];

    // Map pathValues to backend columns using config
    for (const [key, value] of Object.entries(node.pathValues)) {
      const levelDef = config.levels.find(l => l.key === key);
      if (levelDef && levelDef.backendColumn) {
        filters.push(`${levelDef.backendColumn} = '${this.escapeSqlValue(value)}'`);
      }
    }

    let filterString = `WHERE ${filters.join(' AND ')}`;

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
