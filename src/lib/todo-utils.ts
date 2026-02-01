import type { SortMode, Todo, TodoFilters } from "@/types/todo";

export const DELETE_HOLD_DURATION = 1500;

export function applyFilters(todos: Todo[], filters: TodoFilters): Todo[] {
  let result = [...todos];

  if (filters.hideCompleted) {
    result = result.filter((todo) => !todo.completed);
  }

  if (filters.importantOnly) {
    result = result.filter((todo) => todo.important);
  }

  return result;
}

export function applySorting(todos: Todo[], sortMode: SortMode): Todo[] {
  if (sortMode === "oldest") {
    return [...todos].sort((a, b) => a.createdAt - b.createdAt);
  }

  if (sortMode === "newest") {
    return [...todos].sort((a, b) => b.createdAt - a.createdAt);
  }

  return todos;
}

export function applyFiltersAndSorting(
  todos: Todo[],
  filters: TodoFilters,
  sortMode: SortMode
): Todo[] {
  const filtered = applyFilters(todos, filters);
  return applySorting(filtered, sortMode);
}

export function mergeReorderedWithHidden(
  reorderedTodos: Todo[],
  allTodos: Todo[],
  filters: TodoFilters
): Todo[] {
  const visibleIds = new Set(reorderedTodos.map((t) => t.id));
  const hiddenTodos = allTodos.filter((todo) => !visibleIds.has(todo.id));

  const hiddenCompleted = hiddenTodos.filter((t) => t.completed);
  const hiddenNonImportant = hiddenTodos.filter((t) => {
    const isIncomplete = !t.completed;
    const isNotImportant = !t.important;
    return isIncomplete && isNotImportant;
  });
  const hiddenImportantIncomplete = hiddenTodos.filter((t) => {
    const isIncomplete = !t.completed;
    const isImportant = t.important;
    return isIncomplete && isImportant;
  });

  const result = [...reorderedTodos];

  if (filters.hideCompleted) {
    result.push(...hiddenCompleted);
  }

  if (filters.importantOnly) {
    result.push(...hiddenNonImportant);
  }

  if (hiddenImportantIncomplete.length > 0) {
    result.push(...hiddenImportantIncomplete);
  }

  return result;
}
