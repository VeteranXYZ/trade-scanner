import {
  providerCapabilityProfiles,
  type ProviderCapabilityProfile,
  type ProviderEvaluationUseCase,
} from "@/lib/market-data/providerCapabilities";
import { evaluateMarketDataProviders } from "@/lib/market-data/providerEvaluation";

const validUseCases: ProviderEvaluationUseCase[] = [
  "crypto_exchange_specific_ohlcv",
  "crypto_broad_aggregated_ohlcv",
  "crypto_metadata",
  "crypto_coinbase_usdc_supplemental",
  "future_equities_ohlcv",
];

const args = process.argv.slice(2);
const useCase = parseUseCase(args);
const format = args.includes("--markdown") ? "markdown" : args.includes("--json") ? "json" : "table";
const evaluation = evaluateMarketDataProviders(useCase);

if (format === "json") {
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        liveNetworkRequests: false,
        matrix: providerCapabilityProfiles.map(toMatrixRow),
        evaluation,
      },
      null,
      2,
    ),
  );
} else if (format === "markdown") {
  console.log(toMarkdown(providerCapabilityProfiles, evaluation));
} else {
  console.table(providerCapabilityProfiles.map(toMatrixRow));
  console.log(JSON.stringify({ evaluation }, null, 2));
}

function parseUseCase(argsToParse: string[]): ProviderEvaluationUseCase {
  const explicit = argsToParse.find((arg) => arg.startsWith("--use-case="));
  const useCaseValue = explicit?.slice("--use-case=".length) ?? "crypto_coinbase_usdc_supplemental";

  if (validUseCases.includes(useCaseValue as ProviderEvaluationUseCase)) {
    return useCaseValue as ProviderEvaluationUseCase;
  }

  throw new Error(
    `Unsupported --use-case value: ${useCaseValue}. Valid values: ${validUseCases.join(", ")}`,
  );
}

function toMatrixRow(profile: ProviderCapabilityProfile) {
  return {
    provider: profile.provider,
    providerType: profile.providerType,
    freeTier: profile.freeTier,
    exchangeSpecific: profile.exchangeSpecific,
    aggregatedOnly: profile.aggregatedOnly,
    intervalsSupported: profile.intervalsSupported,
    historicalDepth: profile.historicalDepth,
    CoinbaseUSDCLikely: profile.coinbaseUsdcLikely,
    BinanceLikely: profile.binanceLikely,
    equitiesPossible: profile.equitiesPossible,
    APIKeyRequired: profile.apiKeyRequired,
    licensingRisk: profile.licensingRisk,
    implementationComplexity: profile.implementationComplexity,
    fitForVegaRank: profile.fitForVegaRank,
    notes: profile.notes,
  };
}

function toMarkdown(
  profiles: ProviderCapabilityProfile[],
  result: ReturnType<typeof evaluateMarketDataProviders>,
): string {
  const rows = profiles.map(toMatrixRow);
  const header = [
    "provider",
    "providerType",
    "freeTier",
    "exchangeSpecific",
    "aggregatedOnly",
    "CoinbaseUSDCLikely",
    "BinanceLikely",
    "equitiesPossible",
    "licensingRisk",
    "fitForVegaRank",
  ];
  const table = [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${header.map((key) => row[key as keyof typeof row]).join(" | ")} |`),
  ];

  return [
    "# Static Market Data Provider Audit",
    "",
    "No live network requests were made.",
    "",
    ...table,
    "",
    "## Best Candidates",
    "",
    ...result.bestCandidates.map(
      (candidate) =>
        `- ${candidate.provider}: score ${candidate.score}, role ${candidate.recommendedRole}`,
    ),
    "",
    "## Unknowns To Verify",
    "",
    ...result.unknownsToVerify.map(
      (unknown) => `- ${unknown.provider}: ${unknown.fields.join(", ")}`,
    ),
    "",
    `Recommended next audit: ${result.recommendedNextAudit}`,
  ].join("\n");
}
