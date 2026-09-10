import type { CivilDate, Instant, WorkingCalendar } from "./model.ts";

const DAY = 86_400_000;
// Dates repeat heavily during portfolio simulation. Cache only calendar-independent
// conversions; caller-owned calendar changes must still take effect immediately.
const serials = new Map<CivilDate, number>();
const dates = new Map<number, CivilDate>();
function serial(date: CivilDate): number {
  let result = serials.get(date);
  if (result === undefined) {
    result = Date.parse(`${date}T00:00:00Z`) / DAY;
    if (serials.size > 30000) { serials.clear(); dates.clear(); }
    serials.set(date, result); dates.set(result, date);
  }
  return result;
}
export function civilDate(value: string): CivilDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid civil date: ${value}`);
  }
  return value as CivilDate;
}
export function at(date: CivilDate, hour = 17): Instant {
  return `${date}T${String(hour).padStart(2, "0")}:00:00.000Z` as Instant;
}
export function dateOf(instant: Instant): CivilDate { return instant.slice(0, 10) as CivilDate; }
export function addDays(date: CivilDate, days: number): CivilDate {
  const day = serial(date) + days;
  let result = dates.get(day);
  if (result === undefined) {
    result = new Date(day * DAY).toISOString().slice(0, 10) as CivilDate;
    if (dates.size > 30000) { serials.clear(); dates.clear(); }
    dates.set(day, result); serials.set(result, day);
  }
  return result;
}
export function daysBetween(from: CivilDate, to: CivilDate): number {
  return serial(to) - serial(from);
}
export function addMonths(date: CivilDate, months: number): CivilDate {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10) as CivilDate;
}
export function weekday(date: CivilDate): number { return ((serial(date) + 3) % 7 + 7) % 7 + 1; }
export function isWorkingDay(date: CivilDate, calendar: WorkingCalendar): boolean {
  return calendar.workingDays.includes(weekday(date)) && !calendar.holidays.includes(date);
}
export function workingOnOrAfter(date: CivilDate, calendar: WorkingCalendar): CivilDate {
  assertCalendar(calendar);
  while (!isWorkingDay(date, calendar)) date = addDays(date, 1);
  return date;
}
export function addWorkingDays(date: CivilDate, days: number, calendar: WorkingCalendar): CivilDate {
  assertCalendar(calendar);
  if (!Number.isInteger(days)) throw new Error("Working-day offset must be an integer");
  const step = Math.sign(days);
  const weekdays = new Set(calendar.workingDays).size;
  for (let left = Math.abs(days); left > 0;) {
    const weeks = Math.floor(left / weekdays);
    if (weeks > 0) {
      const next = addDays(date, weeks * 7 * step);
      const holidays = new Set(calendar.holidays.filter(h => calendar.workingDays.includes(weekday(h)) &&
        (step > 0 ? h > date && h <= next : h < date && h >= next))).size;
      left -= weeks * weekdays - holidays; date = next;
      if (left === 0) while (!isWorkingDay(date, calendar)) date = addDays(date, -step);
      continue;
    }
    date = addDays(date, step);
    if (isWorkingDay(date, calendar)) left--;
  }
  return date;
}
export function workingDaysBetween(from: CivilDate, to: CivilDate, calendar: WorkingCalendar): number {
  assertCalendar(calendar);
  if (from > to) return -workingDaysBetween(to, from, calendar);
  const wholeWeeks = Math.floor(daysBetween(from, to) / 7);
  let count = wholeWeeks * new Set(calendar.workingDays).size;
  for (let d = addDays(from, wholeWeeks * 7 + 1); d <= to; d = addDays(d, 1)) if (calendar.workingDays.includes(weekday(d))) count++;
  return count - new Set(calendar.holidays.filter(h => h > from && h <= to && calendar.workingDays.includes(weekday(h)))).size;
}
export function workingDaysInclusive(from: CivilDate, to: CivilDate, calendar: WorkingCalendar): number {
  if (to < from) return 0;
  return workingDaysBetween(from, to, calendar) + Number(isWorkingDay(from, calendar));
}
/** ISO week keys use the Monday's date, including across calendar-year boundaries. */
export function isoWeek(date: CivilDate): CivilDate { return addDays(date, 1 - weekday(date)); }
export function maxDate(...dates: CivilDate[]): CivilDate { return dates.reduce((a, b) => a > b ? a : b); }
export function minDate(...dates: CivilDate[]): CivilDate { return dates.reduce((a, b) => a < b ? a : b); }
export function assertCalendar(calendar: WorkingCalendar): void {
  if (!calendar.workingDays.length || calendar.workingDays.some(d => !Number.isInteger(d) || d < 1 || d > 7)) {
    throw new Error("Calendar must contain valid working weekdays");
  }
}
