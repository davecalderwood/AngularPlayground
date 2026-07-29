import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  PaginatedTableSet,
  QueryTableRequest
} from './document.models';

@Injectable({ providedIn: 'root' })
export class DocumentDataService {
  private readonly fakeDocuments: PaginatedTableSet[] = this.buildFakeDocuments();

  getDocumentsForSubcategory(
    jobId: string,
    request: QueryTableRequest
  ): Observable<PaginatedTableSet[]> {
    console.log('Fake POST query-table:', {
      url: `/api/${jobId}/query-table`,
      body: request
    });

    let rows = this.fakeDocuments;

    if (request.filter_by) {
        // Evaluate the raw sql filter string directly since it is dynamically built based on configs
        const safeFilter = request.filter_by
             .replace('WHERE', '')
             .trim()
             .split(' AND ');

        for (const condition of safeFilter) {
            const match = /([a-zA-Z_]+)\s*=\s*'([^']+)'/i.exec(condition);
            if (match) {
                const column = match[1];
                let value = match[2];
                // basic unescape
                value = value.replace(/''/g, "'");

                rows = rows.filter(document => document[column] === value);
            }
        }
    }

    rows = this.applySort(rows, request.order_by);

    const pagedRows = rows.slice(
      request.offset,
      request.offset + request.page_size
    );

    return of(pagedRows).pipe(delay(400));
  }

  private applySort(
    rows: PaginatedTableSet[],
    orderBy: string
  ): PaginatedTableSet[] {
    const normalized = orderBy.toLowerCase();

    const sorted = [...rows];

    if (normalized.includes('created_date')) {
      sorted.sort((a, b) =>
        a.created_date.localeCompare(b.created_date)
      );
    } else {
      sorted.sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    }

    if (normalized.includes('desc')) {
      sorted.reverse();
    }

    return sorted;
  }

  private buildFakeDocuments(): PaginatedTableSet[] {
    const categories = [
      {
        categoryId: 1,
        section: 'Section B',
        category: 'Management',
        subcategories: ['Policies', 'Reports', 'Procedures']
      },
      {
        categoryId: 2,
        section: 'Section A',
        category: 'Finance',
        subcategories: ['Payroll', 'Invoices', 'Budgets']
      },
      {
        categoryId: 3,
        section: 'Section B',
        category: 'Human Resources',
        subcategories: ['Employees', 'Benefits']
      },
      {
        categoryId: 4,
        section: 'Section A',
        category: 'Legal',
        subcategories: ['Contracts', 'Compliance']
      }
    ];

    const documents: PaginatedTableSet[] = [];
    let id = 1;

    categories.forEach(category => {
      category.subcategories.forEach(subcategory => {
        const count = this.getFakeCount(subcategory);

        for (let i = 1; i <= count; i++) {
          documents.push({
            category: category.categoryId,
            id,
            name: `${subcategory} Document ${i}`,
            section_desc: category.section,
            category_desc: category.category,
            subcategory_desc: subcategory,
            type: i % 2 === 0 ? 'PDF' : 'DOCX',
            status: i % 3 === 0 ? 'Archived' : 'Ready',
            author: i % 2 === 0 ? 'Jane Smith' : 'David Calderwood',
            created_date: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`
          });

          id++;
        }
      });
    });

    return documents;
  }

  private getFakeCount(subcategory: string): number {
    const counts: Record<string, number> = {
      Policies: 125,
      Reports: 80,
      Procedures: 45,
      Payroll: 150,
      Invoices: 90,
      Budgets: 60,
      Employees: 110,
      Benefits: 70,
      Contracts: 130,
      Compliance: 40
    };

    return counts[subcategory] ?? 0;
  }
}
