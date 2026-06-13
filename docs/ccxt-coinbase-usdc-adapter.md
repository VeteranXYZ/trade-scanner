# CCXT Coinbase USDC Adapter

VegaRank uses CCXT in this phase only as a provider-layer dependency. The
Coinbase adapter lives under the market-data layer and does not change scoring,
database schema, Archive behavior, UI behavior, or production schedules.

Persistent disclaimer: Research-only. Not trading advice.

## Purpose

The Phase 32C adapter prepares VegaRank to read Coinbase spot USDC market data
through a provider-neutral interface. Coinbase remains supplemental to the
Binance-first research universe; production selection is still deferred.

This adapter is not for cross-venue comparison, price-discrepancy workflows, or
venue-routing decisions.

## Symbol Identity

The adapter keeps three identifiers distinct:

- `rawSymbol`: Coinbase product id, such as `BTC-USDC`
- `providerSymbol`: CCXT symbol, such as `BTC/USDC`
- `canonicalAssetKey`: exact uppercase base asset, such as `BTC`

The adapter uses the existing symbol identity helpers from
`src/lib/market-data/symbolIdentity.ts`. It does not duplicate canonical base or
supplemental universe deduplication policy.

## Market Filtering

The Coinbase adapter keeps only markets that are:

- spot markets
- quoted in `USDC`
- active
- complete enough to provide `id`, `symbol`, `base`, and `quote`

It rejects malformed markets, inactive markets, non-spot markets, and non-`USDC`
quote markets.

## Candle Support

Supported VegaRank timeframes:

- `1h`
- `4h`
- `1d`

CCXT OHLCV rows are mapped from:

```text
[timestamp, open, high, low, close, volume]
```

to VegaRank `Candle` rows:

- `openTime = timestamp`
- `closeTime = openTime + timeframe duration - 1`
- `open`, `high`, `low`, `close`, and `volume` as finite numbers
- `quoteVolume` omitted unless a future source provides it reliably

Rows are sorted ascending by `openTime` before returning.

## Deferred Work

The adapter intentionally does not implement:

- Coinbase `1w` aggregation; this is deferred to Phase 32D
- production-depth pagination and backfill
- production cron integration
- automatic Postgres import or backfill activation
- watchlist Coinbase support
- UI or Archive changes

For `1w`, the adapter returns a controlled unsupported error that states weekly
aggregation is deferred. It does not fetch daily candles and aggregate them in
Phase 32C.

## Testing Boundary

Unit tests use a mocked CCXT-like client. Verification does not require live
Coinbase network calls.
