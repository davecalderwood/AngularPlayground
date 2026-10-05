import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { GroupedDataBrowserComponent } from '../grouped-data-browser/components/grouped-data-browser/grouped-data-browser.component';
import { GroupedDataBrowserConfig } from '../grouped-data-browser/models/grouped-data-browser-config.model';
import {
  GroupedDataBrowserSearchCommand,
  GroupedDataPageRequest,
  GroupedDataSortRequest,
} from '../grouped-data-browser/models/grouped-data-browser-events.model';
import { GroupedDataNode } from '../grouped-data-browser/models/grouped-data-browser.models';

interface EmployeeRow {
  id: string;
  employeeName: string;
  jobTitle: string;
  location: string;
  departmentId: number;
  teamId: number;
}

@Component({
  selector: 'app-grouped-data-browser-demo',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    GroupedDataBrowserComponent,
  ],
  templateUrl: './grouped-data-browser-demo.component.html',
  styleUrl: './grouped-data-browser-demo.component.scss',
})
export class GroupedDataBrowserDemoComponent {
  readonly browserConfig: GroupedDataBrowserConfig<EmployeeRow> = {
    pageSize: 250,
    columns: [
      { field: 'employeeName', headerName: 'Employee', sortable: true, flex: 1 },
      { field: 'jobTitle', headerName: 'Job Title', sortable: true, flex: 1 },
      { field: 'location', headerName: 'Location', sortable: true, flex: 1 },
    ],
    navigation: {
      enabled: true,
      defaultExpanded: true,
      showCounts: true,
      rootLabel: 'All Employees',
    },
    pagination: { enabled: true, showTotal: true },
    sorting: { enabled: true, serverSide: true },
    getRowId: row => row.id,
    emptyMessage: 'No employees in this group.',
  };

  private readonly employeeRows: EmployeeRow[] = [
    { id: 'e-1', employeeName: 'Avery Chen', jobTitle: 'Software Engineer', location: 'Seattle', departmentId: 10, teamId: 101 },
    { id: 'e-2', employeeName: 'Morgan Patel', jobTitle: 'Staff Engineer', location: 'Portland', departmentId: 10, teamId: 101 },
    { id: 'e-3', employeeName: 'Jordan Lee', jobTitle: 'QA Engineer', location: 'Seattle', departmentId: 10, teamId: 102 },
    { id: 'e-4', employeeName: 'Sam Rivera', jobTitle: 'Test Automation Engineer', location: 'Denver', departmentId: 10, teamId: 102 },
    { id: 'e-5', employeeName: 'Taylor Brooks', jobTitle: 'Operations Lead', location: 'Austin', departmentId: 20, teamId: 201 },
    { id: 'e-6', employeeName: 'Casey Nguyen', jobTitle: 'Workplace Coordinator', location: 'Seattle', departmentId: 20, teamId: 201 },
    { id: 'e-7', employeeName: 'Riley Morgan', jobTitle: 'Facilities Specialist', location: 'Portland', departmentId: 20, teamId: 201 },
  ];

  searchText = '';
  searchCommand: GroupedDataBrowserSearchCommand | null = null;
  selectedNodeId: string | null = null;
  hierarchy = this.createHierarchy(this.employeeRows);
  rows = this.employeeRows.slice(0, this.browserConfig.pageSize);
  totalRecords = this.employeeRows.length;
  currentPage = 0;
  loading = false;
  private activeRows = this.employeeRows;
  private searchRequestId = 0;
  private lastPageRequest: GroupedDataPageRequest | null = null;
  private activeSort: GroupedDataSortRequest | null = null;

  requestSearch(): void {
    this.searchCommand = {
      requestId: ++this.searchRequestId,
      query: this.searchText,
    };
  }

  onBrowserSearch(query: string): void {
    const normalizedQuery = query.toLocaleLowerCase();
    this.activeRows = this.employeeRows.filter(row =>
      `${row.employeeName} ${row.jobTitle} ${row.location}`.toLocaleLowerCase().includes(normalizedQuery)
    );
    this.hierarchy = this.createHierarchy(this.activeRows);
    this.totalRecords = this.activeRows.length;
    this.currentPage = 0;
    this.rows = this.activeRows.slice(0, this.browserConfig.pageSize);
    this.lastPageRequest = null;
  }

  onNodeSelected(node: GroupedDataNode): void {
    this.totalRecords = node.count;
  }

  loadPage(request: GroupedDataPageRequest): void {
    this.lastPageRequest = request;
    this.currentPage = request.pageIndex;
    this.loading = true;

    const rows = request.pagePlan.segments.flatMap(segment => {
      const metadata = segment.metadata ?? {};
      const matchingRows = this.activeRows.filter(row =>
        Object.entries(metadata).every(([key, value]) => row[key as keyof EmployeeRow] === value)
      );
      return matchingRows.slice(segment.offset, segment.offset + segment.take);
    });

    this.rows = this.sortRows(rows);
    this.loading = false;
  }

  onSortChanged(request: GroupedDataSortRequest): void {
    this.activeSort = request;
    if (this.lastPageRequest) {
      this.loadPage(this.lastPageRequest);
    }
  }

  private sortRows(rows: EmployeeRow[]): EmployeeRow[] {
    if (!this.activeSort?.column || !this.activeSort.direction) {
      return rows;
    }

    const { column, direction } = this.activeSort;
    return [...rows].sort((left, right) => {
      const leftValue = String(left[column as keyof EmployeeRow] ?? '');
      const rightValue = String(right[column as keyof EmployeeRow] ?? '');
      return leftValue.localeCompare(rightValue) * (direction === 'asc' ? 1 : -1);
    });
  }

  private createHierarchy(rows: EmployeeRow[]): GroupedDataNode[] {
    const departments = [
      { id: 10, label: 'Engineering', teams: [{ id: 101, label: 'Platform' }, { id: 102, label: 'Quality' }] },
      { id: 20, label: 'Operations', teams: [{ id: 201, label: 'Workplace' }] },
    ];

    return [{
      id: 'all-employees',
      label: 'All Employees',
      count: rows.length,
      type: 'all',
      children: departments.flatMap(department => {
        const teams = department.teams.flatMap(team => {
          const count = rows.filter(row => row.teamId === team.id).length;
          return count > 0 ? [{
            id: `team-${team.id}`,
            label: team.label,
            count,
            type: 'team',
            metadata: { departmentId: department.id, teamId: team.id },
          }] : [];
        });
        const count = teams.reduce((total, team) => total + team.count, 0);
        return count > 0 ? [{
          id: `department-${department.id}`,
          label: department.label,
          count,
          type: 'department',
          metadata: { departmentId: department.id },
          children: teams,
        }] : [];
      }),
    }];
  }
}