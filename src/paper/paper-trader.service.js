import { ServiceBase } from '../shared/service-base.js';
import { Database } from '../shared/db.js';
import { Logger } from '../shared/logger.js';
import { DATABASE_PATH, LOG_LEVEL } from '../shared/config.js';
import { MARKETS_CONFIG } from '../shared/markets-config.js';
import { DecisionEngine } from './decision-engine.js';
import { TradeRecorder } from './trade-recorder.js';
import { ResultChecker } from './result-checker.js';

const POLL_INTERVAL_MS = 60_000;
const CANDLE_LIMIT = 200;

function buildCandleIntervalMap() {
  const map = new Map();
  for (const group of Object.values(MARKETS_CONFIG)) {
    for (const market of group.markets) {
      if (market.name) {
        map.set(market.name, group.candleInterval);
      }
    }
  }
  return map;
}

function normalizeAssetName(assetName) {
  if (!assetName) return null;
  if (/_((\d+M)|(\d+H)|DAILY)$/.test(assetName)) {
    return assetName.split('_')[0];
  }
  return assetName;
}

export class PaperTraderService extends ServiceBase {
  constructor() {
    const logger = new Logger({ name: 'paper-trader', level: LOG_LEVEL });
    super({ name: 'paper-trader', logger });
    this.logger = logger;
    this.db = new Database({ databasePath: DATABASE_PATH });
    this.decisionEngine = new DecisionEngine();
    this.tradeRecorder = null;
    this.resultChecker = null;
    this.intervalId = null;
    this.polling = false;
    this.candleIntervalMap = buildCandleIntervalMap();

    this.selectActiveMarketsStmt = null;
    this.selectLatestSnapshotStmt = null;
    this.selectCandlesStmt = null;
    this.selectMarketTradeStmt = null;
    this.selectResolvedPendingTradesStmt = null;
  }

  async run() {
    await this.db.initialize();
    this.logger.db = this.db;
    this._prepareStatements();
    this.tradeRecorder = new TradeRecorder({ db: this.db });
    this.resultChecker = new ResultChecker({ db: this.db });
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
    this.selectActiveMarketsStmt = this.db.db.prepare(`
      SELECT *
      FROM tracked_markets
      WHERE outcome IS NULL
      ORDER BY end_time ASC
    `);

    this.selectLatestSnapshotStmt = this.db.db.prepare(`
      SELECT up_price, down_price, time_remaining_seconds, timestamp
      FROM market_snapshots
      WHERE market_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    this.selectCandlesStmt = this.db.db.prepare(`
      SELECT timestamp, open, high, low, close, volume
      FROM asset_candles
      WHERE asset_name = ?
        AND interval = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    this.selectMarketTradeStmt = this.db.db.prepare(`
      SELECT id
      FROM paper_trades
      WHERE market_id = ?
      LIMIT 1
    `);

    this.selectResolvedPendingTradesStmt = this.db.db.prepare(`
      SELECT pt.*, tm.outcome AS market_outcome
      FROM paper_trades pt
      JOIN tracked_markets tm ON tm.id = pt.market_id
      WHERE pt.outcome IS NULL
        AND tm.outcome IS NOT NULL
    `);
  }

  _updateStatus(status) {
    try {
      this.db.updateCollectorStatus(this.name, status);
    } catch (error) {
      this.logger.warn('Failed to update paper trader status', {
        error: this._serializeError(error),
      });
    }
  }

  async _poll() {
    if (this.polling) return;
    this.polling = true;

    try {
      const markets = this.selectActiveMarketsStmt.all();

      for (const market of markets) {
        if (this.stopping) break;

        const candleInterval = this.candleIntervalMap.get(market.asset_name);
        if (!candleInterval) {
          this.logger.debug('Missing candle interval for market', {
            marketId: market.id,
            assetName: market.asset_name,
          });
          continue;
        }

        const assetName = normalizeAssetName(market.asset_name);
        const candles = this._getCandles(assetName, candleInterval);
        if (!candles || candles.length === 0) {
          this.logger.debug('Missing candles for market', {
            marketId: market.id,
            assetName,
            candleInterval,
          });
          continue;
        }

        const snapshot = this.selectLatestSnapshotStmt.get(market.id);
        const marketPrices = this._getMarketPrices(market, snapshot);
        if (!marketPrices) {
          this.logger.debug('Missing market prices for market', {
            marketId: market.id,
            assetName: market.asset_name,
          });
          continue;
        }

        const remainingMinutes = this._getRemainingMinutes(market, snapshot);
        const decision = this.decisionEngine.decide(
          candles,
          marketPrices,
          remainingMinutes,
        );

        this.logger.debug('Decision evaluated', {
          marketId: market.id,
          marketSlug: market.market_slug,
          assetName: market.asset_name,
          decision,
        });

        if (!decision.shouldTrade) {
          continue;
        }

        const existingTrade = this.selectMarketTradeStmt.get(market.id);
        if (existingTrade) {
          this.logger.info('Skipping trade, already traded market', {
            marketId: market.id,
            marketSlug: market.market_slug,
          });
          continue;
        }

        this.tradeRecorder.recordTrade(market.id, decision);
        this.logger.info('Recorded paper trade', {
          marketId: market.id,
          marketSlug: market.market_slug,
          modelName: decision.modelName,
          direction: decision.direction,
          stake: decision.stake,
          entryPrice: decision.entryPrice,
          edge: decision.edge,
        });
      }

      this._updateResolvedTrades();
    } catch (error) {
      this.logger.error('Paper trader poll failed', {
        error: this._serializeError(error),
      });
    } finally {
      this.polling = false;
    }
  }

  _getCandles(assetName, candleInterval) {
    if (!assetName) return null;
    const rows = this.selectCandlesStmt.all(assetName, candleInterval, CANDLE_LIMIT);
    return rows.reverse();
  }

  _getMarketPrices(market, snapshot) {
    let upPrice = snapshot?.up_price;
    let downPrice = snapshot?.down_price;

    if (!Number.isFinite(upPrice)) {
      upPrice = market.initial_up_price;
    }
    if (!Number.isFinite(downPrice)) {
      downPrice = market.initial_down_price;
    }

    if (Number.isFinite(upPrice) && !Number.isFinite(downPrice)) {
      downPrice = 1 - upPrice;
    }

    if (Number.isFinite(downPrice) && !Number.isFinite(upPrice)) {
      upPrice = 1 - downPrice;
    }

    if (!Number.isFinite(upPrice) || !Number.isFinite(downPrice)) {
      return null;
    }

    return { up: upPrice, down: downPrice };
  }

  _getRemainingMinutes(market, snapshot) {
    if (snapshot && Number.isFinite(snapshot.time_remaining_seconds)) {
      return Math.max(0, Math.ceil(snapshot.time_remaining_seconds / 60));
    }
    const now = Date.now();
    if (!Number.isFinite(market.end_time)) {
      return null;
    }
    return Math.max(0, Math.ceil((market.end_time - now) / 60000));
  }

  _updateResolvedTrades() {
    const resolvedTrades = this.selectResolvedPendingTradesStmt.all();
    for (const trade of resolvedTrades) {
      if (this.stopping) break;
      this.resultChecker.checkAndUpdate(trade, trade.market_outcome);
      this.logger.info('Updated paper trade result', {
        tradeId: trade.id,
        marketId: trade.market_id,
        outcome: trade.market_outcome,
      });
    }
  }
}

const service = new PaperTraderService();
service.start().catch((error) => {
  service.logger.error('Paper trader exited with error', {
    error: service._serializeError(error),
  });
});
