# Live Crypto OHLCV Provider Audit

Persistent disclaimer: VegaRank is a research-ranking system. It is not trading
advice, exchange recommendation, arbitrage software, portfolio management,
alerting software, or a trading performance dashboard.

## Purpose

Phase 32L adds a live, read-only audit tool for crypto OHLCV providers. The goal
is to verify actual candle availability before expanding Coinbase production
rollout or replacing any existing source.

The audit does not:

- change scoring
- change database schema
- add migrations
- write candles to the database
- run scanners
- change production cron
- change UI, Archive, or Watchlist behavior
- change existing Binance or Coinbase production behavior

## Why Coinbase Productionization Is Paused

The current Coinbase supplemental manual pipeline works, but coverage questions
remain:

- Coinbase `4h` manual scan: 179 total symbols, 89 scanned, 90 skipped.
- Coinbase `1d` manual scan: 179 total symbols, 139 scanned, 40 skipped.

Those gaps should be explained before Coinbase is promoted into automated
production schedules. Hand-aggregated candles can remain a fallback, but they
should not become VegaRank's main market data strategy.

## Exchange-Specific Versus Aggregated OHLCV

Exchange-specific OHLCV is tied to a concrete venue listing, such as Binance
`BTCUSDT` or Coinbase `AERO-USDC`.

Aggregated coin-level OHLCV is tied to an asset, such as `BTC`, often expressed
against `USD`. It can be useful for broad context or metadata, but it must not be
silently mixed into exchange-specific rankings.

The live audit records:

- provider id
- provider symbol used
- exchange-specific status
- aggregated-only status
- quote asset preservation
- native interval support
- fetched candle count
- first and last candle timestamps
- 200-candle readiness
- gap count when determinable
- auth/key blockage
- data-use warnings

## Providers Tested

Phase 32L includes live probes for:

- Coinbase Advanced Direct: exchange-specific Coinbase product candles. `1h`,
  `4h`, and `1d` are requested directly. `1w` is reported unsupported rather than
  derived.
- CryptoCompare: crypto historical OHLCV probe using inferred base/quote and
  exchange parameters where possible. API-key or plan blocks are reported without
  throwing.
- CoinGecko: aggregated coin-level OHLC probe. Results are labeled
  aggregated-only and are not eligible as exchange-specific primary data.
- CryptoDataDownload: safe placeholder probe. It reports
  `needs_manual_url_mapping` rather than scraping pages or guessing brittle CSV
  URLs.

Paid or key-gated providers such as CoinAPI, Kaiko, Polygon, and Tiingo can be
included in the report as `paid_or_key_required`. The audit does not add secrets
or API keys.

## How To Run

JSON output:

```bash
pnpm market-data:providers:live-audit -- --providers=coinbase_advanced_direct,coingecko --symbols=AERO-USDC,CLANKER-USDC,BNKR-USDC,BTCUSDT,ETHUSDT --timeframes=1h,4h,1d,1w --lookback-days=365 --json
```

Markdown output:

```bash
pnpm market-data:providers:live-audit -- --providers=coinbase_advanced_direct,cryptocompare,cryptodatadownload,coingecko --limit-symbols=10 --timeframes=1h,4h,1d,1w --lookback-days=365 --markdown
```

Optional environment variables:

- `COINBASE_ADVANCED_BEARER_TOKEN`
- `CRYPTOCOMPARE_API_KEY`
- `COINGECKO_API_KEY`

Do not commit secrets. If a provider requires a key and no key is available, the
audit should report `auth_required`, `paid_or_key_required`, or
`limited_test_unavailable`.

## Interpreting Results

`unsupported` means the provider does not expose the requested native interval in
this audit path. Coinbase Advanced `1w` is the expected example.

`auth_required` means the provider rejected the request due to missing or
insufficient credentials.

`paid_or_key_required` means the provider is intentionally not probed without a
commercial/API-key decision.

`aggregated_only` means the provider result is not tied to a concrete exchange
listing. It may be useful for context, but not as an exchange-specific primary
source.

`insufficient_history` means the request returned usable candles but fewer than
the 200-candle VegaRank scoring threshold.

`symbol_mapping_missing` means the script did not know how to map the requested
symbol into that provider's identifier. This is not the same as provider outage.

`needs_manual_url_mapping` means a provider probably needs explicit URL or dataset
mapping before safe automation.

## Native Versus Derived Intervals

The live audit does not hand-aggregate lower intervals into higher intervals.
Native support is reported separately from provider-aggregated or unsupported
availability. If future phases compare derived candles, the report must label
them as derived and preserve source provenance.

## References

- Coinbase Advanced Trade Get Product Candles:
  `https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/products/get-product-candles`
- CoinGecko Coin OHLC Chart by ID:
  `https://docs.coingecko.com/reference/coins-id-ohlc`
- CryptoCompare historical API:
  `https://developers.coindesk.com/documentation/legacy/Historical/dataHistohour`
- CryptoDataDownload exchange data:
  `https://www.cryptodatadownload.com/data/binance/`
