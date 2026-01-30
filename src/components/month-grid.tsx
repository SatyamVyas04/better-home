// Calendar month grid component with animated date cells and mood visualization
import { motion } from "motion/react";
import { MOOD_COLORS } from "@/lib/calendar-constants";
import {
  CELL_FONT_SIZE,
  CELL_GAP,
  CELL_SIZE,
  DAY_LABEL_WIDTH,
  DAY_LABELS,
  generateCalendarData,
  getContrastColor,
  getDateKey,
  LABEL_FONT_SIZE,
  QUAD_CELL_FONT_SIZE,
  QUAD_CELL_GAP,
  QUAD_CELL_SIZE,
  QUAD_DAY_LABEL_WIDTH,
  QUAD_LABEL_FONT_SIZE,
  SVG_HEIGHT_PADDING,
} from "@/lib/calendar-utils";
import type { MonthGridProps } from "@/types/calendar";
import { DatePopover } from "./date-popover";

export function MonthGrid({
  month,
  monthIndex,
  getEntryForDate,
  getFillColor,
  handleSaveEntry,
  showAllYear,
  showNumbers,
  animationDelay = 0,
}: MonthGridProps) {
  const monthData = generateCalendarData(month.startDay, month.days);
  const maxWeeks = 6;

  // Use larger sizes for quadrimester view, smaller for full year
  const cellSize = showAllYear ? CELL_SIZE : QUAD_CELL_SIZE;
  const cellGap = showAllYear ? CELL_GAP : QUAD_CELL_GAP;
  const dayLabelWidth = showAllYear ? DAY_LABEL_WIDTH : QUAD_DAY_LABEL_WIDTH;
  const fontSize = showAllYear ? CELL_FONT_SIZE : QUAD_CELL_FONT_SIZE;
  const labelFontSize = showAllYear ? LABEL_FONT_SIZE : QUAD_LABEL_FONT_SIZE;

  const svgWidth = dayLabelWidth + maxWeeks * (cellSize + cellGap);
  const svgHeight = 7 * (cellSize + cellGap) + SVG_HEIGHT_PADDING;

  return (
    <motion.div
      animate={{
        filter: "blur(0px)",
        opacity: 1,
        scale: showAllYear ? 1.05 : 1,
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
