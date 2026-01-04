import { IconExternalLink, IconPlus, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocalStorage } from "@/hooks/use-local-storage";

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

export function QuickLinks() {
  const [links, setLinks] = useLocalStorage<QuickLink[]>(
    "better-home-quick-links",
    []
  );
  const [newUrl, setNewUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);

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
    setIsAdding(false);
  };

  const deleteLink = (id: string) => {
    setLinks((prev) => prev.filter((link) => link.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addLink();
    } else if (e.key === "Escape") {
      setNewUrl("");
      setIsAdding(false);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="flex h-fit w-71 flex-col gap-0 border-border/50 py-2">
        <CardHeader className="px-3 pb-1">
          <CardTitle className="font-medium text-xs lowercase">
            quick links
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 px-3">
          {isAdding ? (
            <div className="flex gap-2">
              <Input
                autoFocus
                className="h-8 flex-1 border-border/50 text-xs"
                onBlur={() => {
                  if (!newUrl.trim()) {
                    setIsAdding(false);
                  }
                }}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="github.com"
                value={newUrl}
              />
              <Button
                className="h-8 w-8"
                disabled={!newUrl.trim()}
                onClick={addLink}
                size="icon"
              >
                <IconPlus className="size-4" />
                <span className="sr-only">Add</span>
              </Button>
            </div>
          ) : (
            <Button
              className="h-7 justify-start gap-2 border-border/50 text-xs lowercase"
              onClick={() => setIsAdding(true)}
              variant="outline"
            >
              <IconPlus className="size-3.5" />
              add link
            </Button>
          )}

          {links.length > 0 ? (
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
                    <p className="text-xs lowercase">{link.title}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center py-2">
              <p className="text-muted-foreground text-xs lowercase">
                no links saved
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
