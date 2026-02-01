export const MOOD_COLORS = {
  coreMemory: { color: "#00C0E8", label: "Core Memory" },
  goodDay: { color: "#34C759", label: "A Good Day" },
  neutral: { color: "#FFD60A", label: "Neutral" },
  badDay: { color: "#FF8D28", label: "A Bad Day" },
  nightmare: { color: "#FF3C30", label: "Nightmare" },
} as const;

export type MoodType = keyof typeof MOOD_COLORS;
