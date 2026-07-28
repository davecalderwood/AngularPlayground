import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentQueryBuilderComponent } from './document-query-builder.component';

describe('DocumentQueryBuilderComponent', () => {
  let component: DocumentQueryBuilderComponent;
  let fixture: ComponentFixture<DocumentQueryBuilderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentQueryBuilderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocumentQueryBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
