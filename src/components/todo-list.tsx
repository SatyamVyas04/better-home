// Task management widget with local storage persistence
import {
  IconCheck,
  IconGripVertical,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconTrash,
} from "@tabler/icons-react";
import { AnimatePresence, motion, Reorder } from "motion/react";
import { useRef, useState } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocalStorage } from "@/hooks/use-local-storage";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  important: boolean;
  createdAt: number;
}

interface TodoListProps {
  fullSize?: boolean;
}

type SortMode = "manual" | "oldest" | "newest";

interface Filters {
  hideCompleted: boolean;
  importantOnly: boolean;
}

export function TodoList({ fullSize = false }: TodoListProps) {
  const [todos, setTodos] = useLocalStorage<Todo[]>("better-home-todos", [
    {
      id: "default-todo",
      text: "get shit done",
      completed: false,
      important: false,
      createdAt: Date.now(),
    },
  ]);
  const [newTodo, setNewTodo] = useState("");
  const [sortMode, setSortMode] = useLocalStorage<SortMode>(
    "better-home-todo-sort",
    "manual"
  );
  const [filters, setFilters] = useLocalStorage<Filters>(
    "better-home-todo-filters",
    {
      hideCompleted: false,
      importantOnly: false,
    }
  );
  const [holdingDelete, setHoldingDelete] = useState<string | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);

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
    setHoldingDelete(null);
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  };

  const handleDeleteMouseDown = (id: string) => {
    setHoldingDelete(id);
    holdTimeoutRef.current = window.setTimeout(() => {
      deleteTodo(id);
    }, 2000);
  };

  const handleDeleteMouseUp = () => {
    setHoldingDelete(null);
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  };

  const handleReorder = (reorderedTodos: Todo[]) => {
    // Switch to manual mode when reordering
    setSortMode("manual");

    // If no filters are active, just update the order
    const hasActiveFilters = filters.hideCompleted || filters.importantOnly;
    if (!hasActiveFilters) {
      setTodos(reorderedTodos);
      return;
    }

    // When filters are active, merge reordered visible items with hidden items
    setTodos((prev) => {
      // Get the IDs of visible (reordered) todos
      const visibleIds = new Set(reorderedTodos.map((t) => t.id));

      // Get hidden todos (those not in the reordered list)
      const hiddenTodos = prev.filter((todo) => !visibleIds.has(todo.id));

      // Separate hidden todos into categories
      const hiddenCompleted = hiddenTodos.filter((t) => t.completed);
      const isNonImportantIncomplete = (t: Todo) => {
        const isComplete = t.completed;
        const isImportant = t.important;
        return !(isComplete || isImportant);
      };
      const hiddenNonImportant = hiddenTodos.filter(isNonImportantIncomplete);
      const isImportantIncomplete = (t: Todo) => {
        const isComplete = t.completed;
        const isImportant = t.important;
        return !isComplete && isImportant;
      };
      const otherHidden = hiddenTodos.filter(isImportantIncomplete);

      // Build the new array based on active filters
      const result = [...reorderedTodos];

      // If hiding completed, put them at the bottom
      if (filters.hideCompleted) {
        result.push(...hiddenCompleted);
      }

      // If showing only important, put non-important at the bottom
      if (filters.importantOnly) {
        result.push(...hiddenNonImportant);
      }

      // Add any other hidden items
      if (otherHidden.length > 0) {
        result.push(...otherHidden);
      }

      return result;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addTodo();
    }
  };

  // Apply filtering and sorting
  const getFilteredAndSortedTodos = () => {
    let result = [...todos];

    // Apply filters
    if (filters.hideCompleted) {
      result = result.filter((todo) => !todo.completed);
    }
    if (filters.importantOnly) {
      result = result.filter((todo) => todo.important);
    }

    // Apply sorting
    if (sortMode === "oldest") {
      result.sort((a, b) => a.createdAt - b.createdAt);
    } else if (sortMode === "newest") {
      result.sort((a, b) => b.createdAt - a.createdAt);
    }

    return result;
  };

  const displayedTodos = getFilteredAndSortedTodos();
  const completedCount = todos.filter((t) => t.completed).length;
  const totalCount = todos.length;
  // Allow reordering in manual mode (reordering will auto-switch to manual)
  const canReorder = sortMode === "manual";

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
                <Reorder.Group
                  as="div"
                  axis="y"
                  className="flex flex-col space-y-0.5"
                  onReorder={handleReorder}
                  values={displayedTodos}
                >
                  <AnimatePresence mode="popLayout">
                    {displayedTodos.map((todo) => (
                      <ContextMenu key={todo.id}>
                        <ContextMenuTrigger asChild>
                          <Reorder.Item
                            animate={{
                              filter: "blur(0px)",
                              opacity: 1,
                              y: 0,
                              scale: 1,
                            }}
                            className="group flex items-center gap-2 rounded-md border border-border/50 px-1.5 py-2 transition-colors hover:bg-accent/30"
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
                            <label
                              className={`w-full flex-1 cursor-pointer break-all text-xs ${
                                todo.completed
                                  ? "text-muted-foreground line-through"
                                  : ""
                              }`}
                              htmlFor={todo.id}
                            >
                              {todo.text}
                            </label>
                            <AnimatePresence mode="wait">
                              {todo.important && (
                                <motion.div
                                  animate={{
                                    filter: "blur(0px)",
                                    opacity: 1,
                                    scale: 1,
                                  }}
                                  className="translate-x-7 transform transition-transform group-hover:translate-x-0"
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
                              <Tooltip delayDuration={300}>
                                <TooltipTrigger asChild>
                                  <Button
                                    className="relative -my-1 size-6 translate-x-7 transform overflow-clip opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                                    onMouseDown={() =>
                                      handleDeleteMouseDown(todo.id)
                                    }
                                    onMouseLeave={handleDeleteMouseUp}
                                    onMouseUp={handleDeleteMouseUp}
                                    onTouchEnd={handleDeleteMouseUp}
                                    onTouchStart={() =>
                                      handleDeleteMouseDown(todo.id)
                                    }
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
                          </Reorder.Item>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48">
                          <ContextMenuItem onClick={() => toggleTodo(todo.id)}>
                            <IconCheck className="mr-2 size-3.5" />
                            <span className="text-xs lowercase">
                              {todo.completed
                                ? "mark incomplete"
                                : "mark complete"}
                            </span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => toggleImportant(todo.id)}
                          >
                            {todo.important ? (
                              <IconStarFilled className="mr-2 size-3.5" />
                            ) : (
                              <IconStar className="mr-2 size-3.5" />
                            )}
                            <span className="text-xs lowercase">
                              {todo.important
                                ? "unmark important"
                                : "mark important"}
                            </span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}
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
                            {filters.hideCompleted || filters.importantOnly
                              ? "no matching tasks"
                              : "no tasks yet"}
                          </p>
                          {filters.hideCompleted ||
                          filters.importantOnly ? null : (
                            <p className="text-[10px] text-muted-foreground/50">
                              right-click on tasks or card to explore
                            </p>
                          )}
                        </div>
                      </Reorder.Item>
                    )}
                  </AnimatePresence>
                </Reorder.Group>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
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
