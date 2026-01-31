/**
 * Strategy Evaluator
 * 
 * Runs multiple trading models and aggregates their results.
 * Provides methods to get the best recommendation across all models.
 */

import { TAModel } from './models/ta-model.js';
import { BaselineModel, RandomModel } from './models/baseline-model.js';

export class StrategyEvaluator {
  /**
   * Create a new Strategy Evaluator
   * @param {Object} options - Evaluator configuration
   * @param {Array} options.models - Array of model instances (defaults to standard set)
   * @param {Object} options.db - Database connection for logging (optional)
   * @param {Object} options.logger - Logger instance (optional)
   */
  constructor({ models = null, db = null, logger = null } = {}) {
    this.db = db;
    this.logger = logger;

    // Use provided models or create default set
    this.models = models || [
      new TAModel(),
      new BaselineModel(),
    ];

    // Cache for last evaluation results
    this.lastResults = null;
    this.lastEvaluationTime = null;
  }

  /**
   * Evaluate all models with current market conditions
   * 
   * @param {Array} candles - Array of OHLC candles
   * @param {Object} marketPrices - Current Polymarket prices { up: 0.55, down: 0.45 }
   * @param {number} remainingMinutes - Minutes until market resolution
   * @returns {Object} Evaluation results from all models
   */
  evaluate(candles, marketPrices, remainingMinutes) {
    const startTime = Date.now();
    const results = [];

    for (const model of this.models) {
      try {
        const result = model.evaluate(candles, marketPrices, remainingMinutes);
        results.push(result);
      } catch (error) {
        this._log('error', `Model ${model.name} failed`, { error: error.message });
        results.push({
          model: model.name,
          direction: null,
          confidence: 0,
          edge: 0,
          shouldTrade: false,
          reason: `Error: ${error.message}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const evaluationTime = Date.now() - startTime;

    this.lastResults = {
      results,
      marketPrices,
      remainingMinutes,
      candleCount: candles?.length || 0,
      evaluationTimeMs: evaluationTime,
      timestamp: new Date().toISOString(),
    };
    this.lastEvaluationTime = new Date();

    this._log('debug', 'Evaluation complete', {
      modelCount: results.length,
      evaluationTimeMs: evaluationTime,
    });

    return this.lastResults;
  }

  /**
   * Get the best model recommendation
   * Returns the model with highest positive edge that recommends trading
   * 
   * @returns {Object|null} Best recommendation or null if no trades recommended
   */
  getModelRecommendation() {
    if (!this.lastResults || !this.lastResults.results) {
      return null;
    }

    // Filter to only models that recommend trading
    const tradingModels = this.lastResults.results.filter(r => r.shouldTrade);

    if (tradingModels.length === 0) {
      return null;
    }

    // Sort by edge descending, return highest
    tradingModels.sort((a, b) => b.edge - a.edge);
    
    return tradingModels[0];
  }

  /**
   * Get all results from the last evaluation
   * @returns {Array} Array of model results
   */
  getAllResults() {
    return this.lastResults?.results || [];
  }

  /**
   * Get results summary for logging/display
   * @returns {Object} Summary of evaluation results
   */
  getSummary() {
    if (!this.lastResults) {
      return { evaluated: false, message: 'No evaluation performed yet' };
    }

    const { results, marketPrices, remainingMinutes, candleCount } = this.lastResults;
    const recommendation = this.getModelRecommendation();

    const modelSummaries = results.map(r => ({
      model: r.model,
      direction: r.direction,
      confidence: `${(r.confidence * 100).toFixed(1)}%`,
      edge: `${(r.edge * 100).toFixed(1)}%`,
      shouldTrade: r.shouldTrade,
    }));

    return {
      evaluated: true,
      timestamp: this.lastResults.timestamp,
      marketPrices: {
        up: `${(marketPrices.up * 100).toFixed(1)}%`,
        down: `${(marketPrices.down * 100).toFixed(1)}%`,
      },
      remainingMinutes,
      candleCount,
      models: modelSummaries,
      recommendation: recommendation ? {
        model: recommendation.model,
        direction: recommendation.direction,
        edge: `${(recommendation.edge * 100).toFixed(1)}%`,
        reason: recommendation.reason,
      } : null,
    };
  }

  /**
   * Compare model performance (for backtesting)
   * @param {Object} actualOutcome - { direction: 'Up' | 'Down' }
   * @returns {Object} Performance metrics for each model
   */
  compareModels(actualOutcome) {
    if (!this.lastResults || !actualOutcome) {
      return null;
    }

    const comparison = this.lastResults.results.map(result => {
      const correct = result.direction === actualOutcome.direction;
      const tradedCorrectly = result.shouldTrade && correct;
      const tradedIncorrectly = result.shouldTrade && !correct;
      const correctlyAvoided = !result.shouldTrade && !correct;

      return {
        model: result.model,
        predicted: result.direction,
        actual: actualOutcome.direction,
        correct,
        shouldTrade: result.shouldTrade,
        edge: result.edge,
        tradedCorrectly,
        tradedIncorrectly,
        correctlyAvoided,
      };
    });

    return comparison;
  }

  /**
   * Add a model to the evaluator
   * @param {BaseModel} model - Model instance to add
   */
  addModel(model) {
    if (!model || typeof model.evaluate !== 'function') {
      throw new Error('Invalid model: must have evaluate method');
    }
    this.models.push(model);
  }

  /**
   * Remove a model by name
   * @param {string} name - Model name to remove
   * @returns {boolean} True if model was removed
   */
  removeModel(name) {
    const initialLength = this.models.length;
    this.models = this.models.filter(m => m.name !== name);
    return this.models.length < initialLength;
  }

  /**
   * Get model by name
   * @param {string} name - Model name
   * @returns {BaseModel|null} Model instance or null
   */
  getModel(name) {
    return this.models.find(m => m.name === name) || null;
  }

  /**
   * Internal logging helper
   */
  _log(level, message, details) {
    if (!this.logger) return;
    const method = this.logger[level] || this.logger.info;
    method.call(this.logger, message, details);
  }
}

/**
 * Factory function to create a standard evaluator with all models
 * @param {Object} options - Configuration options
 * @returns {StrategyEvaluator} Configured evaluator instance
 */
export function createEvaluator(options = {}) {
  const models = [
    new TAModel(options.taConfig),
    new BaselineModel(options.baselineConfig),
  ];

  if (options.includeRandom) {
    models.push(new RandomModel());
  }

  return new StrategyEvaluator({
    models,
    db: options.db,
    logger: options.logger,
  });
}
