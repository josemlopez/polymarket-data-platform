import { createEvaluator } from '../strategy/index.js';

const DEFAULT_CONFIG = {
  minEdge: 0.05,
  maxStake: 100,
  bankroll: 1000,
};

export class DecisionEngine {
  constructor({ config = {} } = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.evaluator = createEvaluator();
  }

  decide(candles, marketPrices, remainingMinutes) {
    if (!Array.isArray(candles) || candles.length === 0) {
      return this._noDecision('Missing candles');
    }

    if (!this._validMarketPrices(marketPrices)) {
      return this._noDecision('Invalid market prices');
    }

    this.evaluator.evaluate(candles, marketPrices, remainingMinutes);
    const recommendation = this.evaluator.getModelRecommendation();

    const indicators = {
      summary: this.evaluator.getSummary(),
      results: this.evaluator.getAllResults(),
    };

    if (!recommendation) {
      return this._noDecision('No model recommended a trade', indicators);
    }

    const direction = recommendation.direction;
    const entryPrice = direction === 'Up' ? marketPrices.up : marketPrices.down;
    const edge = recommendation.edge;
    const confidence = recommendation.confidence;
    const modelName = recommendation.model;

    const { stake, shouldTrade } = this._calculateStake(edge, entryPrice);

    return {
      shouldTrade,
      direction,
      stake,
      entryPrice: Number.isFinite(entryPrice) ? entryPrice : null,
      modelName,
      confidence,
      edge,
      indicators,
    };
  }

  _calculateStake(edge, entryPrice) {
    if (!Number.isFinite(edge) || edge < this.config.minEdge) {
      return { stake: 0, shouldTrade: false };
    }

    if (!Number.isFinite(entryPrice) || entryPrice <= 0 || entryPrice >= 1) {
      return { stake: 0, shouldTrade: false };
    }

    const odds = (1 / entryPrice) - 1;
    if (!Number.isFinite(odds) || odds <= 0) {
      return { stake: 0, shouldTrade: false };
    }

    let stake = (this.config.bankroll * edge) / odds;
    if (!Number.isFinite(stake) || stake <= 0) {
      return { stake: 0, shouldTrade: false };
    }

    stake = Math.min(stake, this.config.maxStake);
    return { stake, shouldTrade: true };
  }

  _validMarketPrices(marketPrices) {
    return marketPrices
      && typeof marketPrices.up === 'number'
      && typeof marketPrices.down === 'number'
      && marketPrices.up >= 0
      && marketPrices.up <= 1
      && marketPrices.down >= 0
      && marketPrices.down <= 1;
  }

  _noDecision(reason, indicators = {}) {
    return {
      shouldTrade: false,
      direction: null,
      stake: 0,
      entryPrice: null,
      modelName: null,
      confidence: 0,
      edge: 0,
      indicators: {
        reason,
        ...indicators,
      },
    };
  }
}
