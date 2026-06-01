import { SymbolResearchPageClient } from "@/components/symbol/SymbolResearchPageClient";
import type { Exchange } from "@/lib/shared/timeframes";

type SymbolPageProps = {
  params: Promise<{
    exchange: Exchange;
    symbol: string;
  }>;
};

export default async function SymbolPage({ params }: SymbolPageProps) {
  const { exchange, symbol } = await params;

  return (
    <SymbolResearchPageClient exchange={exchange} symbol={symbol.toUpperCase()} />
  );
}
