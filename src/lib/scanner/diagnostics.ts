import type { ScanResult } from "./types";

export type ScanErrorSample = {
  symbol: string;
  message: string;
};

export type ScanFailureSummary = {
  insufficientHistory: number;
  fetchFailed: number;
  indicatorFailed: number;
  subrequestLimitExceeded: number;
  filteredLowVolume: number;
  excludedStableOrLeveraged: number;
};

export function summarizeScanFailures({
  scannedResults,
  errors,
  filteredLowVolume,
  excludedStableOrLeveraged,
}: {
  scannedResults: ScanResult[];
  errors: ScanErrorSample[];
  filteredLowVolume: number;
  excludedStableOrLeveraged: number;
}): ScanFailureSummary {
  return {
    insufficientHistory: scannedResults.filter(
      (result) => !result.dataQuality.sufficientHistory,
    ).length,
    fetchFailed: errors.filter((error) => isFetchFailure(error.message)).length,
    indicatorFailed: errors.filter(
      (error) =>
        !isFetchFailure(error.message) && !isSubrequestLimitFailure(error.message),
    ).length,
    subrequestLimitExceeded: errors.filter((error) =>
      isSubrequestLimitFailure(error.message),
    ).length,
    filteredLowVolume,
    excludedStableOrLeveraged,
  };
}

function isFetchFailure(message: string) {
  if (isSubrequestLimitFailure(message)) {
    return false;
  }

  return /binance|fetch|network|request failed|timeout|timed out|rate limit/i.test(
    message,
  );
}

function isSubrequestLimitFailure(message: string) {
  return /too many subrequests|subrequests|single worker invocation/i.test(message);
}
