import { ServiceBase } from "../shared/service-base.js";
import { RateLimiter } from "../shared/rate-limiter.js";
import { Database } from "../shared/db.js";
import { Logger } from "../shared/logger.js";
import { DATABASE_PATH, LOG_LEVEL } from "../shared/config.js";
import { MARKETS_CONFIG } from "../shared/markets-config.js";

const POLL_INTERVAL_MS = 60_000;
const RATE_LIMIT_PER_MIN = 100;

function buildSeriesMap() {
  const map = new Map();
  for (const group of Object.values(MARKETS_CONFIG)) {
    for (const market of group.markets) {
      if (Number.isFinite(market.seriesId)) {
        map.set(market.seriesId, {
          assetName: market.name,
          category: group.category,
          timeframe: group.timeframe,
        });
      }
    }
  }
  return map;
}

function parseOutcomePrices(outcomePrices) {
  if (!outcomePrices) return null;
  if (Array.isArray(outcomePrices)) {
    return outcomePrices.map((value) => Number(value));
  }
  if (typeof outcomePrices === "string") {
    try {
      const parsed = JSON.parse(outcomePrices);
      if (Array.isArray(parsed)) {
        return parsed.map((value) => Number(value));
      }
    } catch (error) {
      return null;
    }
  }
  return null;
}

export class PolymarketCollector extends ServiceBase {
  constructor() {
    const logger = new Logger({ name: "polymarket", level: LOG_LEVEL });
    super({ name: "polymarket", logger });
    this.logger = logger;
    this.db = new Database({ databasePath: DATABASE_PATH });
    this.rateLimiter = new RateLimiter({
      maxTokens: RATE_LIMIT_PER_MIN,
      refillRate: RATE_LIMIT_PER_MIN,
    });
    this.seriesMap = buildSeriesMap();
    this.polling = false;
    this.intervalId = null;
    this.selectMarketBySlug = null;
    this.insertMarketStmt = null;
    this.insertSnapshotStmt = null;
  }

  async run() {
    await this.db.initialize();
    this.logger.db = this.db;
    this._prepareStatements();
    this._updateStatus("running");

    await this._poll();
    this.intervalId = setInterval(() => {
      if (this.stopping) return;
      this._poll();
    }, POLL_INTERVAL_MS);
  }

