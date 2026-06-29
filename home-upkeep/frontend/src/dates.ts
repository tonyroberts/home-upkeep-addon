/**
 * Parse a date-only value (e.g. "2026-06-11", as returned by the API for
 * `due_date` or produced by an `<input type="date">`) into a local `Date` at
 * midnight.
 *
 * `new Date("2026-06-11")` parses the string as UTC midnight, so in any
 * timezone behind UTC the resulting `Date` falls on the previous calendar day.
 * That made due dates show as Due/Overdue a day early (see issue #7). Building
 * the `Date` from its components keeps it on the intended calendar day in the
 * user's local timezone.
 */
export function parseDueDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}
