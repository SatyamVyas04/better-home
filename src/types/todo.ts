export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  important: boolean;
  createdAt: number;
}

export type SortMode = "manual" | "oldest" | "newest";

export interface TodoFilters {
  hideCompleted: boolean;
  importantOnly: boolean;
}
