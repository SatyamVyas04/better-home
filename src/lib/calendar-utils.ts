export function getDateKey(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`;
}

export function getContrastColor(moodKey: string): string {
  return moodKey === "neutral" ? "black" : "white";
}

export const DAY_LABELS_MONDAY_START = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
];
export const DAY_LABELS_SUNDAY_START = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

export const DAY_LABELS = DAY_LABELS_MONDAY_START;

export function getDayLabels(firstDayOfWeek: number): string[] {
  if (firstDayOfWeek === 0) {
    return DAY_LABELS_SUNDAY_START;
  }
  return DAY_LABELS_MONDAY_START;
}

export const CALENDAR_START_YEAR = 2026;
export const CALENDAR_END_YEAR = 2030;

const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
] as const;

export function getMonthsForYear(
  year: number,
  firstDayOfWeek = 1
): { name: string; days: number; startDay: number }[] {
  return MONTH_NAMES.map((name, monthIndex) => {
    const days = new Date(year, monthIndex + 1, 0).getDate();
    const firstDay = new Date(year, monthIndex, 1).getDay();

    return {
      name,
      days,
      startDay: (firstDay + (7 - firstDayOfWeek)) % 7,
    };
  });
}

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

export const CELL_SIZE = 20;
export const CELL_GAP = 4;
export const MONTH_GAP = 28;
export const DAY_LABEL_WIDTH = 28;
export const QUAD_CELL_SIZE = 36;
export const QUAD_CELL_GAP = 6;
export const QUAD_DAY_LABEL_WIDTH = 38;

export const CELL_FONT_SIZE = 8;
export const QUAD_CELL_FONT_SIZE = 14;
export const LABEL_FONT_SIZE = 7;
export const QUAD_LABEL_FONT_SIZE = 11;

export const SVG_HEIGHT_PADDING = 20;
