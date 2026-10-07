# Grouped Data Browser

A reusable, data-agnostic Angular component for browsing large datasets that have a hierarchy (for example Section > Category > Subcategory). It renders a navigation tree on the left and an AG Grid with pagination on the right.

The component never calls an API. The parent owns all data access and passes hierarchy and rows in. The component emits what it needs (selected node, page plan, sort, search, row action) and the parent decides what to do.

The working reference is `src/app/asset-catalog-demo/`.

## Folder contents

```
grouped-data-browser/
  index.ts                         public API, import from here
  components/
    grouped-data-browser/          main component (tree, grid, pagination)
    grouped-data-browser-row-actions/   icon buttons for the Actions column
  models/                          nodes, page plan, config, events
  services/grouped-page-planner.service.ts   pure page-budget calculator
  configs/grouped-data-browser-default.config.ts   default + example configs
```

To reuse it elsewhere, copy the whole folder. It depends only on Angular, Angular Material (button, form-field, icon, input, progress-spinner, tree), and `ag-grid-angular` / `ag-grid-community`. The app also needs the AG Grid `ag-theme-alpine` stylesheet and the Material Icons font.

## Quick start

```ts
import {
  GroupedDataBrowserComponent,
  GroupedDataBrowserConfig,
  GroupedDataNode,
  GroupedDataPageRequest,
  GroupedDataSortRequest,
  GroupedDataRowActionRequest,
  GroupedDataBrowserSearchCommand,
} from '../grouped-data-browser';

@Component({
  standalone: true,
  imports: [GroupedDataBrowserComponent],
  templateUrl: './my-page.component.html',
})
export class MyPageComponent {
  config: GroupedDataBrowserConfig<MyRow> = { /* see Configuration */ };
  hierarchy: GroupedDataNode[] = [];
  rows: MyRow[] = [];
  totalRecords = 0;
  currentPage = 0;
  loading = false;
  searching = false;
  selectedNodeId: string | null = null;
  searchCommand: GroupedDataBrowserSearchCommand | null = null;
}
```

```html
<app-grouped-data-browser
  [config]="config"
  [navigationNodes]="hierarchy"
  [rows]="rows"
  [totalRecords]="totalRecords"
  [currentPage]="currentPage"
  [loading]="loading"
  [searching]="searching"
  [searchCommand]="searchCommand"
  [(selectedNodeId)]="selectedNodeId"
  (nodeSelected)="onNodeSelected($event)"
  (pageRequested)="loadPage($event)"
  (sortChanged)="onSortChanged($event)"
  (rowActionRequested)="onRowAction($event)"
  (searchRequested)="onSearch($event)">
</app-grouped-data-browser>
```

## Recommended data flow

This mirrors a real backend: a lightweight counts call builds the tree, then page queries fetch rows.

1. Page loads with no data. `hierarchy` is `[]` and the results area stays hidden.
2. The parent runs a search (start job, poll, then fetch the "table desc" / counts response).
3. The parent maps the counts response to `GroupedDataNode[]` and assigns `hierarchy`.
4. The browser auto-selects the first root node and emits `nodeSelected` then `pageRequested`.
5. The parent turns the page plan into row queries, maps the results to the grid row type, and assigns `rows`.
6. Every page, node, or sort change repeats step 5.

Never load all rows just to build the tree. Counts per leaf are enough.

## Configuration

```ts
const config: GroupedDataBrowserConfig<AssetRow> = {
  pageSize: 250,
  columns: [
    { field: 'assetName', headerName: 'Asset', sortable: true, flex: 1 },
  ],
  navigation: {
    enabled: true,
    defaultExpanded: true,
    showCounts: true,
    rootLabel: 'All Assets',
    autoSelectRoot: true,          // default true; set false to wait for a click
  },
  pagination: { enabled: true, showTotal: true },
  sorting: { enabled: true, serverSide: true },
  search: { enabled: false },      // true shows the built-in search box
  getRowId: row => row.id,         // optional, stable row ids
  gridOptions: {},                 // optional AG Grid options
  rowActions: {                    // optional Actions column
    headerName: 'Actions',
    actions: [
      { id: 'flag-for-review', label: 'Flag for review', icon: 'flag' },
      { id: 'mark-for-deletion', label: 'Mark for deletion', icon: 'delete' },
      { id: 'mark-for-deletion', label: 'Mark for deletion', icon: 'check' },
    ],
  },
  emptyMessage: 'No rows to display.',
};
```

Columns come entirely from `config.columns`. Omit `rowActions` and no Actions column is added.

### Page size rule

Each page holds at most 250 rows. `pageSize` is capped at 250. If the total record count is below 250, everything fits on page one even if `pageSize` is smaller.

## Inputs

