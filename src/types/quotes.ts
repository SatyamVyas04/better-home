export type QuoteSource = "authors";

export interface QuoteHighlightMetadata {
  highlightKeywords?: string[];
}

export interface QuoteEntry extends QuoteHighlightMetadata {
  text: string;
  attribution: string;
}

export interface DefaultQuoteRecord extends QuoteHighlightMetadata {
  quote: string;
  author: string;
}

export type QuoteSourceRecord = QuoteEntry | DefaultQuoteRecord;

export interface ResolvedQuoteEntry extends QuoteEntry {
  key: string;
  source: QuoteSource;
}
