/**
 * Strategy Engine Module
 * 
 * Provides trading models and evaluation for Polymarket predictions.
 * 
 * CRITICAL INSIGHT:
 * The market price IS the probability. If Polymarket shows Up at 0.55,
 * that means the market thinks there's 55% chance of Up.
 * 
 * Our model must BEAT this probability:
 * Edge = Model_Probability - Market_Probability
 * Only trade when Edge > threshold (e.g., 0.05)
 */

// Indicators
export {
  calculateRSI,
  calculateMACD,
  calculateVWAP,
  calculateHeikenAshi,
  calculateSMA,
  calculateATR,
  detectRegime,
  getHATrend,
} from './indicators.js';

// Base Model
export { BaseModel } from './models/base-model.js';

// Models
export { TAModel } from './models/ta-model.js';
export { BaselineModel, RandomModel } from './models/baseline-model.js';

// Evaluator
export { StrategyEvaluator, createEvaluator } from './evaluator.js';
