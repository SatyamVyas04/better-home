import {
  IconCheck,
  IconGripVertical,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconTrash,
} from "@tabler/icons-react";
import { AnimatePresence, motion, Reorder } from "motion/react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  TODO_GROUP_COLOR_NAMES,
  type Todo,
  type TodoGroup,
  type TodoGroupColorName,
} from "@/types/todo";

interface TodoItemRowProps {
  canReorder: boolean;
  editTodoText: string;
  editingTodoId: string | null;
  groupDraftColor: TodoGroupColorName;
  groupDraftName: string;
  groupsForContextMenu: TodoGroup[];
  holdingDelete: string | null;
  onAssignTodoGroup: (todoId: string, groupId: string | null) => void;
  onCreateGroupForTodo: (todoId: string) => void;
  onDeleteGroupAndClearTodos: (groupId: string) => void;
  onDeleteMouseDown: (id: string) => void;
  onDeleteMouseUp: () => void;
  onEditBlur: (
    event: React.FocusEvent<HTMLTextAreaElement>,
    todoId: string
  ) => void;
  onEditKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onGroupDraftKeyDown: (
    event: React.KeyboardEvent<HTMLInputElement>,
    todoId: string
  ) => void;
  onSetEditTodoText: (value: string) => void;
  onSetEditingTodoId: (todoId: string | null) => void;
  onSetGroupDraftColor: (colorName: TodoGroupColorName) => void;
  onSetGroupDraftName: (value: string) => void;
  onSetTextareaRef: (todoId: string, node: HTMLTextAreaElement | null) => void;
  onTodoContextMenuOpenChange: (isOpen: boolean) => void;
  onToggleImportant: (id: string) => void;
  onToggleTodo: (id: string) => void;
  resetGroupDraft: () => void;
  todo: Todo;
  todoGroup?: TodoGroup;
  getColorDisplayName: (colorName: TodoGroupColorName) => string;
  getGroupColorVar: (colorName: TodoGroupColorName) => string;
}

export function TodoItemRow({
  canReorder,
  editTodoText,
  editingTodoId,
  groupDraftColor,
  groupDraftName,
  groupsForContextMenu,
  holdingDelete,
  onAssignTodoGroup,
  onCreateGroupForTodo,
  onDeleteGroupAndClearTodos,
  onDeleteMouseDown,
  onDeleteMouseUp,
  onEditBlur,
  onEditKeyDown,
  onGroupDraftKeyDown,
  onSetEditTodoText,
  onSetEditingTodoId,
  onSetGroupDraftColor,
  onSetGroupDraftName,
  onSetTextareaRef,
  onTodoContextMenuOpenChange,
  onToggleImportant,
  onToggleTodo,
  resetGroupDraft,
  todo,
  todoGroup,
  getColorDisplayName,
  getGroupColorVar,
}: TodoItemRowProps) {
  const todoGroupColor = todoGroup
    ? getGroupColorVar(todoGroup.color)
    : undefined;

  return (
    <ContextMenu key={todo.id} onOpenChange={onTodoContextMenuOpenChange}>
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
          <div className="group mr-px flex items-center gap-1 rounded-md border border-border/50 px-1.5 py-1 transition-[background-color,border-color] focus-within:bg-accent/30 hover:bg-accent/30">
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
              onCheckedChange={() => onToggleTodo(todo.id)}
            />
            <div className="ml-0.5 flex w-full -translate-y-px items-center justify-center">
              <Textarea
                className={`mt-0.75 min-h-5 w-full rounded-sm border-0 not-active:bg-transparent! px-1 py-px text-xs lowercase leading-3.5 tracking-tight ${
                  editingTodoId === todo.id
                    ? "resize-y overflow-auto"
                    : "resize-none overflow-hidden"
                } ${todo.completed ? "text-muted-foreground line-through" : ""}`}
                onBlur={(event) => onEditBlur(event, todo.id)}
                onChange={(event) => {
                  if (editingTodoId !== todo.id) {
                    onSetEditingTodoId(todo.id);
                  }

                  onSetEditTodoText(event.target.value);
                }}
                onFocus={() => {
                  if (editingTodoId === todo.id) {
                    return;
                  }

                  onSetEditingTodoId(todo.id);
                  onSetEditTodoText(todo.text);
                }}
                onKeyDown={onEditKeyDown}
                onPointerDown={(event) => event.stopPropagation()}
                ref={(node) => onSetTextareaRef(todo.id, node)}
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
                    className="translate-x-6 transform transition-transform group-focus-within:translate-x-0 group-hover:translate-x-0 group-active:translate-x-0"
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
                      className="relative -my-0.75 size-6 translate-x-6 transform overflow-clip opacity-0 transition-all group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:translate-x-0 group-hover:opacity-100 group-active:translate-x-0 group-active:opacity-100"
                      onMouseDown={() => onDeleteMouseDown(todo.id)}
                      onMouseLeave={onDeleteMouseUp}
                      onMouseUp={onDeleteMouseUp}
                      onTouchEnd={onDeleteMouseUp}
                      onTouchStart={() => onDeleteMouseDown(todo.id)}
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
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
        onEscapeKeyDown={resetGroupDraft}
      >
        <ContextMenuItem className="text-xs lowercase" disabled>
          group settings
        </ContextMenuItem>
        <div className="space-y-1.5 px-1 pb-1">
          <Input
            className="h-7 text-xs lowercase"
            onChange={(event) => onSetGroupDraftName(event.target.value)}
            onKeyDown={(event) => onGroupDraftKeyDown(event, todo.id)}
            onPointerDown={(event) => event.stopPropagation()}
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
                    onClick={(event) => {
                      event.stopPropagation();
                      onSetGroupDraftColor(colorName);
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
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
              onCreateGroupForTodo(todo.id);
            }}
          >
            <IconPlus className="size-3.5" />
            create group
          </ContextMenuItem>
          <div className="mt-1 max-h-36 overflow-y-auto rounded-md border border-border/60 p-1">
            <div className="flex items-center gap-1 rounded-sm p-0.5">
              <ContextMenuItem
                className="h-6 flex-1 gap-2 px-2 text-xs lowercase"
                onSelect={() => onAssignTodoGroup(todo.id, null)}
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
                    onSelect={() => onAssignTodoGroup(todo.id, group.id)}
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
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onDeleteGroupAndClearTodos(group.id);
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
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
        <ContextMenuItem onClick={() => onToggleImportant(todo.id)}>
          {todo.important ? (
            <IconStarFilled className="mr-2 size-3.5" />
          ) : (
            <IconStar className="mr-2 size-3.5" />
          )}
          <span className="text-xs lowercase">
            {todo.important ? "unmark important" : "mark important"}
          </span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onToggleTodo(todo.id)}>
          <IconCheck className="mr-2 size-3.5" />
          <span className="text-xs lowercase">
            {todo.completed ? "mark incomplete" : "mark complete"}
          </span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
