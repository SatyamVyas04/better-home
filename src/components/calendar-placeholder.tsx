// Placeholder component for calendar widget (deprecated)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CalendarPlaceholder() {
  return (
    <Card className="flex min-h-0 flex-1 flex-col gap-0 border-border/50 py-3">
      <CardHeader className="px-4 pb-2">
        <CardTitle className="font-medium text-xs lowercase">
          mood calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 px-4">
        <div className="flex flex-1 items-center justify-center rounded-md border border-border/50 border-dashed">
          <p className="text-muted-foreground text-xs lowercase">
            coming soon...
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
