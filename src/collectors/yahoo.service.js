import { ServiceBase } from '../shared/service-base.js';
import { RateLimiter } from '../shared/rate-limiter.js';
import { Database } from '../shared/db.js';
import { Logger } from '../shared/logger.js';
import { DATABASE_PATH, LOG_LEVEL } from '../shared/config.js';
import { getMarketsForDataSource } from '../shared/markets-config.js';

const POLL_INTERVAL_MS = 300_000;
const RATE_LIMIT_PER_MIN = 100;

export class YahooCollector extends ServiceBase {
  constructor() {
    const logger = new Logger({ name: 'yahoo', level: LOG_LEVEL });
    super({ name: 'yahoo', logger });
    this.logger = logger;
    this.db = new Database({ databasePath: DATABASE_PATH });
    this.rateLimiter = new RateLimiter({
      maxTokens: RATE_LIMIT_PER_MIN,
      refillRate: RATE_LIMIT_PER_MIN,
    });
    this.polling = false;
    this.intervalId = null;
    this.insertCandleStmt = null;
  }

  async run() {
    await this.db.initialize();
    this.logger.db = this.db;
    this._prepareStatements();
    this._updateStatus('running');

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
    this._updateStatus('stopped');
    if (this.db) {
      this.db.close();
    }
  }

  _prepareStatements() {
    this.insertCandleStmt = this.db.db.prepare(`
      INSERT OR IGNORE INTO asset_candles (
        asset_name,
        data_source,
        interval,
        timestamp,
        open,
        high,
        low,
        close,
        volume
      ) VALUES (
        @asset_name,
        @data_source,
        @interval,
        @timestamp,
        @open,
        @high,
        @low,
        @close,
        @volume
      )
    `);
  }

  _updateStatus(status) {
    try {
      this.db.updateCollectorStatus(this.name, status);
    } catch (error) {
      this.logger.warn('Failed to update collector status', {
        error: this._serializeError(error),
      });
    }
  }

  async _poll() {
    if (this.polling) return;
    this.polling = true;

    try {
      const markets = getMarketsForDataSource('yahoo');
      for (const market of markets) {
        if (this.stopping) break;
        if (!market.symbol) continue;

        await this.rateLimiter.acquire();
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${market.symbol}?interval=1d&range=5d`;

        let response;
        try {
          response = await fetch(url);
        } catch (error) {
          this.logger.warn('Network error fetching Yahoo chart', {
            symbol: market.symbol,
            error: this._serializeError(error),
          });
          continue;
        }

        if (!response.ok) {
          this.logger.warn('Yahoo API error', {
            symbol: market.symbol,
            status: response.status,
          });
          continue;
        }

        let payload;
        try {
          payload = await response.json();
        } catch (error) {
          this.logger.warn('Failed to parse Yahoo response', {
            symbol: market.symbol,
            error: this._serializeError(error),
          });
          continue;
        }

        const result = payload?.chart?.result?.[0];
        const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
        const quote = result?.indicators?.quote?.[0] ?? {};
        const opens = Array.isArray(quote.open) ? quote.open : [];
        const highs = Array.isArray(quote.high) ? quote.high : [];
        const lows = Array.isArray(quote.low) ? quote.low : [];
        const closes = Array.isArray(quote.close) ? quote.close : [];
        const volumes = Array.isArray(quote.volume) ? quote.volume : [];

        for (let i = 0; i < timestamps.length; i += 1) {
          try {
            const tsSeconds = Number(timestamps[i]);
            const open = Number(opens[i]);
            const high = Number(highs[i]);
            const low = Number(lows[i]);
            const close = Number(closes[i]);
            const volume = Number(volumes[i]);

            if (!Number.isFinite(tsSeconds)) continue;
            if (![open, high, low, close].every(Number.isFinite)) continue;

            this.insertCandleStmt.run({
              asset_name: market.name,
              data_source: 'yahoo',
              interval: '1d',
              timestamp: tsSeconds * 1000,
              open,
              high,
              low,
              close,
              volume: Number.isFinite(volume) ? volume : null,
            });
          } catch (error) {
            this.logger.warn('Failed to insert Yahoo candle', {
              symbol: market.symbol,
              error: this._serializeError(error),
            });
          }
        }
      }

      this._updateStatus('running');
    } catch (error) {
      this.logger.error('Yahoo poll failed', {
        error: this._serializeError(error),
      });
    } finally {
      this.polling = false;
    }
  }
}

const service = new YahooCollector();
service.start().catch((error) => {
  service.logger.error('Yahoo collector exited with error', {
    error: service._serializeError(error),
  });
  process.exit(1);
});
