import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

/* ---------------------------------------------
 * Public query types
 * --------------------------------------------- */

export type QueryJoin = 'AND' | 'OR';

export type QueryOperator =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'isEmpty'
  | 'isNotEmpty';

export interface QueryFieldDefinition {
  /**
   * Internal UI identifier.
   * Example: "mNumber"
   */
  key: string;

  /**
   * User-facing name.
   * Example: "M#"
   */
  label: string;

  /**
   * Field name expected by the backend query.
   * Example: "M#"
   */
  backendName: string;

  placeholder?: string;

  /**
   * Optionally restrict the operators available for this field.
   */
  operators?: QueryOperator[];
}

export interface QueryRule {
  kind: 'rule';
  field: string;
  operator: QueryOperator;
  value: string;
}

export interface QueryGroup {
  kind: 'group';
  join: QueryJoin;
  children: Array<QueryRule | QueryGroup>;
}

export interface DocumentAdvancedQuery {
  /**
   * Structured query tree. Useful for editing or saving searches.
   */
  model: QueryGroup;

  /**
   * Serialized string to send in DocumentSearchRequest.Querytext.
   */
  queryText: string;

  /**
   * Human-readable description for the search input or history.
   */
  summary: string;
}

/* ---------------------------------------------
 * Strongly typed Angular form definitions
 * --------------------------------------------- */

export type RuleForm = FormGroup<{
  kind: FormControl<'rule'>;
  field: FormControl<string>;
  operator: FormControl<QueryOperator>;
  value: FormControl<string>;
}>;

export type GroupForm = FormGroup<{
  kind: FormControl<'group'>;
  join: FormControl<QueryJoin>;
  children: FormArray<AbstractControl>;
}>;

@Component({
  selector: 'app-document-query-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './document-query-builder.component.html',
  styleUrls: ['./document-query-builder.component.scss'],
})
export class DocumentQueryBuilderComponent {
  @Input()
  fields: QueryFieldDefinition[] = [
    {
      key: 'mNumber',
      label: 'M#',
      backendName: 'M#',
      placeholder: '123 or abc',
    },
    {
      key: 'name',
      label: 'Document name',
      backendName: 'Name',
      placeholder: 'Enter a document title',
    },
    {
      key: 'author',
      label: 'Author',
      backendName: 'Author',
      placeholder: 'Enter an author name',
    },
    {
      key: 'status',
      label: 'Status',
      backendName: 'Status',
      placeholder: 'Active, Draft, etc.',
    },
  ];

  /**
   * Appended to every advanced query.
   */
  @Input()
  baseQuery = 'Deleted: 0';

  /**
   * Displayed in the modal header.
   */
  @Input()
  title = 'Advanced document search';

  /**
   * Fired when the backdrop, Close, or Cancel is clicked.
   */
  @Output()
  closed = new EventEmitter<void>();

  /**
   * Fired when the user submits a valid query.
   */
  @Output()
  search = new EventEmitter<DocumentAdvancedQuery>();

  readonly operatorLabels: Record<QueryOperator, string> = {
    contains: 'Contains',
    notContains: 'Does not contain',
    equals: 'Equals',
    notEquals: 'Does not equal',
    startsWith: 'Starts with',
    endsWith: 'Ends with',
    isEmpty: 'Is empty',
    isNotEmpty: 'Is not empty',
  };

  readonly defaultOperators: QueryOperator[] = [
    'contains',
    'notContains',
    'equals',
    'notEquals',
    'startsWith',
    'endsWith',
    'isEmpty',
    'isNotEmpty',
  ];

  readonly root: GroupForm;

  constructor(private readonly formBuilder: FormBuilder) {
    this.root = this.createGroup('AND');
    this.addRule(this.root);
  }

  /**
   * Generates the live backend-query preview.
   */
  get preview(): string {
    const model = this.toModel(this.root);
    const advancedQuery = this.serializeGroup(model);

    if (!advancedQuery) {
      return this.baseQuery ? `(${this.baseQuery})` : '';
    }

    return this.baseQuery
      ? `(${advancedQuery}) AND (${this.baseQuery})`
      : advancedQuery;
  }

