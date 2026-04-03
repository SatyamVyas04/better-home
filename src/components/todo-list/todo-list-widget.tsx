import { IconChevronRight, IconPlus } from "@tabler/icons-react";
import { AnimatePresence, motion, Reorder } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/todo-scroll-area";
import { cn } from "@/lib/utils";
import type { SortMode, Todo } from "@/types/todo";
import { TodoItemRow } from "./todo-item-row";
import { useTodoListController } from "./use-todo-list-controller";

interface TodoListProps {
  fullSize?: boolean;
}

export function TodoList({ fullSize = false }: TodoListProps) {
  const {
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
    setFilters,
    setGroupByEnabled,
    setGroupDraftColor,
    setGroupDraftName,
    setNewTodo,
    setSortMode,
    setTextareaRef,
    sortMode,
    todoGroupsById,
    toggleImportant,
    toggleSectionCollapsed,
    toggleTodo,
    totalCount,
  } = useTodoListController();

  const renderTodoItem = (todo: Todo) => (
    <TodoItemRow
      canReorder={canReorder}
      editingTodoId={editingTodoId}
      editTodoText={editTodoText}
      getColorDisplayName={getColorDisplayName}
      getGroupColorVar={getGroupColorVar}
      groupDraftColor={groupDraftColor}
      groupDraftName={groupDraftName}
      groupsForContextMenu={groupsForContextMenu}
      holdingDelete={holdingDelete}
      key={todo.id}
      onAssignTodoGroup={assignTodoGroup}
      onCreateGroupForTodo={createGroupForTodo}
      onDeleteGroupAndClearTodos={deleteGroupAndClearTodos}
      onDeleteMouseDown={handleDeleteMouseDown}
      onDeleteMouseUp={handleDeleteMouseUp}
      onEditBlur={handleEditBlur}
      onEditKeyDown={handleEditKeyDown}
      onGroupDraftKeyDown={handleGroupDraftKeyDown}
      onSetEditingTodoId={setEditingTodoId}
      onSetEditTodoText={setEditTodoText}
      onSetGroupDraftColor={setGroupDraftColor}
      onSetGroupDraftName={setGroupDraftName}
      onSetTextareaRef={setTextareaRef}
      onTodoContextMenuOpenChange={handleTodoContextMenuOpenChange}
      onToggleImportant={toggleImportant}
      onToggleTodo={toggleTodo}
      resetGroupDraft={resetGroupDraft}
      todo={todo}
      todoGroup={todo.groupId ? todoGroupsById.get(todo.groupId) : undefined}
    />
  );

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
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-1.5 px-3">
            <div className="flex gap-1">
              <Textarea
                className="max-h-18 min-h-6 flex-1 py-1.25 text-xs lowercase"
                onChange={(event) => setNewTodo(event.target.value)}
                onKeyDown={handleNewTodoKeyDown}
                placeholder="add a task..."
                rows={1}
                value={newTodo}
              />
              <Button
                className="h-full w-8"
                disabled={!newTodo.trim()}
                onClick={addTodo}
                size="icon"
              >
                <IconPlus className="size-4" />
                <span className="sr-only">Add task</span>
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1" maskHeight={40}>
              <div className="flex min-h-full flex-col space-y-0.5 pr-0">
                {groupByEnabled ? (
                  <>
                    {groupedSections.length === 0 && (
                      <div className="flex flex-1 items-center justify-center py-8">
                        <p className="text-muted-foreground text-xs lowercase">
                          {hasActiveFilters
                            ? "no matching tasks"
                            : "no tasks yet"}
                        </p>
                      </div>
                    )}
                    {groupedSections.map((section) => {
                      const isCollapsed =
                        collapsedSections[section.id] ?? false;

                      return (
                        <div
                          className="group/count overflow-hidden rounded-[7px] border border-border/50"
                          key={section.id}
                        >
                          <button
                            className="flex w-full items-center justify-between gap-2 bg-muted/20 px-2 py-1.5 text-left transition-[background-color] hover:bg-muted/35"
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
                                  onReorder={(reordered: Todo[]) =>
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
                          <p className="text-muted-foreground text-xs lowercase">
                            {hasActiveFilters
                              ? "no matching tasks"
                              : "no tasks yet"}
                          </p>
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
            setFilters((prev) => ({ ...prev, hideCompleted: Boolean(checked) }))
          }
        >
          hide completed
        </ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem
          checked={filters.importantOnly}
          className="text-xs lowercase"
          onCheckedChange={(checked) =>
            setFilters((prev) => ({ ...prev, importantOnly: Boolean(checked) }))
          }
        >
          show important only
        </ContextMenuCheckboxItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
