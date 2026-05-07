import { Injectable } from '@angular/core';

type RecurrenceType = 0 | 1 | 2 | 3;
// 0 = daily
// 1 = weekly
// 2 = monthly
// 3 = yearly

type RecurrenceRange = 0 | 1 | 2;
// 0 = no end date
// 1 = limited by end date
// 2 = occurrence count

export interface RawCalendarEvent {
  id: string;
  title: string;
  startDate: string | Date;
  endDate?: string | Date;

  recurrenceInfo?: string;

  /**
   * This may need to change based on how the API represents this, but for simplicity we assume it's a single field.
   * If our data ends up being different we may need to adjust the parsing logic and this model accordingly.
   */
  recurrenceEndDate?: string | Date;

  [key: string]: any;
}

export interface ExpandedCalendarEvent extends RawCalendarEvent {
  occurrenceDate: Date;
  occurrenceStartDate: Date;
  occurrenceEndDate?: Date;
  parentEventId: string;
  isRecurringInstance: boolean;
}

interface ParsedRecurrenceInfo {
  type?: RecurrenceType;
  range?: RecurrenceRange;
  occurrenceCount?: number;
  periodicity?: number;

  dayNumber?: number;
  weekDays?: number;
  weekOfMonth?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CalendarRecurrenceService {
  /**
   * Adjust this if we need to use a different weekday bitmask.
   *
   * Common mapping:
   * Sunday    = 1
   * Monday    = 2
   * Tuesday   = 4
   * Wednesday = 8
   * Thursday  = 16
   * Friday    = 32
   * Saturday  = 64
   */
  private readonly weekdayBitmask: Record<number, number> = {
    1: 0, // Sunday
    2: 1, // Monday
    4: 2, // Tuesday
    8: 3, // Wednesday
    16: 4, // Thursday
    32: 5, // Friday
    64: 6, // Saturday
  };

  /**
   * Safety limit for events with Range="0", meaning no end date.
   * This prevents infinite recurring dates.
   */
  private readonly defaultExpandUntilDays = 365;

  expandCalendarEvents(
    events: RawCalendarEvent[],
    options?: {
      expandUntil?: Date;
    },
  ): ExpandedCalendarEvent[] {
    const expandUntil =
      options?.expandUntil ??
      this.addDays(new Date(), this.defaultExpandUntilDays);

    const expanded: ExpandedCalendarEvent[] = [];

    for (const event of events) {
      const startDate = this.toDate(event.startDate);
      const endDate = event.endDate ? this.toDate(event.endDate) : undefined;

      if (!event.recurrenceInfo) {
        expanded.push(
          this.createOccurrence(event, startDate, endDate, startDate, false),
        );
        continue;
      }

      const recurrence = this.parseRecurrenceInfo(event.recurrenceInfo);

      if (recurrence.type === undefined) {
        expanded.push(
          this.createOccurrence(event, startDate, endDate, startDate, false),
        );
        continue;
      }

      const occurrences = this.expandSingleRecurringEvent(
        event,
        recurrence,
        startDate,
        endDate,
        expandUntil,
      );

      expanded.push(...occurrences);
    }

    return expanded.sort(
      (a, b) =>
        a.occurrenceStartDate.getTime() - b.occurrenceStartDate.getTime(),
    );
  }

  groupByOccurrenceDate(
    events: ExpandedCalendarEvent[],
  ): Record<string, ExpandedCalendarEvent[]> {
    return events.reduce(
      (acc, event) => {
        const key = this.formatDateKey(event.occurrenceDate);

        if (!acc[key]) {
          acc[key] = [];
        }

        acc[key].push(event);

        return acc;
      },
      {} as Record<string, ExpandedCalendarEvent[]>,
    );
  }

  private expandSingleRecurringEvent(
    event: RawCalendarEvent,
    recurrence: ParsedRecurrenceInfo,
    originalStart: Date,
    originalEnd: Date | undefined,
    defaultExpandUntil: Date,
  ): ExpandedCalendarEvent[] {
    const occurrences: ExpandedCalendarEvent[] = [];

    const periodicity = recurrence.periodicity ?? 1;
    const range = recurrence.range ?? 0;

    const recurrenceEndDate =
      range === 1 && event.recurrenceEndDate
        ? this.toDate(event.recurrenceEndDate)
        : defaultExpandUntil;

    const maxOccurrences =
      range === 2
        ? (recurrence.occurrenceCount ?? 1)
        : Number.POSITIVE_INFINITY;

    const finalDate = range === 1 ? recurrenceEndDate : defaultExpandUntil;

    const canAdd = (date: Date): boolean => {
      return (
        date.getTime() <= finalDate.getTime() &&
        occurrences.length < maxOccurrences
      );
    };

    const addOccurrence = (date: Date): void => {
      if (!canAdd(date)) {
        return;
      }

      occurrences.push(
        this.createOccurrence(event, originalStart, originalEnd, date, true),
      );
    };

    switch (recurrence.type) {
      case 0:
        this.expandDaily(originalStart, periodicity, canAdd, addOccurrence);
        break;

      case 1:
        this.expandWeekly(
          recurrence,
          originalStart,
          periodicity,
          finalDate,
          maxOccurrences,
          occurrences,
          canAdd,
          addOccurrence,
        );
        break;

      case 2:
        this.expandMonthly(
          recurrence,
          originalStart,
          periodicity,
          finalDate,
          maxOccurrences,
          occurrences,
          canAdd,
          addOccurrence,
        );
        break;

      case 3:
        this.expandYearly(
          recurrence,
          originalStart,
          periodicity,
          finalDate,
          maxOccurrences,
          occurrences,
          addOccurrence,
        );
        break;
    }

    return occurrences;
  }

  private expandDaily(
    originalStart: Date,
    periodicity: number,
    canAdd: (date: Date) => boolean,
    addOccurrence: (date: Date) => void,
  ): void {
    let current = this.cloneDate(originalStart);

    while (canAdd(current)) {
      addOccurrence(current);
      current = this.addDays(current, periodicity);
    }
  }

  private expandWeekly(
    recurrence: ParsedRecurrenceInfo,
    originalStart: Date,
    periodicity: number,
    finalDate: Date,
    maxOccurrences: number,
    occurrences: ExpandedCalendarEvent[],
    canAdd: (date: Date) => boolean,
    addOccurrence: (date: Date) => void,
  ): void {
    const selectedWeekdays = this.getWeekdaysFromBitmask(
      recurrence.weekDays ?? this.dayToBitmask(originalStart.getDay()),
    );

    let weekStart = this.startOfWeek(originalStart);

    while (occurrences.length < maxOccurrences && weekStart <= finalDate) {
      for (const weekday of selectedWeekdays) {
        const occurrenceDateWithoutTime = this.addDays(weekStart, weekday);

        if (occurrenceDateWithoutTime < this.stripTime(originalStart)) {
          continue;
        }

        const occurrenceDate = this.copyTime(
          originalStart,
          occurrenceDateWithoutTime,
        );

        if (canAdd(occurrenceDate)) {
          addOccurrence(occurrenceDate);
        }
      }

      weekStart = this.addDays(weekStart, periodicity * 7);
    }
  }

  private expandMonthly(
    recurrence: ParsedRecurrenceInfo,
    originalStart: Date,
    periodicity: number,
    finalDate: Date,
    maxOccurrences: number,
    occurrences: ExpandedCalendarEvent[],
    canAdd: (date: Date) => boolean,
    addOccurrence: (date: Date) => void,
  ): void {
    let currentMonth = new Date(
      originalStart.getFullYear(),
      originalStart.getMonth(),
      1,
      originalStart.getHours(),
      originalStart.getMinutes(),
      originalStart.getSeconds(),
      originalStart.getMilliseconds(),
    );

    while (occurrences.length < maxOccurrences && currentMonth <= finalDate) {
      let occurrenceDate: Date | null = null;

      if (
        recurrence.weekOfMonth !== undefined &&
        recurrence.weekDays !== undefined
      ) {
        occurrenceDate = this.getNthWeekdayOfMonth(
          currentMonth.getFullYear(),
          currentMonth.getMonth(),
          recurrence.weekOfMonth,
          recurrence.weekDays,
          originalStart,
        );
      } else {
        const day = recurrence.dayNumber ?? originalStart.getDate();

        occurrenceDate = new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth(),
          day,
          originalStart.getHours(),
          originalStart.getMinutes(),
          originalStart.getSeconds(),
          originalStart.getMilliseconds(),
        );

        /**
         * Prevent invalid overflow dates.
         * Example: February 31 becomes March 3 in JS Date.
         */
        if (occurrenceDate.getMonth() !== currentMonth.getMonth()) {
          occurrenceDate = null;
        }
      }

      if (
        occurrenceDate &&
        occurrenceDate >= originalStart &&
        canAdd(occurrenceDate)
      ) {
        addOccurrence(occurrenceDate);
      }

      currentMonth = this.addMonths(currentMonth, periodicity);
    }
  }

