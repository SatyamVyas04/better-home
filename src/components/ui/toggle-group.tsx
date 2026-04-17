"use client";

import type { VariantProps } from "class-variance-authority";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type * as React from "react";
import { createContext, useContext } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToggleGroupVariantContext = VariantProps<typeof buttonVariants>;

const ToggleGroupContext = createContext<ToggleGroupVariantContext>({
  size: "default",
  variant: "default",
});

function ToggleGroup({
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  ToggleGroupVariantContext) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn("inline-flex items-center gap-1", className)}
      data-slot="toggle-group"
      {...props}
    >
      <ToggleGroupContext.Provider value={{ size, variant }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  ToggleGroupVariantContext) {
  const context = useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        buttonVariants({
          size: context.size ?? size,
          variant: context.variant ?? variant,
        }),
        "min-w-0 flex-1 data-[state=on]:bg-muted data-[state=on]:text-foreground",
        className
      )}
      data-slot="toggle-group-item"
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
