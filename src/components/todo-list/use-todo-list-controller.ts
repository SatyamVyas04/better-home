import type React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { runTrackedUserAction } from "@/lib/session-history";
import {
  applyFilters,
  applyFiltersAndSorting,
  createTodoSections,
  DELETE_HOLD_DURATION,
  mergeReorderedSectionWithHidden,
  mergeReorderedWithHidden,
} from "@/lib/todo-utils";
import type {
  SortMode,
  Todo,
  TodoFilters,
  TodoGroup,
  TodoGroupColorName,
} from "@/types/todo";

export function useTodoListController() {
  const [todos, setTodos] = useLocalStorage<Todo[]>("better-home-todos", [
    {
      id: "default-todo",
      text: "get shit done",
      completed: false,
      important: false,
      groupId: null,
      createdAt: Date.now(),
    },
  ]);
  const [todoGroups, setTodoGroups] = useLocalStorage<TodoGroup[]>(
    "better-home-todo-groups",
    []
  );
  const [newTodo, setNewTodo] = useState("");
  const [sortMode, setSortMode] = useLocalStorage<SortMode>(
    "better-home-todo-sort",
    "manual"
  );
  const [filters, setFilters] = useLocalStorage<TodoFilters>(
    "better-home-todo-filters",
    {
      hideCompleted: false,
      importantOnly: false,
    }
  );
  const [groupByEnabled, setGroupByEnabled] = useLocalStorage<boolean>(
    "better-home-todo-group-by",
    false
  );
  const [collapsedSections, setCollapsedSections] = useLocalStorage<
    Record<string, boolean>
  >("better-home-todo-collapsed-sections", {});
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editTodoText, setEditTodoText] = useState("");
  const [groupDraftName, setGroupDraftName] = useState("");
  const [groupDraftColor, setGroupDraftColor] =
    useState<TodoGroupColorName>("blue");
  const [holdingDelete, setHoldingDelete] = useState<string | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  const runTodoAction = <T>(label: string, action: () => T): T => {
    return runTrackedUserAction(label, action);
  };

  useEffect(() => {
    setTodos((prev) => {
      const hasLegacyTodoShape = prev.some(
        (todo) => typeof todo.groupId === "undefined"
      );

      if (!hasLegacyTodoShape) {
        return prev;
      }

      return prev.map((todo) => ({
        ...todo,
        groupId: todo.groupId ?? null,
      }));
    });
  }, [setTodos]);

  useEffect(() => {
    return () => {
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
      }
    };
  }, []);

  const getGroupColorVar = (colorName: TodoGroupColorName): string =>
    `var(--todo-group-${colorName})`;

  const getColorDisplayName = (colorName: TodoGroupColorName): string =>
    colorName.charAt(0).toUpperCase() + colorName.slice(1);

  const syncTextareaHeight = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const setTextareaRef = (todoId: string, node: HTMLTextAreaElement | null) => {
    if (!node) {
      textareaRefs.current.delete(todoId);
      return;
    }

    textareaRefs.current.set(todoId, node);
    syncTextareaHeight(node);
  };

  useLayoutEffect(() => {
    for (const textarea of textareaRefs.current.values()) {
      syncTextareaHeight(textarea);
    }
  });

  const assignTodoGroup = (todoId: string, groupId: string | null) => {
    runTodoAction("assign task group", () => {
      setTodos((prev) =>
        prev.map((todo) => (todo.id === todoId ? { ...todo, groupId } : todo))
      );
    });
  };

  const resetGroupDraft = () => {
    setGroupDraftName("");
    setGroupDraftColor("blue");
  };

  const blurActiveElement = () => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  };

  const closeTodoContextMenu = () => {
    resetGroupDraft();
  };

  const cancelEditingTodo = () => {
    setEditingTodoId(null);
    setEditTodoText("");
  };

  const handleTodoContextMenuOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      blurActiveElement();
      cancelEditingTodo();
      return;
    }

    closeTodoContextMenu();
  };

  const deleteGroupAndClearTodos = (groupId: string) => {
    runTodoAction("delete todo group", () => {
      setTodoGroups((prev) => prev.filter((group) => group.id !== groupId));
      setTodos((prev) =>
        prev.map((todo) =>
          todo.groupId === groupId ? { ...todo, groupId: null } : todo
        )
      );
    });
  };

  const createGroupForTodo = (todoId: string) => {
    const normalizedName = groupDraftName.trim();
    if (!normalizedName) {
      return false;
    }

    const didCreateGroup = runTodoAction("create todo group", () => {
      const existingGroup = todoGroups.find(
        (group) => group.name.toLowerCase() === normalizedName.toLowerCase()
      );

      if (existingGroup) {
        assignTodoGroup(todoId, existingGroup.id);
        return true;
      }

      const newGroup: TodoGroup = {
        id: crypto.randomUUID(),
        name: normalizedName,
        color: groupDraftColor,
      };

      setTodoGroups((prev) => [newGroup, ...prev]);
      assignTodoGroup(todoId, newGroup.id);
      return true;
    });

    if (didCreateGroup) {
      blurActiveElement();
      resetGroupDraft();
    }

    return didCreateGroup;
  };

  const addTodo = () => {
    const trimmedText = newTodo.trim();
    if (!trimmedText) {
      return;
    }

    const todo: Todo = {
      id: crypto.randomUUID(),
      text: trimmedText.toLowerCase(),
      completed: false,
      important: false,
      groupId: null,
      createdAt: Date.now(),
    };

    runTodoAction("add task", () => {
      setTodos((prev) => [todo, ...prev]);
    });
    setNewTodo("");
  };

  const toggleTodo = (id: string) => {
    runTodoAction("toggle task", () => {
      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        )
      );
    });
  };

  const toggleImportant = (id: string) => {
    runTodoAction("toggle task importance", () => {
      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === id ? { ...todo, important: !todo.important } : todo
        )
      );
    });
  };

  const deleteTodo = (id: string) => {
    runTodoAction("delete task", () => {
      setTodos((prev) => prev.filter((todo) => todo.id !== id));
    });
    if (editingTodoId === id) {
      setEditingTodoId(null);
      setEditTodoText("");
    }

    setHoldingDelete(null);
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  };

  const saveEditingTodo = (id: string) => {
    if (editingTodoId !== id) {
      return;
    }

    const trimmedText = editTodoText.trim();
    if (!trimmedText) {
      cancelEditingTodo();
      return;
    }

    runTodoAction("edit task text", () => {
      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === id ? { ...todo, text: trimmedText.toLowerCase() } : todo
        )
      );
    });

    cancelEditingTodo();
  };

  const handleDeleteMouseDown = (id: string) => {
    setHoldingDelete(id);
    holdTimeoutRef.current = window.setTimeout(() => {
      deleteTodo(id);
    }, DELETE_HOLD_DURATION);
  };

  const handleDeleteMouseUp = () => {
    setHoldingDelete(null);
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  };

  const todoGroupsById = useMemo(
    () => new Map(todoGroups.map((group) => [group.id, group])),
    [todoGroups]
  );

  const handleReorder = (reorderedTodos: Todo[]) => {
    runTodoAction("reorder tasks", () => {
      setSortMode("manual");

      const hasActiveFilters = filters.hideCompleted || filters.importantOnly;
      if (!hasActiveFilters) {
        setTodos(reorderedTodos);
        return;
      }

      setTodos((prev) =>
        mergeReorderedWithHidden(reorderedTodos, prev, filters)
      );
    });
  };

  const handleGroupedReorder = (sectionId: string, reorderedTodos: Todo[]) => {
    runTodoAction("reorder grouped tasks", () => {
      setSortMode("manual");
      setTodos((prev) =>
        mergeReorderedSectionWithHidden(
          reorderedTodos,
          prev,
          filters,
          todoGroupsById,
          sectionId
        )
      );
    });
  };

  const toggleSectionCollapsed = (sectionId: string) => {
    runTodoAction("toggle collapsed task section", () => {
      setCollapsedSections((prev) => ({
        ...prev,
        [sectionId]: !(prev[sectionId] ?? false),
      }));
    });
  };

  const updateSortMode = (nextSortMode: SortMode) => {
    runTodoAction("change todo sort", () => {
      setSortMode(nextSortMode);
    });
  };

  const updateFilters = (
    value: TodoFilters | ((previousFilters: TodoFilters) => TodoFilters)
  ) => {
    runTodoAction("change todo filters", () => {
      setFilters(value);
    });
  };

  const updateGroupByEnabled = (enabled: boolean) => {
    runTodoAction("toggle todo grouping", () => {
      setGroupByEnabled(enabled);
    });
  };

  const handleNewTodoKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    addTodo();
  };

  const handleEditKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditingTodo();
      event.currentTarget.blur();
      return;
    }

    if (event.key === " ") {
      event.stopPropagation();
    }
  };

  const handleEditBlur = (
    event: React.FocusEvent<HTMLTextAreaElement>,
    todoId: string
  ) => {
    syncTextareaHeight(event.currentTarget);
    saveEditingTodo(todoId);
  };

  const handleGroupDraftKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    todoId: string
  ) => {
    event.stopPropagation();

    if (event.key === "Enter") {
      event.preventDefault();
      const didCreateGroup = createGroupForTodo(todoId);
      if (didCreateGroup) {
        event.currentTarget.blur();
      }
    }

    if (event.key === "Escape") {
      resetGroupDraft();
    }
  };

  const filteredTodos = useMemo(
    () => applyFilters(todos, filters),
    [filters, todos]
  );

  const displayedTodos = useMemo(
    () => applyFiltersAndSorting(todos, filters, sortMode),
    [filters, sortMode, todos]
  );

  const groupedSections = useMemo(
    () => createTodoSections(filteredTodos, sortMode, todoGroupsById),
    [filteredTodos, sortMode, todoGroupsById]
  );

  const groupUsageCount = useMemo(
    () =>
      todos.reduce((acc, todo) => {
        if (!todo.groupId) {
          return acc;
        }

        acc.set(todo.groupId, (acc.get(todo.groupId) ?? 0) + 1);
        return acc;
      }, new Map<string, number>()),
    [todos]
  );

  const groupsForContextMenu = useMemo(
    () =>
      [...todoGroups].sort((a, b) => {
        const usageA = groupUsageCount.get(a.id) ?? 0;
        const usageB = groupUsageCount.get(b.id) ?? 0;

        if (usageA !== usageB) {
          return usageB - usageA;
        }

        return a.name.localeCompare(b.name);
      }),
    [groupUsageCount, todoGroups]
  );

  const completedCount = todos.filter((todo) => todo.completed).length;
  const totalCount = todos.length;
  const canReorder = sortMode === "manual";
  const hasActiveFilters = filters.hideCompleted || filters.importantOnly;

  return {
    addTodo,
    assignTodoGroup,
    canReorder,
    collapsedSections,
    completedCount,
    createGroupForTodo,
    deleteGroupAndClearTodos,
    displayedTodos,
    editTodoText,
    editingTodoId,
    filters,
    getColorDisplayName,
    getGroupColorVar,
    groupByEnabled,
    groupDraftColor,
    groupDraftName,
    groupedSections,
    groupsForContextMenu,
    handleDeleteMouseDown,
    handleDeleteMouseUp,
    handleEditBlur,
    handleEditKeyDown,
    handleGroupedReorder,
    handleGroupDraftKeyDown,
    handleNewTodoKeyDown,
    handleReorder,
    handleTodoContextMenuOpenChange,
    hasActiveFilters,
    holdingDelete,
    newTodo,
    resetGroupDraft,
    setEditTodoText,
    setEditingTodoId,
    setFilters: updateFilters,
    setGroupByEnabled: updateGroupByEnabled,
    setGroupDraftColor,
    setGroupDraftName,
    setNewTodo,
    setSortMode: updateSortMode,
    setTextareaRef,
    sortMode,
    todoGroupsById,
    toggleImportant,
    toggleSectionCollapsed,
    toggleTodo,
    totalCount,
  };
}
