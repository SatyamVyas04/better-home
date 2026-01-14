// Interactive mood calendar with quadrimester/yearly view and animated transitions
"use client";

import {
  IconCaretLeftFilled,
  IconCaretRightFilled,
  IconMenu2,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { cn } from "@/lib/utils";

const MOOD_COLORS = {
  coreMemory: { color: "#00C0E8", label: "Core Memory" },
  goodDay: { color: "#34C759", label: "A Good Day" },
  neutral: { color: "#FFD60A", label: "Neutral" },
  badDay: { color: "#FF8D28", label: "A Bad Day" },
  nightmare: { color: "#FF3C30", label: "Nightmare" },
} as const;

type MoodType = keyof typeof MOOD_COLORS;

interface DayEntry {
  mood: MoodType | null;
  workLog: string;
  journal: string;
}

interface CalendarData {
  [dateKey: string]: DayEntry;
}

function getDateKey(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`;
}

function getContrastColor(moodKey: string): string {
  return moodKey === "neutral" ? "black" : "white";
}

interface MoodSelectorProps {
  selectedMood: MoodType | null;
  onSelectMood: (mood: MoodType) => void;
}

function MoodSelector({ selectedMood, onSelectMood }: MoodSelectorProps) {
  const [hoveredMood, setHoveredMood] = useState<MoodType | null>(null);
  const activeMood = hoveredMood || selectedMood;

  return (
    <div className="space-y-2">
      <div className="flex flex-col items-center gap-3 py-1">
        <div className="flex gap-2.5">
          {Object.entries(MOOD_COLORS).map(([key, { color, label }]) => (
            <button
              aria-label={label}
              aria-pressed={selectedMood === key}
              className={cn(
                "size-6 rounded-full transition-all duration-300 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selectedMood === key && "scale-110"
              )}
              key={key}
              onClick={() => onSelectMood(key as MoodType)}
              onMouseEnter={() => setHoveredMood(key as MoodType)}
              onMouseLeave={() => setHoveredMood(null)}
              style={{
                backgroundColor: color,
                boxShadow:
                  selectedMood === key
                    ? `0 0 0 2px var(--background), 0 0 0 4px ${color}`
                    : undefined,
              }}
              title={label}
              type="button"
            >
              <span className="sr-only">{label}</span>
            </button>
          ))}
        </div>

        <div
          className={cn(
            "flex h-7 min-w-40 items-center justify-center rounded-full px-4 font-medium text-xs transition-colors duration-300",
            !activeMood && "bg-muted/30 text-muted-foreground"
          )}
          style={{
            backgroundColor: activeMood
              ? MOOD_COLORS[activeMood].color
              : "var(--muted)",
            color: activeMood ? getContrastColor(activeMood) : undefined,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
              exit={{ filter: "blur(4px)", opacity: 0, y: -5 }}
              initial={{ filter: "blur(4px)", opacity: 0, y: 5 }}
              key={activeMood || "none"}
              transition={{ duration: 0.2 }}
            >
              {activeMood ? MOOD_COLORS[activeMood].label : "select mood"}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

interface DatePopoverProps {
  dateKey: string;
  entry: DayEntry;
  onSave: (dateKey: string, entry: DayEntry) => void;
  displayDate: string;
  children: React.ReactNode;
}

function DatePopover({
  dateKey,
  entry,
  onSave,
  displayDate,
  children,
}: DatePopoverProps) {
  const [open, setOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(entry.mood);
  const [workLog, setWorkLog] = useState(entry.workLog || "");
  const [journal, setJournal] = useState(entry.journal || "");

  useEffect(() => {
    setSelectedMood(entry.mood);
    setWorkLog(entry.workLog || "");
    setJournal(entry.journal || "");
  }, [entry.mood, entry.workLog, entry.journal]);

  const handleSave = () => {
    onSave(dateKey, { mood: selectedMood, workLog, journal });
    setOpen(false);
  };

  const handleClear = () => {
    setSelectedMood(null);
    setWorkLog("");
    setJournal("");
    onSave(dateKey, { mood: null, workLog: "", journal: "" });
    setOpen(false);
  };

  const hasContent = Boolean(entry.workLog || entry.journal);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
          </TooltipTrigger>
          {hasContent && (
            <TooltipContent
              className="min-w-40 max-w-60 p-2.5 text-xs"
              side="top"
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-row items-center justify-between">
                  <h2 className="font-medium text-sm">
                    {Intl.DateTimeFormat().format(new Date(dateKey))}
                  </h2>
                  <div
                    className="h-4 w-4 rounded-full border"
                    style={{
                      backgroundColor: entry.mood
                        ? MOOD_COLORS[entry.mood].color
                        : "var(--muted)",
                      borderColor: entry.mood
                        ? MOOD_COLORS[entry.mood].color
                        : undefined,
                    }}
                  />
                </div>
                {entry.workLog && (
                  <div className="space-y-0.5">
                    <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
                      Work
                    </span>
                    <p className="wrap-break-word line-clamp-2 text-wrap text-xs">
                      {entry.workLog}
                    </p>
                  </div>
                )}
                {entry.journal && (
                  <div className="space-y-0.5">
                    <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
                      Journal
                    </span>
                    <p className="wrap-break-word line-clamp-2 text-wrap text-xs">
                      {entry.journal}
                    </p>
                  </div>
                )}
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-72" side="right" sideOffset={12}>
        <div className="space-y-4 text-center">
          <div className="space-y-0.5">
            <h4 className="font-medium text-foreground text-sm">
              {displayDate}
            </h4>
            <p className="text-muted-foreground text-xs">how was your day?</p>
          </div>

          <MoodSelector
            onSelectMood={setSelectedMood}
            selectedMood={selectedMood}
          />

          <div className="space-y-1.5">
            <Label
              className="font-medium text-xs lowercase"
              htmlFor={`work-${dateKey}`}
            >
              work log
            </Label>
            <Textarea
              className="min-h-15 resize-y"
              id={`work-${dateKey}`}
              onChange={(e) => setWorkLog(e.target.value)}
              placeholder="what did you get done today?"
              rows={3}
              value={workLog}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              className="font-medium text-xs lowercase"
              htmlFor={`journal-${dateKey}`}
            >
              journal
            </Label>
            <Textarea
              className="min-h-15 resize-y"
              id={`journal-${dateKey}`}
              onChange={(e) => setJournal(e.target.value)}
              placeholder="how did it go overall?"
              rows={3}
              value={journal}
            />
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-transparent text-xs"
              onClick={handleClear}
              size="sm"
              variant="outline"
            >
              clear
            </Button>
            <Button className="flex-1 text-xs" onClick={handleSave} size="sm">
              save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const MONTHS_2026 = [
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

interface DateCell {
  day: number;
  week: number;
  dayOfWeek: number;
}

function generateCalendarData(
  startDay: number,
  daysInMonth: number
): DateCell[] {
  const cells: DateCell[] = [];
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

interface InteractiveCalendarProps {
  className?: string;
}

const QUADRIMESTERS = [
  { label: "Jan - Apr", months: [0, 1, 2, 3] },
  { label: "May - Aug", months: [4, 5, 6, 7] },
  { label: "Sep - Dec", months: [8, 9, 10, 11] },
];

// Layout constants
const CELL_SIZE = 20;
const CELL_GAP = 4;
const MONTH_GAP = 28;
const DAY_LABEL_WIDTH = 28;
const QUAD_CELL_SIZE = 36;
const QUAD_CELL_GAP = 6;
const QUAD_DAY_LABEL_WIDTH = 38;

function MonthGrid({
  month,
  monthIndex,
  getEntryForDate,
  getFillColor,
  handleSaveEntry,
  showAllYear,
  showNumbers,
  animationDelay = 0,
}: {
  month: (typeof MONTHS_2026)[number];
  monthIndex: number;
  getEntryForDate: (dateKey: string) => DayEntry;
  getFillColor: (dateKey: string) => string;
  handleSaveEntry: (dateKey: string, entry: DayEntry) => void;
  showAllYear: boolean;
  showNumbers: boolean;
  animationDelay?: number;
}) {
  const monthData = generateCalendarData(month.startDay, month.days);
  const maxWeeks = 6;

  // Use larger sizes for quadrimester view, smaller for full year
  const cellSize = showAllYear ? CELL_SIZE : QUAD_CELL_SIZE;
  const cellGap = showAllYear ? CELL_GAP : QUAD_CELL_GAP;
  const dayLabelWidth = showAllYear ? DAY_LABEL_WIDTH : QUAD_DAY_LABEL_WIDTH;
  const fontSize = showAllYear ? 8 : 14;
  const labelFontSize = showAllYear ? 7 : 11;

  const svgWidth = dayLabelWidth + maxWeeks * (cellSize + cellGap);
  const svgHeight = 7 * (cellSize + cellGap) + 20;

  return (
    <motion.div
      animate={{
        filter: "blur(0px)",
        opacity: 1,
        scale: showAllYear ? 1.1 : 1,
      }}
      className="mx-auto flex h-full w-fit flex-col items-center justify-center"
      initial={{ filter: "blur(8px)", opacity: 0, scale: 0.95 }}
      transition={{
        delay: animationDelay,
        duration: 0.4,
        ease: "easeOut",
      }}
    >
      {/** biome-ignore lint/a11y/noSvgWithoutTitle: Calendar month grid */}
      <svg
        aria-label={`${month.name} 2026 Mood Calendar`}
        className="h-full"
        height={svgHeight + (showAllYear ? 10 : 20)}
        viewBox={`0 0 ${svgWidth} ${svgHeight + (showAllYear ? 10 : 20)}`}
        width={svgWidth}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g>
          {DAY_LABELS.map((label, i) => (
            <text
              dominantBaseline="middle"
              fill="var(--muted-foreground)"
              fontFamily="DMMono, monospace"
              fontSize={labelFontSize}
              fontWeight="500"
              key={label}
              x="0"
              y={cellSize / 2 + i * (cellSize + cellGap)}
            >
              {label}
            </text>
          ))}
        </g>

        {monthData.map((cell) => {
          const x = dayLabelWidth + cell.week * (cellSize + cellGap);
          const y = cell.dayOfWeek * (cellSize + cellGap);
          const dateKey = getDateKey(2026, monthIndex + 1, cell.day);
          const entry = getEntryForDate(dateKey);
          const displayDate = new Date(
            2026,
            monthIndex,
            cell.day
          ).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          const _today = new Date();
          const isToday =
            _today.getFullYear() === 2026 &&
            _today.getMonth() === monthIndex &&
            _today.getDate() === cell.day;

          return (
            <DatePopover
              dateKey={dateKey}
              displayDate={displayDate}
              entry={entry}
              key={dateKey}
              onSave={handleSaveEntry}
            >
              <g className="group cursor-pointer">
                <rect
                  className="transition-all duration-200 group-hover:opacity-80"
                  fill={getFillColor(dateKey)}
                  height={cellSize}
                  rx="4"
                  width={cellSize}
                  x={x}
                  y={y}
                />

                {isToday && (
                  <motion.rect
                    animate={{ opacity: [0.1, 1, 0.1] }}
                    className="pointer-events-none text-foreground shadow-sm-foreground"
                    fill="none"
                    height={cellSize + 4}
                    rx={6}
                    stroke="currentColor"
                    strokeWidth={1.5}
                    transition={{
                      duration: 4,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }}
                    width={cellSize + 4}
                    x={x - 2}
                    y={y - 2}
                  />
                )}
                {showNumbers && (
                  <text
                    dominantBaseline="central"
                    fill={
                      getFillColor(dateKey) === "var(--muted)"
                        ? "var(--muted-foreground)"
                        : getContrastColor(
                            Object.entries(MOOD_COLORS).find(
                              ([, v]) => v.color === getFillColor(dateKey)
                            )?.[0] || ""
                          )
                    }
                    fontFamily="DMMono, monospace"
                    fontSize={fontSize}
                    fontWeight="500"
                    textAnchor="middle"
                    x={x + cellSize / 2}
                    y={y + cellSize / 2}
                  >
                    {String(cell.day).padStart(2, "0")}
                  </text>
                )}
              </g>
            </DatePopover>
          );
        })}

        <text
          dominantBaseline="middle"
          fill="#ffffff"
          fontFamily="DMMono, monospace"
          fontSize={showAllYear ? 10 : 14}
          fontWeight="500"
          textAnchor="middle"
          x={
            dayLabelWidth + (maxWeeks * (cellSize + cellGap)) / 2 - cellGap / 2
          }
          y={7 * (cellSize + cellGap) + (showAllYear ? 10 : 20)}
        >
          {month.name}
        </text>
      </svg>
    </motion.div>
  );
}

export function InteractiveCalendar({ className }: InteractiveCalendarProps) {
  const [calendarData, setCalendarData] = useLocalStorage<CalendarData>(
    "mood-calendar-2026-data",
    {}
  );
  const [currentQuadrimester, setCurrentQuadrimester] = useState(0);
  const [showAllYear, setShowAllYear] = useState(false);
  const [showNumbers, setShowNumbers] = useLocalStorage(
    "mood-calendar-show-numbers",
    true
  );

  const handleSaveEntry = useCallback(
    (dateKey: string, entry: DayEntry) => {
      setCalendarData((prev) => ({
        ...prev,
        [dateKey]: entry,
      }));
    },
    [setCalendarData]
  );

  const getEntryForDate = useCallback(
    (dateKey: string): DayEntry => {
      return calendarData[dateKey] ?? { mood: null, workLog: "", journal: "" };
    },
    [calendarData]
  );

  const getFillColor = useCallback(
    (dateKey: string): string => {
      const entry = getEntryForDate(dateKey);
      if (entry.mood) {
        return MOOD_COLORS[entry.mood].color;
      }
      if (entry.workLog || entry.journal) {
        return "var(--muted)"; // Color for entries without mood
      }
      return "var(--muted)";
    },
    [getEntryForDate]
  );

  const currentMonths = showAllYear
    ? MONTHS_2026.map((_, i) => i)
    : QUADRIMESTERS[currentQuadrimester].months;

  const handlePrevQuadrimester = () => {
    setCurrentQuadrimester((prev) => (prev > 0 ? prev - 1 : 2));
  };

  const handleNextQuadrimester = () => {
    setCurrentQuadrimester((prev) => (prev < 2 ? prev + 1 : 0));
  };

  return (
    <div className={cn("flex min-h-0 flex-1 gap-2", className)}>
      <Card className="flex min-h-0 flex-1 flex-col gap-0 border-border/50 py-3">
        <CardHeader className="flex flex-row items-center justify-between px-4 pb-2">
          <CardTitle className="font-medium text-xs lowercase">
            mood calendar 2026
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              aria-label={
                showNumbers ? "Hide date numbers" : "Show date numbers"
              }
              className="size-6 p-0"
              onClick={() => setShowNumbers(!showNumbers)}
              size="sm"
              title={showNumbers ? "Hide numbers" : "Show numbers"}
              variant={showNumbers ? "default" : "outline"}
            >
              <IconMenu2 className="size-4" />
            </Button>
            <Button
              className="h-6 transform-gpu px-2 text-xs will-change-transform"
              onClick={() => setShowAllYear(!showAllYear)}
              size="sm"
              variant={showAllYear ? "default" : "outline"}
            >
              {showAllYear ? "quadrimester" : "full year"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 overflow-auto px-4 py-4">
          <AnimatePresence mode="wait">
            <motion.div
              animate={{ filter: "blur(0px)", opacity: 1 }}
              className={cn(
                "m-auto flex h-full w-full flex-col place-content-center items-center justify-start gap-4 lg:grid lg:justify-center lg:gap-2",
                showAllYear
                  ? "grid h-[250%] grid-cols-2 grid-rows-6 lg:h-full lg:grid-cols-4 lg:grid-rows-3"
                  : "wide-mode grid-cols-1 grid-rows-4 gap-y- gap-x-8 lg:grid-cols-2 lg:grid-rows-2"
              )}
              exit={{ filter: "blur(4px)", opacity: 0 }}
              initial={{ filter: "blur(4px)", opacity: 0 }}
              key={showAllYear ? "full-year" : `quad-${currentQuadrimester}`}
              style={{ gap: showAllYear ? `${MONTH_GAP}px` : undefined }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {currentMonths.map((monthIndex, i) => {
                const month = MONTHS_2026[monthIndex];
                return (
                  <MonthGrid
                    animationDelay={i * 0.1}
                    getEntryForDate={getEntryForDate}
                    getFillColor={getFillColor}
                    handleSaveEntry={handleSaveEntry}
                    key={month.name}
                    month={month}
                    monthIndex={monthIndex}
                    showAllYear={showAllYear}
                    showNumbers={showNumbers}
                  />
                );
              })}
            </motion.div>
          </AnimatePresence>
        </CardContent>
        <CardFooter className="flex items-center justify-end px-4 pt-2">
          {!showAllYear && (
            <div className="flex items-center gap-1">
              <Button
                aria-label="Previous quadrimester"
                className="size-6 p-0"
                onClick={handlePrevQuadrimester}
                size="sm"
                variant="ghost"
              >
                <IconCaretLeftFilled className="size-4" />
              </Button>
              <span className="min-w-16 text-center font-medium text-muted-foreground text-xs">
                {QUADRIMESTERS[currentQuadrimester].label}
              </span>
              <Button
                aria-label="Next quadrimester"
                className="size-6 p-0"
                onClick={handleNextQuadrimester}
                size="sm"
                variant="ghost"
              >
                <IconCaretRightFilled className="size-4" />
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
