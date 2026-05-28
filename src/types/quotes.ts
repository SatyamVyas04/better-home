export type QuoteSource = "authors";

export interface QuoteHighlightMetadata {
  highlightKeywords?: string[];
}

export interface QuoteEntry extends QuoteHighlightMetadata {
  attribution: string;
  text: string;
}

export interface DefaultQuoteRecord extends QuoteHighlightMetadata {
  author: string;
  quote: string;
}

export type QuoteSourceRecord = QuoteEntry | DefaultQuoteRecord;

export interface ResolvedQuoteEntry extends QuoteEntry {
  key: string;
  source: QuoteSource;
}
