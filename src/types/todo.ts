export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  important: boolean;
  groupId?: string | null;
  createdAt: number;
}

export const TODO_GROUP_COLOR_NAMES = [
  "red",
  "orange",
  "yellow",
  "green",
  "mint",
  "teal",
  "cyan",
  "blue",
  "indigo",
  "purple",
  "pink",
  "brown",
] as const;

export type TodoGroupColorName = (typeof TODO_GROUP_COLOR_NAMES)[number];

export interface TodoGroup {
  id: string;
  name: string;
  color: TodoGroupColorName;
}

export type SortMode = "manual" | "oldest" | "newest";

export interface TodoFilters {
  hideCompleted: boolean;
  importantOnly: boolean;
}
