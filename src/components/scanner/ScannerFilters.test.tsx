import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { ScannerFilters } from "./ScannerFilters";
import type { ScannerFiltersState } from "./ScannerPageClient";

describe("scanner timeframe filters", () => {
  it("renders medium-to-large timeframes only", () => {
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <ScannerFilters filters={makeFilters()} onChange={() => undefined} />
      </LanguageProvider>,
    );

    expect(html).toContain('value="4h"');
    expect(html).toContain('value="1d"');
    expect(html).toContain('value="1w"');
    expect(html).toContain('value="1M"');
    expect(html).not.toContain('value="1h"');
    expect(html).not.toContain(">1H<");
  });
});

function makeFilters(): ScannerFiltersState {
  return {
    mode: "single",
    source: "remote",
    timeframe: "4h",
    mtfPreset: "short",
    signal: "ALL",
    phase: "ALL",
    minOpportunityScore: 0,
    maxRiskScore: 100,
    minQuoteVolume: 0,
    maxSymbols: "ALL",
    sortBy: "rankScore",
    limit: 50,
  };
}
