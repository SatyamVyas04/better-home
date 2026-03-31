import {
  IconCheck,
  IconChevronRight,
  IconGripVertical,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconTrash,
} from "@tabler/icons-react";
import { AnimatePresence, motion, Reorder } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  applyFilters,
  applyFiltersAndSorting,
  createTodoSections,
  DELETE_HOLD_DURATION,
  mergeReorderedSectionWithHidden,
  mergeReorderedWithHidden,
} from "@/lib/todo-utils";
import { cn } from "@/lib/utils";
import {
  type SortMode,
  TODO_GROUP_COLOR_NAMES,
  type Todo,
  type TodoFilters,
  type TodoGroup,
  type TodoGroupColorName,
} from "@/types/todo";

interface TodoListProps {
  fullSize?: boolean;
}

export function TodoList({ fullSize = false }: TodoListProps) {
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
    setTodos((prev) =>
      prev.map((todo) => (todo.id === todoId ? { ...todo, groupId } : todo))
    );
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

  const handleTodoContextMenuOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      blurActiveElement();
      cancelEditingTodo();
      return;
    }

    closeTodoContextMenu();
  };

  const deleteGroupAndClearTodos = (groupId: string) => {
    setTodoGroups((prev) => prev.filter((group) => group.id !== groupId));
    setTodos((prev) =>
      prev.map((todo) =>
        todo.groupId === groupId ? { ...todo, groupId: null } : todo
      )
    );
  };

  const createGroupForTodo = (todoId: string) => {
    const normalizedName = groupDraftName.trim();
    if (!normalizedName) {
      return false;
    }

    const existingGroup = todoGroups.find(
      (group) => group.name.toLowerCase() === normalizedName.toLowerCase()
    );

    if (existingGroup) {
      assignTodoGroup(todoId, existingGroup.id);
      blurActiveElement();
      resetGroupDraft();
      return true;
    }

    const newGroup: TodoGroup = {
      id: crypto.randomUUID(),
      name: normalizedName,
      color: groupDraftColor,
    };

    setTodoGroups((prev) => [newGroup, ...prev]);
    assignTodoGroup(todoId, newGroup.id);
    blurActiveElement();
    resetGroupDraft();
    return true;
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

    setTodos((prev) => [todo, ...prev]);
    setNewTodo("");
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const toggleImportant = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, important: !todo.important } : todo
      )
    );
  };

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
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

  const cancelEditingTodo = () => {
    setEditingTodoId(null);
    setEditTodoText("");
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

    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, text: trimmedText.toLowerCase() } : todo
      )
    );

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

  const handleReorder = (reorderedTodos: Todo[]) => {
    setSortMode("manual");

    const hasActiveFilters = filters.hideCompleted || filters.importantOnly;
    if (!hasActiveFilters) {
      setTodos(reorderedTodos);
      return;
    }

    setTodos((prev) => mergeReorderedWithHidden(reorderedTodos, prev, filters));
  };

  const handleGroupedReorder = (sectionId: string, reorderedTodos: Todo[]) => {
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
  };

  const toggleSectionCollapsed = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !(prev[sectionId] ?? false),
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addTodo();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.currentTarget.blur();
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      cancelEditingTodo();
      e.currentTarget.blur();
      return;
    }

    if (e.key === " ") {
      e.stopPropagation();
    }
  };

  const handleEditBlur = (
    e: React.FocusEvent<HTMLTextAreaElement>,
    todoId: string
  ) => {
    syncTextareaHeight(e.currentTarget);
    saveEditingTodo(todoId);
  };

  const handleGroupDraftKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    todoId: string
  ) => {
    // Prevent ContextMenu typeahead from reacting while typing in the input.
    e.stopPropagation();

    if (e.key === "Enter") {
      e.preventDefault();
      const didCreateGroup = createGroupForTodo(todoId);
      if (didCreateGroup) {
        e.currentTarget.blur();
      }
    }

    if (e.key === "Escape") {
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
  const todoGroupsById = useMemo(
    () => new Map(todoGroups.map((group) => [group.id, group])),
    [todoGroups]
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
  const completedCount = todos.filter((t) => t.completed).length;
  const totalCount = todos.length;
  const canReorder = sortMode === "manual";
  const hasActiveFilters = filters.hideCompleted || filters.importantOnly;

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This renderer combines drag, edit, delete, and nested menu interactions for a single todo row.
  const renderTodoItem = (todo: Todo) => {
    const todoGroup = todo.groupId
      ? todoGroupsById.get(todo.groupId)
      : undefined;
    const todoGroupColor = todoGroup
      ? getGroupColorVar(todoGroup.color)
      : undefined;

    return (
      <ContextMenu key={todo.id} onOpenChange={handleTodoContextMenuOpenChange}>
        <ContextMenuTrigger asChild>
          <Reorder.Item
            animate={{
              filter: "blur(0px)",
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            className="relative"
            exit={{
              filter: "blur(4px)",
              opacity: 0,
              y: 10,
              scale: 0.95,
            }}
            initial={{
              filter: "blur(4px)",
              opacity: 0,
              y: 10,
              scale: 0.95,
            }}
            transition={{
              duration: 0.3,
              ease: "easeOut",
            }}
            value={todo}
          >
            <div className="group mr-px flex items-center gap-1 rounded-md border border-border/50 px-1.5 py-1 transition-[background-color] hover:bg-accent/30">
              <div
                className={
                  canReorder
                    ? "cursor-grab active:cursor-grabbing"
                    : "cursor-not-allowed opacity-50"
                }
              >
                <IconGripVertical className="size-3.5 text-muted-foreground" />
              </div>
              <Checkbox
                checked={todo.completed}
                className="size-3.5 rounded-sm"
                id={todo.id}
                onCheckedChange={() => toggleTodo(todo.id)}
              />
              <div className="ml-0.5 flex w-full -translate-y-px items-center justify-center">
                <Textarea
                  className={`mt-0.75 min-h-5 w-full rounded-sm border-0 not-active:bg-transparent! px-1 py-px text-xs lowercase leading-3.5 tracking-tight ${
                    editingTodoId === todo.id
                      ? "resize-y overflow-auto"
                      : "resize-none overflow-hidden"
                  } ${todo.completed ? "text-muted-foreground line-through" : ""}`}
                  onBlur={(e) => handleEditBlur(e, todo.id)}
                  onChange={(e) => {
                    if (editingTodoId !== todo.id) {
                      setEditingTodoId(todo.id);
                    }

                    setEditTodoText(e.target.value);
                    syncTextareaHeight(e.currentTarget);
                  }}
                  onFocus={() => {
                    if (editingTodoId === todo.id) {
                      return;
                    }

                    setEditingTodoId(todo.id);
                    setEditTodoText(todo.text);
                  }}
                  onKeyDown={handleEditKeyDown}
                  onPointerDown={(e) => e.stopPropagation()}
                  ref={(node) => setTextareaRef(todo.id, node)}
                  rows={1}
                  value={editingTodoId === todo.id ? editTodoText : todo.text}
                />
              </div>
              <div className="ml-auto flex items-center gap-1 pl-1">
                <AnimatePresence mode="wait">
                  {todo.important && (
                    <motion.div
                      animate={{
                        filter: "blur(0px)",
                        opacity: 1,
                        scale: 1,
                      }}
                      className="translate-x-6 transform transition-transform group-hover:translate-x-0"
                      exit={{
                        filter: "blur(4px)",
                        opacity: 0,
                        scale: 0.8,
                      }}
                      initial={{
                        filter: "blur(4px)",
                        opacity: 0,
                        scale: 0.8,
                      }}
                      key="star"
                      transition={{
                        duration: 0.2,
                        ease: "easeOut",
                      }}
                    >
                      <IconStarFilled className="size-3.5 text-yellow-500" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <TooltipProvider>
                  <Tooltip delayDuration={500}>
                    <TooltipTrigger asChild>
                      <Button
                        className="relative -my-0.75 size-6 translate-x-6 transform overflow-clip opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                        onMouseDown={() => handleDeleteMouseDown(todo.id)}
                        onMouseLeave={handleDeleteMouseUp}
                        onMouseUp={handleDeleteMouseUp}
                        onTouchEnd={handleDeleteMouseUp}
                        onTouchStart={() => handleDeleteMouseDown(todo.id)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <div
                          aria-hidden="true"
                          className={`absolute bottom-0 left-0 flex h-full w-full items-center justify-center bg-destructive text-destructive-foreground transition-[clip-path] ${
                            holdingDelete === todo.id
                              ? "duration-1500 ease-linear [clip-path:inset(0px_0px_0px_0px)]"
                              : "duration-200 ease-out [clip-path:inset(100%_0px_0px_0px)]"
                          }`}
                        >
                          <IconTrash className="size-3.5" />
                        </div>
                        <IconTrash className="size-3.5 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs" side="top">
                      <p className="lowercase">hold to delete</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <AnimatePresence mode="wait">
              {todoGroup && todoGroupColor && (
                <motion.div
                  animate={{
                    filter: "blur(0px)",
                    opacity: 1,
                    scale: 1,
                  }}
                  className="absolute top-0 right-0 bottom-0 w-3 rounded-md"
                  exit={{
                    filter: "blur(4px)",
                    opacity: 0,
                    scale: 0.8,
                  }}
                  initial={{
                    filter: "blur(4px)",
                    opacity: 0,
                    scale: 0.8,
                  }}
                  key="group"
                  style={{
                    background:
                      "linear-gradient(to right, transparent 40%, " +
                      todoGroupColor +
                      ")",
                  }}
                  transition={{
                    duration: 0.2,
                    ease: "easeOut",
                  }}
                >
                  <TooltipProvider>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <div className="h-full w-full" />
                      </TooltipTrigger>
                      <TooltipContent
                        className="p-1 pl-2 text-[10px] lowercase"
                        side="right"
                      >
                        <p>{todoGroup.name.toLowerCase()}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </motion.div>
              )}
            </AnimatePresence>
          </Reorder.Item>
        </ContextMenuTrigger>
        <ContextMenuContent
          className="w-60 bg-card/50 backdrop-blur-lg"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
          }}
          onEscapeKeyDown={resetGroupDraft}
        >
          <ContextMenuItem className="text-xs lowercase" disabled>
            group settings
          </ContextMenuItem>
          <div className="space-y-1.5 px-1 pb-1">
            <Input
              className="h-7 text-xs lowercase"
              onChange={(e) => setGroupDraftName(e.target.value)}
              onKeyDown={(e) => handleGroupDraftKeyDown(e, todo.id)}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="new group name"
              value={groupDraftName}
            />
            <div className="space-y-2 py-1">
              <div className="flex flex-wrap items-center justify-center gap-3 px-2 py-1">
                {TODO_GROUP_COLOR_NAMES.map((colorName) => {
                  const isActive = groupDraftColor === colorName;
                  return (
                    <button
                      aria-label={`select ${getColorDisplayName(colorName)} group color`}
                      aria-pressed={isActive}
                      className={cn(
                        "size-6 rounded-full transition-all duration-300 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isActive && "scale-110"
                      )}
                      key={colorName}
                      onClick={(e) => {
                        e.stopPropagation();
                        setGroupDraftColor(colorName);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{
                        backgroundColor: getGroupColorVar(colorName),
                        boxShadow: isActive
                          ? `0 0 0 2px var(--background), 0 0 0 4px ${getGroupColorVar(
                              colorName
                            )}`
                          : undefined,
                      }}
                      type="button"
                    >
                      <span className="sr-only">
                        {getColorDisplayName(colorName)}
                      </span>
                      {isActive && (
                        <span className="pointer-events-none flex items-center justify-center">
                          <IconCheck className="size-3 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <ContextMenuItem
              className="h-8 w-full text-xs lowercase"
              disabled={!groupDraftName.trim()}
              onSelect={() => {
                createGroupForTodo(todo.id);
              }}
            >
              <IconPlus className="size-3.5" />
              create group
            </ContextMenuItem>
            <div className="mt-1 max-h-36 overflow-y-auto rounded-md border border-border/60 p-1">
              <div className="flex items-center gap-1 rounded-sm p-0.5">
                <ContextMenuItem
                  className="h-6 flex-1 gap-2 px-2 text-xs lowercase"
                  onSelect={() => assignTodoGroup(todo.id, null)}
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full bg-muted-foreground/35"
                  />
                  <span>no group</span>
                  {!todo.groupId && <IconCheck className="ml-auto size-3.5" />}
                </ContextMenuItem>
              </div>
              {groupsForContextMenu.map((group) => {
                const isSelected = todo.groupId === group.id;
                return (
                  <div
                    className="flex items-center gap-1 rounded-sm p-0.5"
                    key={group.id}
                  >
                    <ContextMenuItem
                      className="h-6 min-w-0 flex-1 gap-2 px-2 text-xs lowercase"
                      onSelect={() => assignTodoGroup(todo.id, group.id)}
                    >
                      <span
                        aria-hidden="true"
                        className="size-2.5 rounded-full"
                        style={{
                          backgroundColor: getGroupColorVar(group.color),
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {group.name.toLowerCase()}
                      </span>
                      <span className="ml-1 inline-flex size-3.5 shrink-0 items-center justify-center">
                        {isSelected ? <IconCheck className="size-3.5" /> : null}
                      </span>
                    </ContextMenuItem>
                    <button
                      className="inline-flex size-7 items-center justify-center rounded-sm hover:bg-destructive/10"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteGroupAndClearTodos(group.id);
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      type="button"
                    >
                      <IconTrash className="size-3.5 text-destructive" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <ContextMenuSeparator className="h-px" />
          <ContextMenuItem className="text-xs lowercase" disabled>
            actions
          </ContextMenuItem>
          <ContextMenuItem onClick={() => toggleImportant(todo.id)}>
            {todo.important ? (
              <IconStarFilled className="mr-2 size-3.5" />
            ) : (
              <IconStar className="mr-2 size-3.5" />
            )}
            <span className="text-xs lowercase">
              {todo.important ? "unmark important" : "mark important"}
            </span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => toggleTodo(todo.id)}>
            <IconCheck className="mr-2 size-3.5" />
            <span className="text-xs lowercase">
              {todo.completed ? "mark incomplete" : "mark complete"}
            </span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card
          className={`flex min-h-0 flex-1 flex-col gap-0 border-border/50 py-2 ${
            fullSize ? "w-full" : "max-h-48 w-full lg:max-h-none lg:w-71"
          }`}
        >
          <CardHeader className="px-3 pb-1">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 font-medium text-xs lowercase">
                <span>tasks</span>
                {totalCount > 0 && (
                  <span className="font-normal text-muted-foreground text-xs">
                    {completedCount}/{totalCount}
                  </span>
                )}
              </CardTitle>
              <p className="text-[10px] text-muted-foreground/60">
                right-click for options
              </p>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-1.5 px-3">
            <div className="flex gap-1">
              <Input
                className="h-8 flex-1 text-xs lowercase"
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="add a task..."
                value={newTodo}
              />
              <Button
                className="h-8 w-8"
                disabled={!newTodo.trim()}
                onClick={addTodo}
                size="icon"
              >
                <IconPlus className="size-4" />
                <span className="sr-only">Add task</span>
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="flex min-h-full flex-col space-y-0.5 pr-0">
                {groupByEnabled ? (
                  <>
                    {groupedSections.length === 0 && (
                      <div className="flex flex-1 items-center justify-center py-8">
                        <div className="flex flex-col items-center gap-1">
                          <p className="text-muted-foreground text-xs lowercase">
                            {hasActiveFilters
                              ? "no matching tasks"
                              : "no tasks yet"}
                          </p>
                          {hasActiveFilters ? null : (
                            <p className="text-[10px] text-muted-foreground/50">
                              right-click on tasks or card to explore
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {groupedSections.map((section) => {
                      const isCollapsed =
                        collapsedSections[section.id] ?? false;

                      return (
                        <div
                          className="group/count overflow-hidden rounded-md border border-border/50"
                          key={section.id}
                        >
                          <button
                            className="flex w-full items-center justify-between gap-2 bg-muted/20 px-2 py-1.5 text-left hover:bg-muted/35"
                            onClick={() => toggleSectionCollapsed(section.id)}
                            type="button"
                          >
                            <div className="flex min-w-0 items-center gap-1.5">
                              <IconChevronRight
                                className={cn(
                                  "size-3.5 text-muted-foreground transition-transform",
                                  !isCollapsed && "rotate-90"
                                )}
                              />
                              {section.color && (
                                <span
                                  aria-hidden="true"
                                  className="mt-px size-2 rounded-full"
                                  style={{
                                    backgroundColor: getGroupColorVar(
                                      section.color
                                    ),
                                  }}
                                />
                              )}
                              <span
                                className="min-w-0 truncate text-xs lowercase"
                                style={{
                                  color: section.color
                                    ? getGroupColorVar(section.color)
                                    : undefined,
                                }}
                              >
                                {section.label.toLowerCase()}
                              </span>
                            </div>
                            <span className="translate-x-6 text-[10px] text-muted-foreground opacity-0 transition-all group-hover/count:translate-x-0 group-hover/count:opacity-100">
                              {section.todos.filter((t) => t.completed).length}/
                              {section.todos.length}
                            </span>
                          </button>
                          <AnimatePresence initial={false}>
                            {!isCollapsed && (
                              <motion.div
                                animate={{ height: "auto", opacity: 1 }}
                                className="overflow-hidden"
                                exit={{ height: 0, opacity: 0 }}
                                initial={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                              >
                                <Reorder.Group
                                  as="div"
                                  axis="y"
                                  className="flex flex-col space-y-px p-px"
                                  onReorder={(reordered) =>
                                    handleGroupedReorder(section.id, reordered)
                                  }
                                  values={section.todos}
                                >
                                  <AnimatePresence mode="popLayout">
                                    {section.todos.map(renderTodoItem)}
                                  </AnimatePresence>
                                </Reorder.Group>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <Reorder.Group
                    as="div"
                    axis="y"
                    className="flex flex-col space-y-px"
                    onReorder={handleReorder}
                    values={displayedTodos}
                  >
                    <AnimatePresence mode="popLayout">
                      {displayedTodos.map(renderTodoItem)}
                      {displayedTodos.length === 0 && (
                        <Reorder.Item
                          animate={{ opacity: 1 }}
                          className="flex flex-1 items-center justify-center py-8"
                          exit={{ opacity: 0 }}
                          initial={{ opacity: 0 }}
                          key="empty-message"
                          transition={{ duration: 0.3 }}
                          value={{ id: "empty" } as Todo}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <p className="text-muted-foreground text-xs lowercase">
                              {hasActiveFilters
                                ? "no matching tasks"
                                : "no tasks yet"}
                            </p>
                            {hasActiveFilters ? null : (
                              <p className="text-[10px] text-muted-foreground/50">
                                right-click on tasks or card to explore
                              </p>
                            )}
                          </div>
                        </Reorder.Item>
                      )}
                    </AnimatePresence>
                  </Reorder.Group>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48 bg-card/50 backdrop-blur-lg">
        <ContextMenuRadioGroup
          onValueChange={(value) => setSortMode(value as SortMode)}
          value={sortMode}
        >
          <ContextMenuItem className="text-xs lowercase" disabled>
            sorting
          </ContextMenuItem>
          <ContextMenuRadioItem className="text-xs lowercase" value="oldest">
            oldest first
          </ContextMenuRadioItem>
          <ContextMenuRadioItem className="text-xs lowercase" value="newest">
            newest first
          </ContextMenuRadioItem>
          <ContextMenuRadioItem className="text-xs lowercase" value="manual">
            manual order
          </ContextMenuRadioItem>
        </ContextMenuRadioGroup>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-xs lowercase" disabled>
          grouping
        </ContextMenuItem>
        <ContextMenuCheckboxItem
          checked={groupByEnabled}
          className="text-xs lowercase"
          onCheckedChange={(checked) => setGroupByEnabled(checked)}
        >
          group by group
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-xs lowercase" disabled>
          filters
        </ContextMenuItem>
        <ContextMenuCheckboxItem
          checked={filters.hideCompleted}
          className="text-xs lowercase"
          onCheckedChange={(checked) =>
            setFilters((prev) => ({ ...prev, hideCompleted: checked }))
          }
        >
          hide completed
        </ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem
          checked={filters.importantOnly}
          className="text-xs lowercase"
          onCheckedChange={(checked) =>
            setFilters((prev) => ({ ...prev, importantOnly: checked }))
          }
        >
          show important only
        </ContextMenuCheckboxItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
