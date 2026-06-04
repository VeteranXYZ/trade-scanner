import { notFound } from "next/navigation";
import { SymbolResearchPageClient } from "@/components/symbol/SymbolResearchPageClient";
import { buildSymbolResearchVisualCheckData } from "@/components/symbol/symbolResearchPreviewData";

export default function SymbolResearchVisualCheckRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <SymbolResearchPageClient
      exchange="binance"
      symbol="BTCUSDT"
      visualCheckData={buildSymbolResearchVisualCheckData()}
    />
  );
}
