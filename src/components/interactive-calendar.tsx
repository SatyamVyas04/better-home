// Interactive mood calendar with quadrimester/yearly view and animated transitions
"use client";

import {
  IconCaretLeftFilled,
  IconCaretRightFilled,
  IconMenu2,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCalendarData } from "@/hooks/use-calendar-data";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { MOOD_COLORS } from "@/lib/calendar-constants";
import { MONTH_GAP, MONTHS_2026, QUADRIMESTERS } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";
import type { InteractiveCalendarProps } from "@/types/calendar";
import { MonthGrid } from "./month-grid";

export function InteractiveCalendar({ className }: InteractiveCalendarProps) {
  const { getEntryForDate, handleSaveEntry } = useCalendarData();
  const [currentQuadrimester, setCurrentQuadrimester] = useState(0);
  const [showAllYear, setShowAllYear] = useState(false);
  const [showNumbers, setShowNumbers] = useLocalStorage(
    "mood-calendar-show-numbers",
    true
  );

  const getFillColor = (dateKey: string): string => {
    const entry = getEntryForDate(dateKey);
    if (entry.mood) {
      return MOOD_COLORS[entry.mood].color;
    }
    if (entry.workLog || entry.journal) {
      return "var(--muted)"; // Color for entries without mood
    }
    return "var(--muted)";
  };

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
      <Card className="flex min-h-0 flex-1 flex-col gap-0 border-border/50 py-2">
        <CardHeader className="flex flex-row items-center justify-between px-3 pb-1">
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
              className="h-6 transform-gpu px-2 text-xs will-change-auto"
              onClick={() => setShowAllYear(!showAllYear)}
              size="sm"
              variant={showAllYear ? "default" : "outline"}
            >
              {showAllYear ? "quadrimester" : "full year"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 overflow-auto px-3 py-1.5">
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
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {currentMonths.map((monthIndex, i) => {
                const month = MONTHS_2026[monthIndex];
                return (
                  <MonthGrid
                    animationDelay={i * 0.05}
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
