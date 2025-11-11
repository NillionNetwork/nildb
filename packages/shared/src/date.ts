export const DAY = 1000 * 60 * 60 * 24;

export function advance(date: Date, days = 1) {
  return new Date(date.getTime() + days * DAY);
}