| Input | Purpose |
|---|---|
| `config` | Required. Behaviour and columns. |
| `navigationNodes` | Hierarchy for the tree. Empty means nothing is shown. |
| `rows` | Rows for the current page. Replace the array each load. |
| `totalRecords` | Total rows for the selected node, used for paging text. |
| `currentPage` | Zero-based page index. |
| `loading` | Shows the grid overlay spinner. |
| `searching` | Replaces the results with a "Searching..." state. |
| `searchCommand` | Parent-triggered search, see below. |
| `selectedNodeId` | Two-way bound selected node id. |

## Outputs

| Output | Payload |
|---|---|
| `nodeSelected` | The `GroupedDataNode` that was clicked. |
| `selectedNodeIdChange` | Node id, for `[(selectedNodeId)]`. |
| `pageRequested` | `GroupedDataPageRequest`: page index, size, selected node, and the page plan. |
| `sortChanged` | `GroupedDataSortRequest`: column, direction, selected node. |
| `rowActionRequested` | `GroupedDataRowActionRequest<T>`: action, row, row id, row index, selected node, page index. |
| `searchRequested` | The trimmed query string. |

## Hierarchy nodes

```ts
{
  id: 'subcategory-badge-readers',  // unique across the whole tree
  label: 'Badge Readers',
  count: 320,
  type: 'subcategory',              // consumer-defined, never interpreted
  metadata: { sectionId: 'buildings', categoryId: 'access-systems', subcategoryId: 'badge-readers' },
  children: [],                     // omit on leaves
}
```

- Depth is arbitrary. A leaf is any node without children.
- Ids must be unique across all levels. Prefix them (`section-`, `category-`, `subcategory-`) so a section and a category cannot collide.
- Parent counts should equal the sum of their children.
- Put whatever you need to query the backend in `metadata` on the leaves. The component copies it onto page segments but never reads it.
- Selection and highlighting use ids only, never labels. Clicking a node highlights its ancestors and every descendant.

## Page plan

Selecting a node gathers its leaf descendants in tree order and slices them into a 250-row window. For counts A = 100, B = 75, C = 400:

- Page 1: A offset 0 take 100, B offset 0 take 75, C offset 0 take 75
- Page 2: C offset 75 take 250
- Page 3: C offset 325 take 75

Each segment looks like this:

```ts
{ nodeId, offset, take, totalCount, metadata }
```

Run one query per segment (in parallel, keeping order) and concatenate the results.

## Mapping incoming data

Backend shapes rarely match the browser's shapes, so keep three mapper functions in the consumer. See `asset-catalog-demo/mappers/asset-catalog.mappers.ts`.

| Mapper | Incoming | Outgoing |
|---|---|---|
| counts to nodes | backend counts response | `GroupedDataNode[]` |
| record to row | backend row DTO | grid row type |
| page plan to queries | `GroupedDataPagePlan` + sort | backend query requests |

Keep the DTO interfaces (incoming) and the row type (outgoing) next to the mappers so the difference is visible in one place.

## Parent-triggered search

Use this when a parent button, not the built-in search box, should start the search.

```ts
requestSearch(): void {
  this.searchCommand = { requestId: ++this.requestId, query: this.searchText };
}
```

The `requestId` must change on every click so repeated identical queries still fire. The browser clears its selection and emits `searchRequested` with the query. The parent then runs the API calls. A blank query is allowed.

Set `searching = true`, clear `hierarchy`, `rows` and `totalRecords`, and cancel any in-flight page request before starting.

## Sorting

With `sorting.serverSide: true` the browser does not sort rows itself. It emits `sortChanged` with the column and direction. Map the column to the backend column name, store the sort, and reload the current page. `column` is the AG Grid column id (the `field` by default). A cleared sort emits `direction: null`.

## Row actions

Each icon button emits `rowActionRequested`. The component only reports what was clicked. The parent decides what it means (flag, delete, open a dialog, call an API). Use the action `id`, not the label, to branch.

## Best practices

- Unsubscribe or cancel the previous page request when a new one starts, so a slow response cannot overwrite a newer page.
- Always replace `rows` with a new array. Do not push into it.
- Set `loading = false` on both success and error.
- Handle an empty plan. Zero segments means zero rows, so clear `rows` and stop loading.
- Take `totalRecords` from the selected node's `count` (the `nodeSelected` event or `pageRequested.selectedNode`).
- Keep sorted order stable per segment on the backend, because each segment is queried separately.
- Provide `getRowId` when rows have a stable id, so row updates do not flicker.
- Keep API names, field names, and domain terms out of this folder. Everything domain-specific lives in the consumer.

## Reusing it for a new dataset

1. Copy the `grouped-data-browser/` folder.
2. Define your row type and a `GroupedDataBrowserConfig<YourRow>`.
3. Write the three mappers for your backend.
4. Add the component and bind the inputs and outputs as in Quick start.
5. Optionally add `rowActions` and a `searchCommand` trigger.

The employee example (`grouped-data-browser-demo/`) and the asset example (`asset-catalog-demo/`) use identical component code with different configs and data.
