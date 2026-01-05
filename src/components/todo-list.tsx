import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocalStorage } from "@/hooks/use-local-storage";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

interface TodoListProps {
  fullSize?: boolean;
}

export function TodoList({ fullSize = false }: TodoListProps) {
  const [todos, setTodos] = useLocalStorage<Todo[]>("better-home-todos", []);
  const [newTodo, setNewTodo] = useState("");

  const addTodo = () => {
    const trimmedText = newTodo.trim();
    if (!trimmedText) {
      return;
    }

    const todo: Todo = {
      id: crypto.randomUUID(),
      text: trimmedText.toLowerCase(),
      completed: false,
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

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addTodo();
    }
  };

  const completedCount = todos.filter((t) => t.completed).length;
  const totalCount = todos.length;

  return (
    <Card
      className={`flex min-h-0 flex-1 flex-col gap-0 border-border/50 py-2 ${
        fullSize ? "w-full" : "max-h-48 w-full lg:max-h-none lg:w-71"
      }`}
    >
      <CardHeader className="px-3 pb-1">
        <CardTitle className="flex items-center gap-2 font-medium text-xs lowercase">
          <span>tasks</span>
          {totalCount > 0 && (
            <span className="font-normal text-muted-foreground text-xs">
              {completedCount}/{totalCount}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-1.5 px-3">
        <div className="flex gap-1">
          <Input
            className="h-8 flex-1 border-border/50 text-xs lowercase"
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

        {todos.length > 0 ? (
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-0.5 pr-0">
              {todos.map((todo) => (
                <div
                  className="group flex items-center gap-2 rounded-md border border-border/50 px-1.5 py-1 transition-colors hover:bg-accent/30"
                  key={todo.id}
                >
                  <Checkbox
                    checked={todo.completed}
                    className="size-3.5 rounded-sm"
                    id={todo.id}
                    onCheckedChange={() => toggleTodo(todo.id)}
                  />
                  <label
                    className={`flex-1 cursor-pointer text-xs ${
                      todo.completed ? "text-muted-foreground line-through" : ""
                    }`}
                    htmlFor={todo.id}
                  >
                    {todo.text}
                  </label>
                  <Button
                    className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => deleteTodo(todo.id)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <IconTrash className="size-3.5 text-destructive" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-1 items-center justify-center py-2">
            <p className="text-muted-foreground text-xs lowercase">
              no tasks yet
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
