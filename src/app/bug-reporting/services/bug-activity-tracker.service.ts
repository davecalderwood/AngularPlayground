import { Injectable } from '@angular/core';
import { BugDiagnosticEvent } from '../models/bug-diagnostic.models';
import { BugDiagnosticService } from './bug-diagnostic.service';

export const BUG_DIAGNOSTIC_ACTION_ATTRIBUTE = 'data-bug-action' as const;

export const BUG_DIAGNOSTIC_SAFE_CLICK_ACTIONS = [
  'SAVE_ADDRESS',
  'OPEN_MODAL',
  'CLOSE_MODAL',
  'SEARCH',
  'NEXT_PAGE',
  'PREVIOUS_PAGE',
  'OPEN_CALENDAR',
  'OPEN_USER',
  'SUBMIT_FORM',
  'REPORT_BUG'
] as const;

export type BugDiagnosticSafeClickAction = typeof BUG_DIAGNOSTIC_SAFE_CLICK_ACTIONS[number];

@Injectable({
  providedIn: 'root'
})
export class BugActivityTrackerService {
  private readonly clickHandler: EventListener = (event) => {
    this.recordClickFromMouseEvent(event as MouseEvent);
  };

  private listeningTarget: Document | HTMLElement | null = null;

  constructor(private readonly bugDiagnosticService: BugDiagnosticService) {}

  startListening(target: Document | HTMLElement): void {
    if (this.listeningTarget === target) {
      return;
    }

    this.stopListening();

    target.addEventListener('click', this.clickHandler, true);
    this.listeningTarget = target;
  }

  stopListening(): void {
    if (!this.listeningTarget) {
      return;
    }

    this.listeningTarget.removeEventListener('click', this.clickHandler, true);
    this.listeningTarget = null;
  }

  recordClickFromMouseEvent(event: Pick<MouseEvent, 'target'>): BugDiagnosticEvent | null {
    return this.recordClickFromTarget(event.target);
  }

  recordClickFromTarget(target: EventTarget | null): BugDiagnosticEvent | null {
    const action = this.resolveSafeAction(target);

    if (!action) {
      return null;
    }

    return this.bugDiagnosticService.addEvent({
      type: 'CLICK',
      action,
      success: true
    });
  }

  private resolveSafeAction(target: EventTarget | null): BugDiagnosticSafeClickAction | null {
    const element = this.resolveElement(target);

    if (!element) {
      return null;
    }

    const annotatedElement = element.closest(`[${BUG_DIAGNOSTIC_ACTION_ATTRIBUTE}]`);

    if (!annotatedElement) {
      return null;
    }

    const candidate = annotatedElement.getAttribute(BUG_DIAGNOSTIC_ACTION_ATTRIBUTE);

    if (!candidate || !this.isSafeClickAction(candidate)) {
      return null;
    }

    return candidate;
  }

  private resolveElement(target: EventTarget | null): Element | null {
    if (!target) {
      return null;
    }

    if (target instanceof Element) {
      return target;
    }

    if (target instanceof Node && target.parentElement) {
      return target.parentElement;
    }

    return null;
  }

  private isSafeClickAction(value: string): value is BugDiagnosticSafeClickAction {
    return (BUG_DIAGNOSTIC_SAFE_CLICK_ACTIONS as readonly string[]).includes(value);
  }
}