  async cleanup() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this._updateStatus("stopped");
    if (this.db) {
      this.db.close();
    }
  }

  _prepareStatements() {
    this.selectMarketBySlug = this.db.db.prepare(`
      SELECT id
      FROM tracked_markets
      WHERE market_slug = ?
    `);

    this.insertMarketStmt = this.db.db.prepare(`
      INSERT OR IGNORE INTO tracked_markets (
        series_id,
        market_slug,
        asset_name,
        category,
        timeframe,
        start_time,
        end_time,
        initial_up_price,
        initial_down_price,
        initial_asset_price,
        outcome,
        final_up_price,
        final_down_price,
        final_asset_price,
        resolution_time,
        volume,
        liquidity,
        updated_at
      ) VALUES (
        @series_id,
        @market_slug,
        @asset_name,
        @category,
        @timeframe,
        @start_time,
        @end_time,
        @initial_up_price,
        @initial_down_price,
        @initial_asset_price,
        @outcome,
        @final_up_price,
        @final_down_price,
        @final_asset_price,
        @resolution_time,
        @volume,
        @liquidity,
        COALESCE(@updated_at, (strftime('%s', 'now') * 1000))
      )
    `);

    this.insertSnapshotStmt = this.db.db.prepare(`
      INSERT OR IGNORE INTO market_snapshots (
        market_id,
        timestamp,
        up_price,
        down_price,
        asset_price,
        volume,
        liquidity,
        time_remaining_seconds
      ) VALUES (
        @market_id,
        @timestamp,
        @up_price,
        @down_price,
        @asset_price,
        @volume,
        @liquidity,
        @time_remaining_seconds
      )
    `);
  }

  _updateStatus(status) {
    try {
      this.db.updateCollectorStatus(this.name, status);
    } catch (error) {
      this.logger.warn("Failed to update collector status", {
        error: this._serializeError(error),
      });
    }
  }

  async _poll() {
    if (this.polling) return;
    this.polling = true;

    try {
      const now = Date.now();
      for (const seriesId of this.seriesMap.keys()) {
        if (this.stopping) break;
        await this.rateLimiter.acquire();
        const url = `https://gamma-api.polymarket.com/events?series_id=${seriesId}&active=true`;

        let response;
        try {
          response = await fetch(url);
        } catch (error) {
          this.logger.warn("Network error fetching Polymarket events", {
            seriesId,
            error: this._serializeError(error),
          });
          continue;
        }

        if (!response.ok) {
          this.logger.warn("Polymarket API error", {
            seriesId,
            status: response.status,
          });
          continue;
        }

        let payload;
        try {
          payload = await response.json();
        } catch (error) {
          this.logger.warn("Failed to parse Polymarket response", {
            seriesId,
            error: this._serializeError(error),
          });
          continue;
        }

        // API returns array directly, not { data: [...] }
        const events = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
        this.logger.info(
          `Found ${events.length} events for series ${seriesId}`,
        );
        for (const event of events) {
          if (this.stopping) break;
          try {
            const seriesMeta = this.seriesMap.get(seriesId);
            if (!seriesMeta) continue;

            const slug = event?.slug;
            const startTime = Date.parse(event?.startDate ?? "");
            const endTime = Date.parse(event?.endDate ?? "");
            if (
              !slug ||
              !Number.isFinite(startTime) ||
              !Number.isFinite(endTime)
            ) {
              continue;
            }

            const marketDetails = Array.isArray(event?.markets)
              ? event.markets[0]
              : null;
            const prices = parseOutcomePrices(marketDetails?.outcomePrices);
            const upPrice = prices?.[0];
            const downPrice = prices?.[1];
            const volumeRaw = marketDetails?.volume ?? event?.volume;
            const volume =
              volumeRaw !== undefined && volumeRaw !== null
                ? Number(volumeRaw)
                : null;

            const existing = this.selectMarketBySlug.get(slug);
            if (!existing) {
              this.insertMarketStmt.run({
                series_id: seriesId,
                market_slug: slug,
                asset_name: seriesMeta.assetName,
                category: seriesMeta.category,
                timeframe: seriesMeta.timeframe,
                start_time: startTime,
                end_time: endTime,
                initial_up_price: Number.isFinite(upPrice) ? upPrice : null,
                initial_down_price: Number.isFinite(downPrice)
                  ? downPrice
                  : null,
                initial_asset_price: null,
                outcome: null,
                final_up_price: null,
                final_down_price: null,
                final_asset_price: null,
                resolution_time: null,
                volume,
                liquidity: null,
                updated_at: null,
              });
            }

            const marketRow = existing ?? this.selectMarketBySlug.get(slug);
            if (
              !marketRow ||
              !Number.isFinite(upPrice) ||
              !Number.isFinite(downPrice)
            ) {
              continue;
            }

            const timeRemainingSeconds = Math.max(
              0,
              Math.floor((endTime - now) / 1000),
            );
            this.insertSnapshotStmt.run({
              market_id: marketRow.id,
              timestamp: now,
              up_price: upPrice,
              down_price: downPrice,
              asset_price: null,
              volume,
              liquidity: null,
              time_remaining_seconds: timeRemainingSeconds,
            });
          } catch (error) {
            this.logger.warn("Failed to process Polymarket event", {
              seriesId,
              error: this._serializeError(error),
            });
          }
        }
      }

      this._updateStatus("running");
    } catch (error) {
      this.logger.error("Polymarket poll failed", {
        error: this._serializeError(error),
      });
    } finally {
      this.polling = false;
    }
  }
}

const service = new PolymarketCollector();
service.start().catch((error) => {
  service.logger.error("Polymarket collector exited with error", {
    error: service._serializeError(error),
  });
  process.exit(1);
});
