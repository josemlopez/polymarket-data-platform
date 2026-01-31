import { ServiceBase } from '../shared/service-base.js';
import { RateLimiter } from '../shared/rate-limiter.js';
import { Database } from '../shared/db.js';
import { Logger } from '../shared/logger.js';
import { DATABASE_PATH, LOG_LEVEL } from '../shared/config.js';
import { getMarketsForDataSource } from '../shared/markets-config.js';

const POLL_INTERVAL_MS = 60_000;
const RATE_LIMIT_PER_MIN = 1200;

function symbolToAsset(symbol) {
  if (symbol.endsWith('USDT')) return symbol.slice(0, -4);
  if (symbol.endsWith('USD')) return symbol.slice(0, -3);
  return symbol;
}

export class BinanceCollector extends ServiceBase {
  constructor() {
    const logger = new Logger({ name: 'binance', level: LOG_LEVEL });
    super({ name: 'binance', logger });
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
      const markets = getMarketsForDataSource('binance');
      const symbols = Array.from(
        new Set(markets.map((market) => market.symbol).filter(Boolean)),
      );

      for (const symbol of symbols) {
        if (this.stopping) break;
        await this.rateLimiter.acquire();
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=100`;

        let response;
        try {
          response = await fetch(url);
        } catch (error) {
          this.logger.warn('Network error fetching Binance klines', {
            symbol,
            error: this._serializeError(error),
          });
          continue;
        }

        if (!response.ok) {
          this.logger.warn('Binance API error', {
            symbol,
            status: response.status,
          });
          continue;
        }

        let payload;
        try {
          payload = await response.json();
        } catch (error) {
          this.logger.warn('Failed to parse Binance response', {
            symbol,
            error: this._serializeError(error),
          });
          continue;
        }

        if (!Array.isArray(payload)) {
          continue;
        }

        const assetName = symbolToAsset(symbol);
        for (const candle of payload) {
          if (!Array.isArray(candle) || candle.length < 6) continue;
          try {
            const timestamp = Number(candle[0]);
            const open = Number(candle[1]);
            const high = Number(candle[2]);
            const low = Number(candle[3]);
            const close = Number(candle[4]);
            const volume = Number(candle[5]);

            if (!Number.isFinite(timestamp)) continue;
            if (![open, high, low, close].every(Number.isFinite)) continue;

            this.insertCandleStmt.run({
              asset_name: assetName,
              data_source: 'binance',
              interval: '1m',
              timestamp,
              open,
              high,
              low,
              close,
              volume: Number.isFinite(volume) ? volume : null,
            });
          } catch (error) {
            this.logger.warn('Failed to insert Binance candle', {
              symbol,
              error: this._serializeError(error),
            });
          }
        }
      }

      this._updateStatus('running');
    } catch (error) {
      this.logger.error('Binance poll failed', {
        error: this._serializeError(error),
      });
    } finally {
      this.polling = false;
    }
  }
}

const service = new BinanceCollector();
service.start().catch((error) => {
  service.logger.error('Binance collector exited with error', {
    error: service._serializeError(error),
  });
  process.exit(1);
});