  private expandYearly(
    recurrence: ParsedRecurrenceInfo,
    originalStart: Date,
    periodicity: number,
    finalDate: Date,
    maxOccurrences: number,
    occurrences: ExpandedCalendarEvent[],
    addOccurrence: (date: Date) => void,
  ): void {
    let year = originalStart.getFullYear();

    while (occurrences.length < maxOccurrences) {
      const occurrenceDate = new Date(
        year,
        originalStart.getMonth(),
        recurrence.dayNumber ?? originalStart.getDate(),
        originalStart.getHours(),
        originalStart.getMinutes(),
        originalStart.getSeconds(),
        originalStart.getMilliseconds(),
      );

      if (occurrenceDate > finalDate) {
        break;
      }

      if (occurrenceDate >= originalStart) {
        addOccurrence(occurrenceDate);
      }

      year += periodicity;
    }
  }

  private parseRecurrenceInfo(xml: string): ParsedRecurrenceInfo {
    const cleaned = xml.replace(/\\"/g, '"');

    const getAttr = (name: string): string | undefined => {
      const match = cleaned.match(new RegExp(`${name}="([^"]+)"`, 'i'));
      return match?.[1];
    };

    return {
      type: this.toOptionalNumber(getAttr('Type')) as
        | RecurrenceType
        | undefined,
      range: this.toOptionalNumber(getAttr('Range')) as
        | RecurrenceRange
        | undefined,
      occurrenceCount: this.toOptionalNumber(getAttr('OccurrenceCount')),
      periodicity: this.toOptionalNumber(getAttr('Periodicity')),

      dayNumber: this.toOptionalNumber(getAttr('DayNumber')),
      weekDays: this.toOptionalNumber(getAttr('WeekDays')),
      weekOfMonth: this.toOptionalNumber(getAttr('WeekOfMonth')),
    };
  }

  private createOccurrence(
    event: RawCalendarEvent,
    originalStart: Date,
    originalEnd: Date | undefined,
    occurrenceStart: Date,
    isRecurringInstance: boolean,
  ): ExpandedCalendarEvent {
    const durationMs = originalEnd
      ? originalEnd.getTime() - originalStart.getTime()
      : undefined;

    const occurrenceEnd =
      durationMs !== undefined
        ? new Date(occurrenceStart.getTime() + durationMs)
        : undefined;

    return {
      ...event,
      parentEventId: event.id,
      occurrenceDate: this.stripTime(occurrenceStart),
      occurrenceStartDate: occurrenceStart,
      occurrenceEndDate: occurrenceEnd,
      isRecurringInstance,
    };
  }

  private getWeekdaysFromBitmask(bitmask: number): number[] {
    const weekdays: number[] = [];

    for (const [bit, day] of Object.entries(this.weekdayBitmask)) {
      if ((bitmask & Number(bit)) === Number(bit)) {
        weekdays.push(day);
      }
    }

    return weekdays.sort((a, b) => a - b);
  }

  private dayToBitmask(day: number): number {
    const entry = Object.entries(this.weekdayBitmask).find(
      ([, mappedDay]) => mappedDay === day,
    );

    return entry ? Number(entry[0]) : 1;
  }

  private getNthWeekdayOfMonth(
    year: number,
    month: number,
    weekOfMonth: number,
    weekDaysBitmask: number,
    originalStart: Date,
  ): Date | null {
    const weekdays = this.getWeekdaysFromBitmask(weekDaysBitmask);

    if (weekdays.length === 0) {
      return null;
    }

    const targetWeekday = weekdays[0];

    /**
     * Assumption:
     * weekOfMonth 1 = first
     * weekOfMonth 2 = second
     * weekOfMonth 3 = third
     * weekOfMonth 4 = fourth
     * weekOfMonth 5 = last
     */
    if (weekOfMonth === 5) {
      return this.getLastWeekdayOfMonth(
        year,
        month,
        targetWeekday,
        originalStart,
      );
    }

    const firstOfMonth = new Date(year, month, 1);
    const firstDay = firstOfMonth.getDay();

    const daysUntilTarget = (targetWeekday - firstDay + 7) % 7;
    const dayOfMonth = 1 + daysUntilTarget + (weekOfMonth - 1) * 7;

    const result = new Date(
      year,
      month,
      dayOfMonth,
      originalStart.getHours(),
      originalStart.getMinutes(),
      originalStart.getSeconds(),
      originalStart.getMilliseconds(),
    );

    return result.getMonth() === month ? result : null;
  }

  private getLastWeekdayOfMonth(
    year: number,
    month: number,
    targetWeekday: number,
    originalStart: Date,
  ): Date {
    const lastDay = new Date(year, month + 1, 0);
    const diff = (lastDay.getDay() - targetWeekday + 7) % 7;

    return new Date(
      year,
      month,
      lastDay.getDate() - diff,
      originalStart.getHours(),
      originalStart.getMinutes(),
      originalStart.getSeconds(),
      originalStart.getMilliseconds(),
    );
  }

  private toOptionalNumber(value: string | undefined): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private toDate(value: string | Date): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private cloneDate(date: Date): Date {
    return new Date(date.getTime());
  }

  private addDays(date: Date, days: number): Date {
    const copy = this.cloneDate(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  private addMonths(date: Date, months: number): Date {
    const copy = this.cloneDate(date);
    copy.setMonth(copy.getMonth() + months);
    return copy;
  }

  private stripTime(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private copyTime(source: Date, targetDate: Date): Date {
    return new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      source.getHours(),
      source.getMinutes(),
      source.getSeconds(),
      source.getMilliseconds(),
    );
  }

  private startOfWeek(date: Date): Date {
    const stripped = this.stripTime(date);
    return this.addDays(stripped, -stripped.getDay());
  }

  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
