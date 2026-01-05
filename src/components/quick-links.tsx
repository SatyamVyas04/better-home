import {
  IconExternalLink,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocalStorage } from "@/hooks/use-local-storage";

interface QuickLinksProps {
  expanded?: boolean;
  fullSize?: boolean;
}

interface QuickLink {
  id: string;
  title: string;
  url: string;
  favicon: string;
}

const HTTPS_REGEX = /^https?:\/\//i;
const WWW_REGEX = /^www\./;

function getFaviconUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
  } catch {
    return "";
  }
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  if (!HTTPS_REGEX.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function extractTitle(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(WWW_REGEX, "");
    return hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function QuickLinks({
  expanded = false,
  fullSize = false,
}: QuickLinksProps) {
  const [links, setLinks] = useLocalStorage<QuickLink[]>(
    "better-home-quick-links",
    []
  );
  const [newUrl, setNewUrl] = useState("");

  const addLink = () => {
    const normalizedUrl = normalizeUrl(newUrl);
    if (!normalizedUrl) {
      return;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      return;
    }

    const link: QuickLink = {
      id: crypto.randomUUID(),
      title: extractTitle(normalizedUrl),
      url: normalizedUrl,
      favicon: getFaviconUrl(normalizedUrl),
    };

    setLinks((prev) => [...prev, link]);
    setNewUrl("");
  };

  const deleteLink = (id: string) => {
    setLinks((prev) => prev.filter((link) => link.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addLink();
    }
  };

  const renderLinks = () => {
    if (links.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center py-2">
          <p className="text-muted-foreground text-xs lowercase">
            no links saved
          </p>
        </div>
      );
    }

    if (expanded) {
      return (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-0.5 pr-0">
            {links.map((link) => (
              <a
                className="group flex items-center gap-2 rounded-md border border-border/50 px-1.5 py-1 transition-colors hover:bg-accent/30"
                href={link.url}
                key={link.id}
                rel="noopener noreferrer"
                target="_blank"
              >
                {link.favicon ? (
                  <img
                    alt={link.title}
                    className="size-4 shrink-0"
                    height={16}
                    loading="lazy"
                    src={link.favicon}
                    width={16}
                  />
                ) : (
                  <IconExternalLink className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 truncate text-xs">{link.title}</span>
                <Button
                  className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteLink(link.id);
                  }}
                  size="icon-sm"
                  variant="ghost"
                >
                  <IconTrash className="size-3.5 text-destructive" />
                  <span className="sr-only">Delete {link.title}</span>
                </Button>
              </a>
            ))}
          </div>
        </ScrollArea>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-1.5">
        {links.map((link) => (
          <Tooltip key={link.id}>
            <TooltipTrigger asChild>
              <div className="group relative">
                <a
                  className="flex size-8 items-center justify-center rounded-md border border-border/50 bg-background transition-all hover:border-border hover:bg-accent/30"
                  href={link.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {link.favicon ? (
                    <img
                      alt={link.title}
                      className="size-4"
                      height={16}
                      loading="lazy"
                      src={link.favicon}
                      width={16}
                    />
                  ) : (
                    <IconExternalLink className="size-4 text-muted-foreground" />
                  )}
                </a>
                <button
                  className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity hover:bg-destructive/90 group-hover:opacity-100"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteLink(link.id);
                  }}
                  type="button"
                >
                  <IconX className="size-2" />
                  <span className="sr-only">Delete {link.title}</span>
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-[10px] lowercase">{link.title}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    );
  };

  const getCardClasses = () => {
    if (fullSize) {
      return "flex min-h-0 w-full flex-1 flex-col gap-0 border-border/50 py-2";
    }
    if (expanded) {
      return "flex min-h-0 w-full flex-1 flex-col gap-0 border-border/50 py-2 lg:w-71";
    }
    return "flex h-fit max-h-40 w-full flex-col gap-0 border-border/50 py-2 lg:max-h-none lg:w-71";
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Card className={getCardClasses()}>
        <CardHeader className="px-3 pb-1">
          <CardTitle className="font-medium text-xs lowercase">
            quick links
          </CardTitle>
        </CardHeader>
        <CardContent
          className={`flex flex-col gap-1.5 px-3 ${expanded || fullSize ? "min-h-0 flex-1" : ""}`}
        >
          <div className="flex gap-1">
            <Input
              className="h-8 flex-1 border-border/50 text-xs lowercase"
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="add a link..."
              value={newUrl}
            />
            <Button
              className="h-8 w-8"
              disabled={!newUrl.trim()}
              onClick={addLink}
              size="icon"
            >
              <IconPlus className="size-4" />
              <span className="sr-only">Add link</span>
            </Button>
          </div>

          {renderLinks()}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