  /**
   * Enables the Run button only when at least one complete rule exists.
   */
  get canSearch(): boolean {
    return this.root.valid && this.hasAtLeastOneCompleteRule(this.root);
  }

  /* ---------------------------------------------
   * Modal actions
   * --------------------------------------------- */

  close(): void {
    this.closed.emit();
  }

  clearAll(): void {
    this.root.controls.join.setValue('AND');
    this.root.controls.children.clear();

    this.addRule(this.root);
  }

  submit(): void {
    this.root.markAllAsTouched();

    if (!this.canSearch) {
      return;
    }

    const model = this.toModel(this.root);

    this.search.emit({
      model,
      queryText: this.preview,
      summary: this.toReadableSummary(model),
    });
  }

  /* ---------------------------------------------
   * Rule and group actions
   * --------------------------------------------- */

  addRule(group: GroupForm): void {
    group.controls.children.push(this.createRule());
  }

  addGroup(group: GroupForm): void {
    const nestedGroup = this.createGroup('AND');

    // Start the nested group with one rule so that it is immediately usable.
    nestedGroup.controls.children.push(this.createRule());

    group.controls.children.push(nestedGroup);
  }

  removeChild(group: GroupForm, index: number): void {
    if (index < 0 || index >= group.controls.children.length) {
      return;
    }

    group.controls.children.removeAt(index);

    // Always leave the root with at least one editable rule.
    if (group === this.root && group.controls.children.length === 0) {
      this.addRule(group);
    }
  }

  /* ---------------------------------------------
   * Template type helpers
   * --------------------------------------------- */

  isGroup(control: AbstractControl): control is GroupForm {
    return control.get('kind')?.value === 'group';
  }

  asGroup(control: AbstractControl): GroupForm {
    return control as GroupForm;
  }

  asRule(control: AbstractControl): RuleForm {
    return control as RuleForm;
  }

  trackByIndex(index: number): number {
    return index;
  }

  /* ---------------------------------------------
   * Field and operator helpers
   * --------------------------------------------- */

  operatorsFor(rule: RuleForm): QueryOperator[] {
    const selectedField = this.fields.find(
      (field) => field.key === rule.controls.field.value,
    );

    return selectedField?.operators?.length
      ? selectedField.operators
      : this.defaultOperators;
  }

  needsValue(rule: RuleForm): boolean {
    return this.operatorNeedsValue(rule.controls.operator.value);
  }

  placeholderFor(rule: RuleForm): string {
    const selectedField = this.fields.find(
      (field) => field.key === rule.controls.field.value,
    );

    return selectedField?.placeholder ?? 'Enter a value';
  }

  /* ---------------------------------------------
   * Form creation
   * --------------------------------------------- */

  private createRule(): RuleForm {
    const firstField = this.fields[0]?.key ?? '';

    return this.formBuilder.group({
      kind: this.formBuilder.control<'rule'>('rule', {
        nonNullable: true,
      }),

      field: this.formBuilder.control(firstField, {
        nonNullable: true,
        validators: [Validators.required],
      }),

      operator: this.formBuilder.control<QueryOperator>('contains', {
        nonNullable: true,
        validators: [Validators.required],
      }),

      value: this.formBuilder.control('', {
        nonNullable: true,
      }),
    });
  }

  private createGroup(join: QueryJoin): GroupForm {
    return this.formBuilder.group({
      kind: this.formBuilder.control<'group'>('group', {
        nonNullable: true,
      }),

      join: this.formBuilder.control<QueryJoin>(join, {
        nonNullable: true,
      }),

      children: new FormArray<AbstractControl>([]),
    });
  }

  /* ---------------------------------------------
   * Convert forms into query models
   * --------------------------------------------- */

