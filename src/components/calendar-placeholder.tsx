import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CalendarPlaceholder() {
  return (
    <Card className="flex min-h-0 flex-1 flex-col gap-0 border-border/50 py-2">
      <CardHeader className="px-3 pb-1">
        <CardTitle className="font-medium text-xs lowercase">
          mood calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 px-3">
        <div className="flex flex-1 items-center justify-center rounded-md border border-border/50 border-dashed">
          <p className="text-muted-foreground text-xs lowercase">
            coming soon...
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
