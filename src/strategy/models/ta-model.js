/**
 * Technical Analysis Model
 * 
 * Uses RSI, MACD, Heiken Ashi, and VWAP to calculate model probability.
 * 
 * CRITICAL: This model compares against REAL market prices (not hardcoded 50/50).
 * Edge = Model_Probability - Market_Probability
 * Only recommends trade if edge > threshold (default 0.05)
 */

import { BaseModel } from './base-model.js';
import {
  calculateRSI,
  calculateMACD,
  calculateVWAP,
  calculateHeikenAshi,
  detectRegime,
  getHATrend,
} from '../indicators.js';

export class TAModel extends BaseModel {
  /**
   * Create a new Technical Analysis model
   * @param {Object} config - Model configuration
   */
  constructor(config = {}) {
    super({
      name: 'TA-Model',
      config: {
        edgeThreshold: 0.05,
        rsiPeriod: 14,
        rsiOverbought: 70,
        rsiOversold: 30,
        minCandles: 30, // Need enough data for MACD (26 + 9)
        ...config,
      },
    });
  }

  /**
   * Evaluate market conditions using technical indicators
   * 
   * @param {Array} candles - Array of OHLC candles
   * @param {Object} marketPrices - Current Polymarket prices { up: 0.55, down: 0.45 }
   * @param {number} remainingMinutes - Minutes until market resolution
   * @returns {Object} Evaluation result with direction, confidence, edge, shouldTrade, reason
   */
  evaluate(candles, marketPrices, remainingMinutes) {
    // Validate inputs
    if (!this.validateCandles(candles, this.config.minCandles)) {
      return this.noTrade(`Insufficient candles: need ${this.config.minCandles}, got ${candles?.length || 0}`);
    }

    if (!this.validateMarketPrices(marketPrices)) {
      return this.noTrade('Invalid market prices');
    }

    // Calculate all indicators
    const indicators = this.calculateIndicators(candles);
    
    if (!indicators.valid) {
      return this.noTrade(`Failed to calculate indicators: ${indicators.error}`);
    }

    // Calculate signal scores from each indicator
    const signals = this.calculateSignals(indicators, candles);
    
    // Determine direction and model probability based on confluence
    const { direction, modelProbability, reasons } = this.calculateModelProbability(signals, indicators);

    if (!direction) {
      return this.noTrade(`No clear signal: ${reasons.join(', ')}`);
    }

    // CRITICAL: Calculate edge against REAL market prices
    const edge = this.calculateEdge(direction, modelProbability, marketPrices);
    const marketPrice = direction === 'Up' ? marketPrices.up : marketPrices.down;
    
    // Determine if we should trade
    const shouldTrade = this.shouldMakeTrade(edge);

    // Build detailed reason
    const reasonParts = [
      `Direction: ${direction}`,
      `Model Prob: ${(modelProbability * 100).toFixed(1)}%`,
      `Market Price: ${(marketPrice * 100).toFixed(1)}%`,
      `Edge: ${(edge * 100).toFixed(1)}%`,
      ...reasons,
    ];

    if (!shouldTrade) {
      reasonParts.push(`Edge ${(edge * 100).toFixed(1)}% below threshold ${(this.config.edgeThreshold * 100).toFixed(1)}%`);
    }

    return this.createResult({
      direction,
      confidence: modelProbability,
      edge,
      shouldTrade,
      reason: reasonParts.join(' | '),
    });
  }