  private toModel(group: GroupForm): QueryGroup {
    return {
      kind: 'group',
      join: group.controls.join.value,

      children: group.controls.children.controls.map((control) => {
        if (this.isGroup(control)) {
          return this.toModel(this.asGroup(control));
        }

        const rule = this.asRule(control);

        return {
          kind: 'rule',
          field: rule.controls.field.value,
          operator: rule.controls.operator.value,
          value: rule.controls.value.value.trim(),
        };
      }),
    };
  }

  /* ---------------------------------------------
   * Backend serialization
   * --------------------------------------------- */

  private serializeGroup(group: QueryGroup): string {
    const queryParts = group.children
      .map((child) => {
        return child.kind === 'group'
          ? this.serializeGroup(child)
          : this.serializeRule(child);
      })
      .filter((queryPart): queryPart is string => queryPart.length > 0);

    if (queryParts.length === 0) {
      return '';
    }

    if (queryParts.length === 1) {
      return queryParts[0];
    }

    return `(${queryParts.join(` ${group.join} `)})`;
  }

  private serializeRule(rule: QueryRule): string {
    const fieldDefinition = this.fields.find(
      (field) => field.key === rule.field,
    );

    if (!fieldDefinition) {
      return '';
    }

    const backendField = fieldDefinition.backendName;
    const value = this.escapeQueryValue(rule.value.trim());

    switch (rule.operator) {
      case 'contains':
        return value ? `${backendField}:*${value}*` : '';

      case 'notContains':
        return value ? `NOT ${backendField}:*${value}*` : '';

      case 'equals':
        return value ? `${backendField}:"${value}"` : '';

      case 'notEquals':
        return value ? `NOT ${backendField}:"${value}"` : '';

      case 'startsWith':
        return value ? `${backendField}:${value}*` : '';

      case 'endsWith':
        return value ? `${backendField}:*${value}` : '';

      case 'isEmpty':
        return `NOT ${backendField}:*`;

      case 'isNotEmpty':
        return `${backendField}:*`;

      default:
        return '';
    }
  }

  /**
   * Escapes special characters in user-provided search values.
   *
   * Adjust this method if the backend uses SQL rather than the
   * fielded query syntax accepted by Querytext.
   */
  private escapeQueryValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/([+\-!(){}\[\]^~?:/])/g, '\\$1')
      .replace(/\s+/g, ' ');
  }

  /* ---------------------------------------------
   * Validation
   * --------------------------------------------- */

  private hasAtLeastOneCompleteRule(group: GroupForm): boolean {
    return group.controls.children.controls.some((control) => {
      if (this.isGroup(control)) {
        return this.hasAtLeastOneCompleteRule(this.asGroup(control));
      }

      const rule = this.asRule(control);
      const hasField = rule.controls.field.value.trim().length > 0;

      if (!hasField) {
        return false;
      }

      if (!this.needsValue(rule)) {
        return true;
      }

      return rule.controls.value.value.trim().length > 0;
    });
  }

  private operatorNeedsValue(operator: QueryOperator): boolean {
    return operator !== 'isEmpty' && operator !== 'isNotEmpty';
  }

  /* ---------------------------------------------
   * Human-readable summary
   * --------------------------------------------- */

  private toReadableSummary(group: QueryGroup): string {
    const summaryParts = group.children
      .map((child) => {
        if (child.kind === 'group') {
          const nestedSummary = this.toReadableSummary(child);

          return nestedSummary ? `(${nestedSummary})` : '';
        }

        const fieldLabel =
          this.fields.find((field) => field.key === child.field)?.label ??
          child.field;

        const operatorLabel = this.operatorLabels[child.operator];

        if (this.operatorNeedsValue(child.operator)) {
          return child.value.trim()
            ? `${fieldLabel} ${operatorLabel.toLowerCase()} “${child.value.trim()}”`
            : '';
        }

        return `${fieldLabel} ${operatorLabel.toLowerCase()}`;
      })
      .filter((summaryPart) => summaryPart.length > 0);

    return summaryParts.join(` ${group.join} `);
  }
}
