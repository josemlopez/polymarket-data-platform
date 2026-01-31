/**
 * Baseline Model
 * 
 * A simple model that always agrees with the market price.
 * Returns edge = 0 (no edge over market).
 * 
 * Purpose:
 * - Verify that our TA model actually provides positive edge
 * - Baseline for backtesting comparison
 * - Should never recommend a trade (edge is always 0)
 */

import { BaseModel } from './base-model.js';

export class BaselineModel extends BaseModel {
  /**
   * Create a new Baseline model
   * @param {Object} config - Model configuration
   */
  constructor(config = {}) {
    super({
      name: 'Baseline-Model',
      config: {
        edgeThreshold: 0.05,
        ...config,
      },
    });
  }

  /**
   * Evaluate by simply returning the market price as confidence
   * This gives edge = 0, proving no advantage over market
   * 
   * @param {Array} candles - Array of OHLC candles (not used)
   * @param {Object} marketPrices - Current Polymarket prices { up: 0.55, down: 0.45 }
   * @param {number} remainingMinutes - Minutes until market resolution (not used)
   * @returns {Object} Evaluation result with edge = 0
   */
  evaluate(candles, marketPrices, remainingMinutes) {
    // Validate market prices
    if (!this.validateMarketPrices(marketPrices)) {
      return this.noTrade('Invalid market prices');
    }

    // Simply pick the direction with higher market probability
    const direction = marketPrices.up >= marketPrices.down ? 'Up' : 'Down';
    const marketPrice = direction === 'Up' ? marketPrices.up : marketPrices.down;

    // Model confidence = market price (we agree with the market)
    const modelProbability = marketPrice;

    // Edge is always 0 (we agree with market)
    const edge = this.calculateEdge(direction, modelProbability, marketPrices);

    // Should never trade (edge = 0 < threshold)
    const shouldTrade = this.shouldMakeTrade(edge);

    return this.createResult({
      direction,
      confidence: modelProbability,
      edge,
      shouldTrade,
      reason: `Baseline: agrees with market at ${(marketPrice * 100).toFixed(1)}% (edge = 0)`,
    });
  }
}

/**
 * Random Model
 * 
 * A model that randomly predicts direction.
 * Useful for sanity-checking that random predictions don't beat the market.
 */
export class RandomModel extends BaseModel {
  /**
   * Create a new Random model
   * @param {Object} config - Model configuration
   */
  constructor(config = {}) {
    super({
      name: 'Random-Model',
      config: {
        edgeThreshold: 0.05,
        ...config,
      },
    });
  }

  /**
   * Evaluate with random direction and confidence
   * 
   * @param {Array} candles - Array of OHLC candles (not used)
   * @param {Object} marketPrices - Current Polymarket prices { up: 0.55, down: 0.45 }
   * @param {number} remainingMinutes - Minutes until market resolution (not used)
   * @returns {Object} Evaluation result with random values
   */
  evaluate(candles, marketPrices, remainingMinutes) {
    // Validate market prices
    if (!this.validateMarketPrices(marketPrices)) {
      return this.noTrade('Invalid market prices');
    }

    // Random direction
    const direction = Math.random() > 0.5 ? 'Up' : 'Down';
    const marketPrice = direction === 'Up' ? marketPrices.up : marketPrices.down;

    // Random confidence between 0.5 and 0.9
    const modelProbability = 0.5 + Math.random() * 0.4;

    // Calculate edge against real market price
    const edge = this.calculateEdge(direction, modelProbability, marketPrices);

    // Determine if would trade (for tracking, but not recommended)
    const shouldTrade = this.shouldMakeTrade(edge);

    return this.createResult({
      direction,
      confidence: modelProbability,
      edge,
      shouldTrade: false, // Never actually recommend random trades
      reason: `Random: ${direction} at ${(modelProbability * 100).toFixed(1)}% vs market ${(marketPrice * 100).toFixed(1)}%`,
    });
  }
}
