export function publicErrorMessage(fallback: string) {
  return fallback;
}

export function publicScanErrorMessage(message: string) {
  if (/too many subrequests|subrequests|single worker invocation/i.test(message)) {
    return "Cloudflare Free subrequest limit reached. Try a smaller batch size.";
  }

  if (/binance|fetch|network|request failed|timeout|timed out|rate limit/i.test(message)) {
    return "Remote market data request failed.";
  }

  return "Scanner calculation failed for this symbol.";
}
