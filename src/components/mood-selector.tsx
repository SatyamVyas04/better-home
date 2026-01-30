// Mood selection component with animated hover effects and visual feedback
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { MOOD_COLORS, type MoodType } from "@/lib/calendar-constants";
import { getContrastColor } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";
import type { MoodSelectorProps } from "@/types/calendar";

export function MoodSelector({
  selectedMood,
  onSelectMood,
}: MoodSelectorProps) {
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
            textShadow: "0 0 4px rgba(0, 0, 0, 1)",
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
