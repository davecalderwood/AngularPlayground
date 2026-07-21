import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

interface PaginationRow {
  rowType: 'pagination';
  pageNumber: number;
  totalPages: number;
  pageSize?: number;
  category: string;
  subcategory: string;
}

interface PaginationContext {
  componentParent?: {
    changePageSubcategory?: (
      path: [string, string],
      direction: number
    ) => void;

    changePageSizeSubcategory?: (
      path: [string, string],
      pageSize: number
    ) => void;
  };
}

type PaginationCellParams = ICellRendererParams<
  PaginationRow,
  unknown,
  PaginationContext
>;

@Component({
  selector: 'app-pagination-cell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="custom-pagination" *ngIf="isPagination">
      <div class="controls-left">
      </div>

      <div class="controls-center">
        <button
          type="button"
          class="ag-btn prev-btn"
          [disabled]="page <= 1"
          (click)="onPrev($event)"
        >
          Previous
        </button>
        
        <label>
          Size:
          <select [value]="pageSize" (change)="onPageSizeChange($event)">
            <option [value]="5">5</option>
            <option [value]="10">10</option>
            <option [value]="20">20</option>
            <option [value]="50">50</option>
          </select>
        </label>

        <span>Page {{ page }} of {{ total }}</span>

        <button
          type="button"
          class="ag-btn next-btn"
          [disabled]="page >= total"
          (click)="onNext($event)"
        >
          Next
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .custom-pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        box-sizing: border-box;
        padding: 5px 15px;
        width: 100%;
        height: 100%;
        position: relative;
      }

      .controls-left {
        position: absolute;
        left: 15px;
      }

      .controls-center {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      label {
        font-size: 13px;
        color: #666;
      }

      select {
        margin-left: 5px;
        padding: 2px 4px;
        border: 1px solid #ccc;
        border-radius: 3px;
      }

      button {
        padding: 4px 16px;
        background: #fdfdfd;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s;
      }

      button:hover:not(:disabled) {
        background: #eaeaea;
      }

      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      span {
        font-weight: 500;
        color: #555;
      }
    `
  ]
})
export class PaginationCellRendererComponent
  implements ICellRendererAngularComp
{
  public isPagination = false;
  public page = 1;
  public total = 1;
  public pageSize = 10;

  private params!: PaginationCellParams;

  public agInit(params: PaginationCellParams): void {
    this.setParams(params);
  }

  public refresh(params: PaginationCellParams): boolean {
    this.setParams(params);
    return true;
  }

  public onPrev(event: Event): void {
    event.stopPropagation();
    this.changePage(-1);
  }

  public onNext(event: Event): void {
    event.stopPropagation();
    this.changePage(1);
  }

  public onPageSizeChange(event: Event): void {
    event.stopPropagation();

    const select = event.target as HTMLSelectElement;
    const newSize = Number(select.value);
    const row = this.params.data;

    if (!row || Number.isNaN(newSize)) {
      return;
    }

    this.params.context?.componentParent?.changePageSizeSubcategory?.(
      [row.category, row.subcategory],
      newSize
    );
  }

  private changePage(direction: number): void {
    const row = this.params.data;

    if (!row) {
      return;
    }

    this.params.context?.componentParent?.changePageSubcategory?.(
      [row.category, row.subcategory],
      direction
    );
  }

  private setParams(params: PaginationCellParams): void {
    this.params = params;

    const row = params.data;

    this.isPagination = row?.rowType === 'pagination';

    if (!this.isPagination || !row) {
      return;
    }

    this.page = row.pageNumber ?? 1;
    this.total = row.totalPages ?? 1;
    this.pageSize = row.pageSize ?? 10;
  }
}