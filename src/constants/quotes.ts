import { quotesDefault } from "@/constants/quotes-default";
import type { QuoteSourceRecord } from "@/types/quotes";

export const QUOTE_POOLS: Record<"authors", QuoteSourceRecord[]> = {
  authors: quotesDefault,
};
