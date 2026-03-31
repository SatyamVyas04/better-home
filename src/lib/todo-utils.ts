import type { SortMode, Todo, TodoFilters, TodoGroup } from "@/types/todo";

export const DELETE_HOLD_DURATION = 1500;
export const TODO_UNGROUPED_SECTION_ID = "ungrouped";
const TODO_GROUP_SECTION_PREFIX = "group:";

export interface TodoSection {
  id: string;
  groupId: string | null;
  label: string;
  color: TodoGroup["color"] | null;
  todos: Todo[];
}

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

function matchesFilters(todo: Todo, filters: TodoFilters): boolean {
  if (filters.hideCompleted && todo.completed) {
    return false;
  }

  if (filters.importantOnly && !todo.important) {
    return false;
  }

  return true;
}

export function getTodoSectionId(
  todo: Todo,
  todoGroupsById: Map<string, TodoGroup>
): string {
  const groupId = todo.groupId;
  if (!groupId) {
    return TODO_UNGROUPED_SECTION_ID;
  }

  if (!todoGroupsById.has(groupId)) {
    return TODO_UNGROUPED_SECTION_ID;
  }

  return `${TODO_GROUP_SECTION_PREFIX}${groupId}`;
}

export function createTodoSections(
  filteredTodos: Todo[],
  sortMode: SortMode,
  todoGroupsById: Map<string, TodoGroup>
): TodoSection[] {
  const sectionsById = new Map<string, TodoSection>();

  for (const todo of filteredTodos) {
    const sectionId = getTodoSectionId(todo, todoGroupsById);
    const groupId = todo.groupId;
    const group = groupId ? todoGroupsById.get(groupId) : undefined;

    if (!sectionsById.has(sectionId)) {
      sectionsById.set(sectionId, {
        id: sectionId,
        groupId: group?.id ?? null,
        label: group?.name ?? "ungrouped",
        color: group?.color ?? null,
        todos: [],
      });
    }

    sectionsById.get(sectionId)?.todos.push(todo);
  }

  const sections = [...sectionsById.values()];

  if (sortMode !== "manual") {
    for (const section of sections) {
      section.todos = applySorting(section.todos, sortMode);
    }
  }

  return sections.sort((a, b) => {
    const aIsUngrouped = a.groupId === null;
    const bIsUngrouped = b.groupId === null;

    if (aIsUngrouped && !bIsUngrouped) {
      return 1;
    }

    if (!aIsUngrouped && bIsUngrouped) {
      return -1;
    }

    if (a.todos.length !== b.todos.length) {
      return b.todos.length - a.todos.length;
    }

    return a.label.localeCompare(b.label);
  });
}

export function mergeReorderedSectionWithHidden(
  reorderedSectionTodos: Todo[],
  allTodos: Todo[],
  filters: TodoFilters,
  todoGroupsById: Map<string, TodoGroup>,
  sectionId: string
): Todo[] {
  const reorderQueue = [...reorderedSectionTodos];

  return allTodos.map((todo) => {
    if (!matchesFilters(todo, filters)) {
      return todo;
    }

    const currentSectionId = getTodoSectionId(todo, todoGroupsById);
    if (currentSectionId !== sectionId) {
      return todo;
    }

    return reorderQueue.shift() ?? todo;
  });
}
