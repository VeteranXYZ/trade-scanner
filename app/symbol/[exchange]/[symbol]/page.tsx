import { SymbolPageClient } from "@/components/symbol/SymbolPageClient";
import type { Exchange } from "@/lib/shared/timeframes";

type SymbolPageProps = {
  params: Promise<{
    exchange: Exchange;
    symbol: string;
  }>;
};

export default async function SymbolPage({ params }: SymbolPageProps) {
  const { exchange, symbol } = await params;

  return <SymbolPageClient exchange={exchange} symbol={symbol.toUpperCase()} />;
}
