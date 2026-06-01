import type http from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleTradeApiRequest } from "./trade-api";

const getLatestScanRunMock = vi.hoisted(() => vi.fn());
const listLatestScanSignalsForRunMock = vi.hoisted(() => vi.fn());
const closeMock = vi.hoisted(() => vi.fn());
const pgScannerResultsStoreMock = vi.hoisted(() =>
  vi.fn(function PgScannerResultsStore() {
    return {
      getLatestScanRun: getLatestScanRunMock,
      listLatestScanSignalsForRun: listLatestScanSignalsForRunMock,
      close: closeMock,
    };
  }),
);

vi.mock("@/lib/storage/postgres/scannerResultsPg", () => ({
  LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS: 300,
  PgScannerResultsStore: pgScannerResultsStoreMock,
  isLikelyFullUniverseRun: ({
    run,
    assetClass,
    minExpectedSymbols = 300,
  }: {
    run: { symbolsTotal: number; symbolsScanned: number; signalsCreated: number };
    assetClass: string;
    minExpectedSymbols?: number;
  }) =>
    assetClass !== "crypto" ||
    ((run.symbolsTotal >= minExpectedSymbols ||
      run.symbolsScanned >= minExpectedSymbols) &&
      run.signalsCreated >= minExpectedSymbols),
}));

