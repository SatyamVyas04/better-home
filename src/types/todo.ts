export interface Todo {
  completed: boolean;
  createdAt: number;
  groupId?: string | null;
  id: string;
  important: boolean;
  text: string;
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
  color: TodoGroupColorName;
  id: string;
  name: string;
}

export type SortMode = "manual" | "oldest" | "newest";

export interface TodoFilters {
  hideCompleted: boolean;
  importantOnly: boolean;
}
