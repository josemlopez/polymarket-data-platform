/**
 * Abstract Base Model for Trading Strategy Evaluation
 * 
 * All models must extend this class and implement the evaluate() method.
 * 
 * CRITICAL: Edge calculation is against REAL market prices, not hardcoded values.
 * Edge = Model_Probability - Market_Probability
 */
export class BaseModel {
  /**
   * Create a new model instance
   * @param {Object} options - Model configuration
   * @param {string} options.name - Model name for identification
   * @param {Object} options.config - Model-specific configuration
   */
  constructor({ name, config = {} }) {
    if (new.target === BaseModel) {
      throw new Error('BaseModel is abstract and cannot be instantiated directly');
    }

    if (!name) {
      throw new Error('Model requires a name');
    }

    this.name = name;
    this.config = {
      edgeThreshold: 0.05, // Minimum edge required to recommend a trade
      ...config,
    };
  }

  /**
   * Evaluate market conditions and return trading recommendation
   * 
   * @param {Array} candles - Array of OHLC candles
   * @param {Object} marketPrices - Current Polymarket prices { up: 0.55, down: 0.45 }
   * @param {number} remainingMinutes - Minutes until market resolution
   * @returns {Object} Evaluation result:
   *   - direction: 'Up' | 'Down' | null (null = no trade)
   *   - confidence: 0-1 (model's probability for the direction)
   *   - edge: number (can be negative, = confidence - market_price)
   *   - shouldTrade: boolean (true if edge > threshold)
   *   - reason: string (explanation of the decision)
   */
  evaluate(candles, marketPrices, remainingMinutes) {
    throw new Error('evaluate() must be implemented by subclass');
  }

  /**
   * Calculate edge for a given direction
   * CRITICAL: Edge is calculated against REAL market prices
   * 
   * @param {string} direction - 'Up' or 'Down'
   * @param {number} modelProbability - Model's probability (0-1)
   * @param {Object} marketPrices - { up: number, down: number }
   * @returns {number} Edge value (can be negative)
   */
  calculateEdge(direction, modelProbability, marketPrices) {
    if (!marketPrices || typeof marketPrices.up !== 'number' || typeof marketPrices.down !== 'number') {
      throw new Error('Invalid market prices: must have up and down values');
    }

    const marketPrice = direction === 'Up' ? marketPrices.up : marketPrices.down;
    
    // Edge = What we think the probability is - What the market thinks
    return modelProbability - marketPrice;
  }

  /**
   * Determine if a trade should be made based on edge threshold
   * @param {number} edge - Calculated edge
   * @returns {boolean} True if edge exceeds threshold
   */
  shouldMakeTrade(edge) {
    return edge > this.config.edgeThreshold;
  }

  /**
   * Create a standard evaluation result
   * @param {Object} params - Result parameters
   * @returns {Object} Formatted evaluation result
   */
  createResult({ direction, confidence, edge, shouldTrade, reason }) {
    return {
      model: this.name,
      direction: direction || null,
      confidence: confidence !== undefined ? Math.round(confidence * 1000) / 1000 : 0,
      edge: edge !== undefined ? Math.round(edge * 1000) / 1000 : 0,
      shouldTrade: Boolean(shouldTrade),
      reason: reason || 'No reason provided',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a "no trade" result with reason
   * @param {string} reason - Why no trade is recommended
   * @returns {Object} No-trade evaluation result
   */
  noTrade(reason) {
    return this.createResult({
      direction: null,
      confidence: 0,
      edge: 0,
      shouldTrade: false,
      reason,
    });
  }

  /**
   * Validate candles array
   * @param {Array} candles - Array to validate
   * @param {number} minRequired - Minimum candles required
   * @returns {boolean} True if valid
   */
  validateCandles(candles, minRequired = 1) {
    if (!Array.isArray(candles)) {
      return false;
    }
    if (candles.length < minRequired) {
      return false;
    }
    // Check first candle has required properties
    const first = candles[0];
    return first && typeof first.close === 'number';
  }

  /**
   * Validate market prices object
   * @param {Object} marketPrices - Prices to validate
   * @returns {boolean} True if valid
   */
  validateMarketPrices(marketPrices) {
    if (!marketPrices || typeof marketPrices !== 'object') {
      return false;
    }
    if (typeof marketPrices.up !== 'number' || typeof marketPrices.down !== 'number') {
      return false;
    }
    if (marketPrices.up < 0 || marketPrices.up > 1 || marketPrices.down < 0 || marketPrices.down > 1) {
      return false;
    }
    return true;
  }
}
