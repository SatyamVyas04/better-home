import { type ComponentProps, forwardRef, useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface OverlappingLabelInputProps extends ComponentProps<"input"> {
  containerClassName?: string;
  label: string;
  labelClassName?: string;
}

const OverlappingLabelInput = forwardRef<
  HTMLInputElement,
  OverlappingLabelInputProps
>(
  (
    { className, containerClassName, id, label, labelClassName, ...props },
    ref
  ) => {
    const generatedId = useId();
    const resolvedId = id ?? generatedId;

    return (
      <div className={cn("group relative w-full", containerClassName)}>
        <Input
          {...props}
          className={cn("h-8 w-full", className)}
          id={resolvedId}
          ref={ref}
        />
        <Label
          className={cn(
            "absolute bottom-0 left-2 z-10 translate-y-1/2 rounded-md bg-linear-to-b from-input to-card px-1 text-[10px] text-muted-foreground lowercase leading-none opacity-0 transition-opacity group-focus-within:opacity-100 group-active:opacity-100",
            labelClassName
          )}
          htmlFor={resolvedId}
        >
          {label}
        </Label>
      </div>
    );
  }
);

OverlappingLabelInput.displayName = "OverlappingLabelInput";

export { OverlappingLabelInput };
