import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DatePipe } from '@angular/common';
import {
  CalendarRecurrenceService,
  ExpandedCalendarEvent,
  RawCalendarEvent,
} from '../calendar-recurrence.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, DatePipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  expandedEvents: ExpandedCalendarEvent[] = [];
  eventsByDate: Record<string, ExpandedCalendarEvent[]> = {};

  constructor(private calendarRecurrenceService: CalendarRecurrenceService) {}

  ngOnInit(): void {
    const apiEvents: RawCalendarEvent[] = [
      {
        id: '1',
        title: 'One-Time Appointment',
        startDate: '2026-05-07T10:00:00',
        endDate: '2026-05-07T11:00:00',
      },

      {
        id: '2',
        title: 'Daily Standup - Every Day for 5 Occurrences',
        startDate: '2026-05-08T09:00:00',
        endDate: '2026-05-08T09:15:00',
        recurrenceInfo:
          '<RecurrenceInfo Type="0" Range="2" OccurrenceCount="5" Periodicity="1" />',
      },

      {
        id: '4',
        title: 'Weekly Team Meeting - Mondays and Wednesdays',
        startDate: '2026-05-11T10:00:00',
        endDate: '2026-05-11T11:00:00',
        recurrenceEndDate: '2026-06-15T23:59:59',
        recurrenceInfo:
          '<RecurrenceInfo Type="1" Range="1" WeekDays="10" Periodicity="1" />',
      },

      {
        id: '6',
        title: 'Monthly Billing Review - 6th of Each Month',
        startDate: '2026-05-06T13:00:00',
        endDate: '2026-05-06T14:00:00',
        recurrenceEndDate: '2026-12-31T23:59:59',
        recurrenceInfo:
          '<RecurrenceInfo Type="2" Range="1" DayNumber="6" Periodicity="1" />',
      },
    ];

    this.expandedEvents = this.calendarRecurrenceService.expandCalendarEvents(
      apiEvents,
      {
        expandUntil: new Date('2026-12-31'),
      },
    );

    // Sort chronologically by occurrence start date
    this.expandedEvents.sort(
      (a, b) => a.occurrenceStartDate.getTime() - b.occurrenceStartDate.getTime()
    );

    this.eventsByDate = this.calendarRecurrenceService.groupByOccurrenceDate(
      this.expandedEvents,
    );

    console.log(this.expandedEvents);
    console.log(this.eventsByDate);
  }
}