describe("trade-api CORS", () => {
  beforeEach(() => {
    getLatestScanRunMock.mockReset();
    getLatestScanRunMock.mockResolvedValue(null);
    listLatestScanSignalsForRunMock.mockReset();
    listLatestScanSignalsForRunMock.mockResolvedValue([]);
    closeMock.mockReset();
    closeMock.mockResolvedValue(undefined);
    pgScannerResultsStoreMock.mockClear();
  });

  it("allows the production scanner origin on latest-scan GET requests", async () => {
    const response = await requestTradeApi("/api/scan/latest?timeframe=4h", {
      headers: { Origin: "https://s.bitcoinmind.com" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://s.bitcoinmind.com",
    );
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET, OPTIONS",
    );
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "Content-Type",
    );
  });

  it("allows the local development origin on latest-scan GET requests", async () => {
    const response = await requestTradeApi("/api/scan/latest?timeframe=4h", {
      headers: { Origin: "http://localhost:3000" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
  });

  it("does not set Access-Control-Allow-Origin for disallowed origins", async () => {
    const response = await requestTradeApi("/api/scan/latest?timeframe=4h", {
      headers: { Origin: "https://example.com" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns preflight responses without hitting Postgres", async () => {
    const response = await requestTradeApi("/api/scan/latest?timeframe=4h", {
      method: "OPTIONS",
      headers: {
        Origin: "https://s.bitcoinmind.com",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://s.bitcoinmind.com",
    );
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET, OPTIONS",
    );
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "Content-Type",
    );
    expect(pgScannerResultsStoreMock).not.toHaveBeenCalled();
  });
});

describe("trade-api latest scan run selection", () => {
  beforeEach(() => {
    getLatestScanRunMock.mockReset();
    listLatestScanSignalsForRunMock.mockReset();
    listLatestScanSignalsForRunMock.mockResolvedValue([]);
    closeMock.mockReset();
    closeMock.mockResolvedValue(undefined);
    pgScannerResultsStoreMock.mockClear();
  });

  it("requests full-universe selection for default crypto scanner latest scans", async () => {
    getLatestScanRunMock.mockResolvedValue(
      makeRun("full-run", {
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 409,
        params: { assetClass: "crypto", allSymbols: true },
      }),
    );

    const response = await requestTradeApi(
      "/api/scan/latest?timeframe=4h&assetClass=crypto&limit=100",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.run.id).toBe("full-run");
    expect(getLatestScanRunMock).toHaveBeenCalledWith({
      timeframe: "4h",
      assetClass: "crypto",
      preferFullUniverse: true,
      minExpectedSymbols: 300,
    });
    expect(body.summary.latestRunSelection).toEqual({
      preferredFullUniverse: true,
      isLikelyFullUniverse: true,
      minExpectedSymbols: 300,
      fallbackUsed: false,
    });
  });

  it("marks fallback metadata when only a limited crypto run is returned", async () => {
    getLatestScanRunMock.mockResolvedValue(
      makeRun("limited-run", {
        symbolsTotal: 100,
        symbolsScanned: 96,
        signalsCreated: 96,
      }),
    );

    const response = await requestTradeApi(
      "/api/scan/latest?timeframe=4h&assetClass=crypto&limit=100",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.run.id).toBe("limited-run");
    expect(body.summary.latestRunSelection).toEqual({
      preferredFullUniverse: true,
      isLikelyFullUniverse: false,
      minExpectedSymbols: 300,
      fallbackUsed: true,
    });
  });

  it("does not force crypto full-universe selection for non-crypto or includeNonScanner requests", async () => {
    getLatestScanRunMock.mockResolvedValue(
      makeRun("small-stable-run", {
        symbolsTotal: 4,
        symbolsScanned: 4,
        signalsCreated: 4,
      }),
    );

    const stableResponse = await requestTradeApi(
      "/api/scan/latest?timeframe=4h&assetClass=stable&limit=100",
    );
    const stableBody = JSON.parse(stableResponse.body);

    expect(stableResponse.status).toBe(200);
    expect(getLatestScanRunMock).toHaveBeenLastCalledWith({
      timeframe: "4h",
      assetClass: "stable",
      preferFullUniverse: false,
      minExpectedSymbols: 300,
    });
    expect(stableBody.summary.latestRunSelection).toMatchObject({
      preferredFullUniverse: false,
      isLikelyFullUniverse: true,
      fallbackUsed: false,
    });

    await requestTradeApi(
      "/api/scan/latest?timeframe=4h&assetClass=crypto&includeNonScanner=true&limit=100",
    );

    expect(getLatestScanRunMock).toHaveBeenLastCalledWith({
      timeframe: "4h",
      assetClass: "crypto",
      preferFullUniverse: false,
      minExpectedSymbols: 300,
    });
  });
});

async function requestTradeApi(
  path: string,
  init: { method?: string; headers?: Record<string, string> } = {},
) {
  const { response, headers, getHeader } = createMockResponse();

  await handleTradeApiRequest(
    {
      method: init.method ?? "GET",
      url: path,
      headers: normalizeHeaders(init.headers ?? {}),
    } as http.IncomingMessage,
    response as unknown as http.ServerResponse,
  );

  return {
    status: response.statusCode,
    headers: {
      get: getHeader,
    },
    body: response.body,
    rawHeaders: headers,
  };
}

function normalizeHeaders(headers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
}

function createMockResponse() {
  const headers = new Map<string, string>();
  const response = {
    statusCode: 200,
    body: "",
    setHeader(name: string, value: number | string | string[]) {
      headers.set(name.toLowerCase(), formatHeaderValue(value));
      return this;
    },
    writeHead(
      statusCode: number,
      reasonOrHeaders?: string | http.OutgoingHttpHeaders,
      headersArg?: http.OutgoingHttpHeaders,
    ) {
      this.statusCode = statusCode;
      const nextHeaders =
        typeof reasonOrHeaders === "object" ? reasonOrHeaders : headersArg;

      if (nextHeaders) {
        for (const [name, value] of Object.entries(nextHeaders)) {
          if (value !== undefined) {
            headers.set(name.toLowerCase(), formatHeaderValue(value));
          }
        }
      }

      return this;
    },
    end(chunk?: string | Buffer) {
      if (chunk) {
        this.body += chunk.toString();
      }

      return this;
    },
  };

  return {
    response,
    headers,
    getHeader: (name: string) => headers.get(name.toLowerCase()) ?? null,
  };
}

function formatHeaderValue(value: number | string | string[]) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function makeRun(
  id: string,
  overrides: Partial<{
    symbolsTotal: number;
    symbolsScanned: number;
    signalsCreated: number;
    params: Record<string, unknown>;
  }> = {},
) {
  return {
    id,
    exchange: "binance",
    market: "spot",
    mode: "single",
    timeframe: "4h",
    universe: "all-symbols",
    status: "success",
    symbolsTotal: overrides.symbolsTotal ?? 2,
    symbolsScanned: overrides.symbolsScanned ?? 2,
    signalsCreated: overrides.signalsCreated ?? 2,
    symbolsSkipped: 0,
    failedSymbols: 0,
    params: overrides.params ?? {},
    errorMessage: null,
    startedAt: "2026-05-31T00:00:00.000Z",
    finishedAt: "2026-05-31T00:01:00.000Z",
  };
}
