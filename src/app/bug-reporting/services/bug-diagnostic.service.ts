import { Injectable } from '@angular/core';
import {
  BugDiagnosticEvent,
  BugDiagnosticEventInput,
  BugDiagnosticSnapshot
} from '../models/bug-diagnostic.models';

@Injectable({
  providedIn: 'root'
})
export class BugDiagnosticService {
  private readonly maxEvents = 50;
  private readonly timeline: BugDiagnosticEvent[] = [];

  addEvent(event: BugDiagnosticEventInput): BugDiagnosticEvent {
    const normalizedEvent: BugDiagnosticEvent = {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString()
    };

    this.timeline.push(normalizedEvent);
    this.trimTimeline();

    return normalizedEvent;
  }

  getTimeline(): BugDiagnosticEvent[] {
    return [...this.timeline].sort((left, right) =>
      left.timestamp.localeCompare(right.timestamp)
    );
  }

  clearTimeline(): void {
    this.timeline.length = 0;
  }

  createSnapshot(): BugDiagnosticSnapshot {
    const events = this.getTimeline();

    return {
      generatedAt: new Date().toISOString(),
      totalEvents: events.length,
      events
    };
  }

  private trimTimeline(): void {
    while (this.timeline.length > this.maxEvents) {
      this.timeline.shift();
    }
  }
}