  /**
   * Calculate all technical indicators
   * @param {Array} candles - OHLC candles
   * @returns {Object} Indicator values or error
   */
  calculateIndicators(candles) {
    try {
      const rsi = calculateRSI(candles, this.config.rsiPeriod);
      const macd = calculateMACD(candles);
      const vwap = calculateVWAP(candles);
      const haCandles = calculateHeikenAshi(candles);
      const regime = detectRegime(candles);
      const haTrend = getHATrend(haCandles);

      const currentPrice = candles[candles.length - 1].close;

      return {
        valid: true,
        rsi,
        macd,
        vwap,
        haCandles,
        haTrend,
        regime,
        currentPrice,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Calculate individual signal scores from indicators
   * Each signal returns a score from -1 (strong bearish) to +1 (strong bullish)
   * 
   * @param {Object} indicators - Calculated indicators
   * @param {Array} candles - Original candles
   * @returns {Object} Individual signal scores
   */
  calculateSignals(indicators, candles) {
    const signals = {
      rsi: 0,
      macd: 0,
      vwap: 0,
      heikenAshi: 0,
      regime: 0,
    };

    // RSI Signal (-1 to +1)
    if (indicators.rsi !== null) {
      if (indicators.rsi <= this.config.rsiOversold) {
        // Oversold = bullish reversal expected
        signals.rsi = (this.config.rsiOversold - indicators.rsi) / this.config.rsiOversold;
      } else if (indicators.rsi >= this.config.rsiOverbought) {
        // Overbought = bearish reversal expected
        signals.rsi = -(indicators.rsi - this.config.rsiOverbought) / (100 - this.config.rsiOverbought);
      } else {
        // Neutral zone - slight bias based on position
        const midpoint = 50;
        signals.rsi = (indicators.rsi - midpoint) / 100 * 0.3; // Max 0.15 in neutral zone
      }
    }

    // MACD Signal (-1 to +1)
    if (indicators.macd) {
      const { histogram, line, signal } = indicators.macd;
      
      // Histogram direction
      if (histogram > 0) {
        signals.macd = Math.min(0.5, histogram / Math.abs(line || 1) * 0.5);
      } else {
        signals.macd = Math.max(-0.5, histogram / Math.abs(line || 1) * 0.5);
      }

      // Add signal line crossover bonus
      if (line > signal) {
        signals.macd += 0.3;
      } else if (line < signal) {
        signals.macd -= 0.3;
      }

      // Clamp to -1 to 1
      signals.macd = Math.max(-1, Math.min(1, signals.macd));
    }

    // VWAP Signal (-1 to +1)
    if (indicators.vwap && indicators.currentPrice) {
      const vwapDiff = (indicators.currentPrice - indicators.vwap) / indicators.vwap;
      // Price above VWAP = bullish, below = bearish
      signals.vwap = Math.max(-1, Math.min(1, vwapDiff * 10)); // Scale for sensitivity
    }

    // Heiken Ashi Signal (-1 to +1)
    if (indicators.haTrend) {
      const { direction, strength } = indicators.haTrend;
      if (direction === 'up') {
        signals.heikenAshi = strength;
      } else if (direction === 'down') {
        signals.heikenAshi = -strength;
      }
    }

    // Regime Signal (-1 to +1)
    switch (indicators.regime) {
      case 'TREND_UP':
        signals.regime = 0.7;
        break;
      case 'TREND_DOWN':
        signals.regime = -0.7;
        break;
      case 'RANGE':
        signals.regime = 0; // Neutral in range
        break;
      case 'CHOP':
        signals.regime = 0; // No signal in chop
        break;
    }

    return signals;
  }

  /**
   * Calculate model probability from signal confluence
   * 
   * @param {Object} signals - Individual signal scores
   * @param {Object} indicators - Calculated indicators
   * @returns {Object} { direction, modelProbability, reasons }
   */
  calculateModelProbability(signals, indicators) {
    const reasons = [];

    // Weight each signal (must sum to 1)
    const weights = {
      rsi: 0.20,
      macd: 0.25,
      vwap: 0.15,
      heikenAshi: 0.25,
      regime: 0.15,
    };

    // Calculate weighted composite score
    let compositeScore = 0;
    for (const [indicator, weight] of Object.entries(weights)) {
      const signal = signals[indicator] || 0;
      compositeScore += signal * weight;
      
      if (Math.abs(signal) >= 0.3) {
        const direction = signal > 0 ? 'bullish' : 'bearish';
        reasons.push(`${indicator}: ${direction} (${(signal * 100).toFixed(0)}%)`);
      }
    }

    // Add indicator values to reasons
    if (indicators.rsi !== null) {
      reasons.push(`RSI: ${indicators.rsi.toFixed(1)}`);
    }
    if (indicators.macd) {
      reasons.push(`MACD hist: ${indicators.macd.histogram.toFixed(5)}`);
    }
    reasons.push(`Regime: ${indicators.regime}`);

    // Require minimum confluence for a signal
    const minConfluence = 0.15; // Composite must be at least 15% in one direction
    
    if (Math.abs(compositeScore) < minConfluence) {
      reasons.push(`Confluence too weak: ${(compositeScore * 100).toFixed(1)}%`);
      return { direction: null, modelProbability: 0.5, reasons };
    }

    // Determine direction
    const direction = compositeScore > 0 ? 'Up' : 'Down';

    // Convert composite score to probability
    // compositeScore ranges from -1 to +1
    // Map to probability: 0.5 + (compositeScore * 0.4) gives range 0.1 to 0.9
    // This is conservative - even with all signals aligned, max probability is 90%
    const rawProbability = 0.5 + (Math.abs(compositeScore) * 0.4);
    
    // Apply additional conservatism for choppy markets
    let modelProbability = rawProbability;
    if (indicators.regime === 'CHOP') {
      modelProbability = 0.5 + (rawProbability - 0.5) * 0.5; // Reduce confidence by 50%
      reasons.push('Reduced confidence due to choppy regime');
    }

    // Clamp between 0.5 and 0.9 (never claim more than 90% confidence)
    modelProbability = Math.max(0.5, Math.min(0.9, modelProbability));

    return { direction, modelProbability, reasons };
  }
}
