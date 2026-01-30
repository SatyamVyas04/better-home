// Utility functions and constants for calendar operations and data generation
export function getDateKey(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`;
}

export function getContrastColor(moodKey: string): string {
  return moodKey === "neutral" ? "black" : "white";
}

export const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export const MONTHS_2026 = [
  { name: "JANUARY", days: 31, startDay: 3 },
  { name: "FEBRUARY", days: 28, startDay: 6 },
  { name: "MARCH", days: 31, startDay: 6 },
  { name: "APRIL", days: 30, startDay: 2 },
  { name: "MAY", days: 31, startDay: 4 },
  { name: "JUNE", days: 30, startDay: 0 },
  { name: "JULY", days: 31, startDay: 2 },
  { name: "AUGUST", days: 31, startDay: 5 },
  { name: "SEPTEMBER", days: 30, startDay: 1 },
  { name: "OCTOBER", days: 31, startDay: 3 },
  { name: "NOVEMBER", days: 30, startDay: 6 },
  { name: "DECEMBER", days: 31, startDay: 1 },
];

export const QUADRIMESTERS = [
  { label: "Jan - Apr", months: [0, 1, 2, 3] },
  { label: "May - Aug", months: [4, 5, 6, 7] },
  { label: "Sep - Dec", months: [8, 9, 10, 11] },
];

export function generateCalendarData(
  startDay: number,
  daysInMonth: number
): import("@/types/calendar").DateCell[] {
  const cells: import("@/types/calendar").DateCell[] = [];
  let dayOfWeek = startDay;
  let week = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, week, dayOfWeek });
    dayOfWeek++;
    if (dayOfWeek === 7) {
      dayOfWeek = 0;
      week++;
    }
  }

  return cells;
}

// Layout constants
export const CELL_SIZE = 20;
export const CELL_GAP = 4;
export const MONTH_GAP = 28;
export const DAY_LABEL_WIDTH = 28;
export const QUAD_CELL_SIZE = 36;
export const QUAD_CELL_GAP = 6;
export const QUAD_DAY_LABEL_WIDTH = 38;

// Font size constants
export const CELL_FONT_SIZE = 8;
export const QUAD_CELL_FONT_SIZE = 14;
export const LABEL_FONT_SIZE = 7;
export const QUAD_LABEL_FONT_SIZE = 11;

// SVG layout constants
export const SVG_HEIGHT_PADDING = 20;
