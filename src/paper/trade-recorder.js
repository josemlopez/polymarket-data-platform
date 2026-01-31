export class TradeRecorder {
  constructor({ db }) {
    if (!db) {
      throw new Error('TradeRecorder requires db');
    }
    this.db = db;
    this.insertTradeStmt = this.db.db.prepare(`
      INSERT INTO paper_trades (
        market_id,
        model_name,
        direction,
        entry_price,
        shares,
        stake,
        model_confidence,
        model_edge,
        indicators_json
      ) VALUES (
        @market_id,
        @model_name,
        @direction,
        @entry_price,
        @shares,
        @stake,
        @model_confidence,
        @model_edge,
        @indicators_json
      )
    `);

    this.getPendingTradesStmt = this.db.db.prepare(`
      SELECT *
      FROM paper_trades
      WHERE outcome IS NULL
    `);

    this.getTradesByModelStmt = this.db.db.prepare(`
      SELECT *
      FROM paper_trades
      WHERE model_name = ?
      ORDER BY created_at DESC
    `);
  }

  recordTrade(marketId, decision) {
    if (!marketId || !decision) {
      throw new Error('recordTrade requires marketId and decision');
    }

    const entryPrice = decision.entryPrice;
    const stake = decision.stake || 0;
    const shares = entryPrice > 0 ? stake / entryPrice : 0;

    let indicatorsJson = null;
    if (decision.indicators) {
      try {
        indicatorsJson = JSON.stringify(decision.indicators);
      } catch (error) {
        indicatorsJson = null;
      }
    }

    return this.insertTradeStmt.run({
      market_id: marketId,
      model_name: decision.modelName,
      direction: decision.direction,
      entry_price: entryPrice,
      shares,
      stake,
      model_confidence: decision.confidence,
      model_edge: decision.edge,
      indicators_json: indicatorsJson,
    });
  }

  getPendingTrades() {
    return this.getPendingTradesStmt.all();
  }

  getTradesByModel(modelName) {
    return this.getTradesByModelStmt.all(modelName);
  }
}
