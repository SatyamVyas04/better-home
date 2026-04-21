import { Toaster as Sonner, type ToasterProps } from "sonner";
import { cn } from "@/lib/utils";

const DEFAULT_TOAST_CLASS_NAMES = {
  actionButton:
    "group-[.toast]:rounded-md group-[.toast]:border group-[.toast]:border-border group-[.toast]:bg-background group-[.toast]:px-2.5 group-[.toast]:py-1 group-[.toast]:text-foreground group-[.toast]:font-medium group-[.toast]:text-[11px] group-[.toast]:transition-colors group-[.toast]:hover:bg-accent group-[.toast]:hover:text-accent-foreground",
  cancelButton:
    "group-[.toast]:rounded-md group-[.toast]:border group-[.toast]:border-border/80 group-[.toast]:bg-background group-[.toast]:px-2.5 group-[.toast]:py-1 group-[.toast]:text-muted-foreground group-[.toast]:font-medium group-[.toast]:text-[11px] group-[.toast]:transition-colors group-[.toast]:hover:bg-muted",
  description:
    "group-[.toast]:text-[11px] group-[.toast]:text-muted-foreground",
  toast:
    "group toast group-[.toaster]:max-w-[380px] group-[.toaster]:rounded-lg group-[.toaster]:border group-[.toaster]:border-border/70 group-[.toaster]:bg-card group-[.toaster]:p-2.5 group-[.toaster]:text-card-foreground group-[.toaster]:shadow-lg",
};

function Toaster({ className, toastOptions, ...props }: ToasterProps) {
  return (
    <Sonner
      className={cn("toaster group", className)}
      closeButton
      duration={9000}
      position="bottom-right"
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...DEFAULT_TOAST_CLASS_NAMES,
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
