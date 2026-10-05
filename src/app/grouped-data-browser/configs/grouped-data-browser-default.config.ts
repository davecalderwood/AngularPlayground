import { GroupedDataBrowserConfig } from '../models/grouped-data-browser-config.model';

export function createGroupedDataBrowserDefaultConfig<T>(): GroupedDataBrowserConfig<T> {
  return {
    pageSize: 250,
    columns: [],
    navigation: {
      enabled: true,
      defaultExpanded: true,
      showCounts: true,
    },
    pagination: {
      enabled: true,
      showTotal: true,
    },
    sorting: {
      enabled: true,
      serverSide: true,
    },
    search: {
      enabled: false,
    },
    emptyMessage: 'No rows to display.',
  };
}

interface SampleRecord {
  category_desc: string;
  subcategory_desc: string;
  name: string;
  type: string;
}

interface SampleEmployee {
  name: string;
  jobTitle: string;
  location: string;
}

export const RECORD_BROWSER_EXAMPLE_CONFIG: GroupedDataBrowserConfig<SampleRecord> = {
  pageSize: 250,
  columns: [
    { field: 'category_desc', headerName: 'Category', sortable: true },
    { field: 'subcategory_desc', headerName: 'Subcategory', sortable: true },
    { field: 'name', headerName: 'Name', sortable: true },
    { field: 'type', headerName: 'Type', sortable: true },
  ],
  navigation: {
    enabled: true,
    defaultExpanded: true,
    showCounts: true,
    rootLabel: 'All Records',
  },
  pagination: { enabled: true, showTotal: true },
  sorting: { enabled: true, serverSide: true },
};

export const EMPLOYEE_BROWSER_EXAMPLE_CONFIG: GroupedDataBrowserConfig<SampleEmployee> = {
  pageSize: 250,
  columns: [
    { field: 'name', headerName: 'Employee' },
    { field: 'jobTitle', headerName: 'Job Title' },
    { field: 'location', headerName: 'Location' },
  ],
  navigation: {
    enabled: true,
    defaultExpanded: true,
    showCounts: true,
    rootLabel: 'All Employees',
  },
  pagination: { enabled: true, showTotal: true },
  sorting: { enabled: true, serverSide: true },
};