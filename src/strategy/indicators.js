/**
 * Technical Indicator Calculations
 * All functions handle edge cases (empty candles, insufficient data, etc.)
 */

/**
 * Calculate Relative Strength Index (RSI)
 * @param {Array} candles - Array of candle objects with 'close' property
 * @param {number} period - RSI period (default 14)
 * @returns {number|null} RSI value (0-100) or null if insufficient data
 */
export function calculateRSI(candles, period = 14) {
  if (!candles || candles.length < period + 1) {
    return null;
  }

  const closes = candles.map(c => c.close);
  const changes = [];
  
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  if (changes.length < period) {
    return null;
  }

  // Calculate initial average gain and loss
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change > 0) {
      avgGain += change;
    } else {
      avgLoss += Math.abs(change);
    }
  }

  avgGain /= period;
  avgLoss /= period;

  // Apply Wilder's smoothing for remaining periods
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) {
    return 100;
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return Math.round(rsi * 100) / 100;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * @param {Array} candles - Array of candle objects with 'close' property
 * @param {number} fastPeriod - Fast EMA period (default 12)
 * @param {number} slowPeriod - Slow EMA period (default 26)
 * @param {number} signalPeriod - Signal line period (default 9)
 * @returns {Object|null} { line, signal, histogram } or null if insufficient data
 */
export function calculateMACD(candles, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!candles || candles.length < slowPeriod + signalPeriod) {
    return null;
  }

  const closes = candles.map(c => c.close);

  // Calculate EMAs
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  if (!fastEMA || !slowEMA) {
    return null;
  }

  // Calculate MACD line for each point where both EMAs exist
  const macdLine = [];
  const startIndex = slowPeriod - 1;

  for (let i = startIndex; i < closes.length; i++) {
    const fastIndex = i - (slowPeriod - fastPeriod);
    if (fastIndex >= 0 && fastIndex < fastEMA.length) {
      macdLine.push(fastEMA[fastIndex] - slowEMA[i - startIndex]);
    }
  }

  if (macdLine.length < signalPeriod) {
    return null;
  }

  // Calculate signal line (EMA of MACD line)
  const signalLine = calculateEMA(macdLine, signalPeriod);

  if (!signalLine || signalLine.length === 0) {
    return null;
  }

  const latestMACD = macdLine[macdLine.length - 1];
  const latestSignal = signalLine[signalLine.length - 1];
  const histogram = latestMACD - latestSignal;

  return {
    line: Math.round(latestMACD * 100000) / 100000,
    signal: Math.round(latestSignal * 100000) / 100000,
    histogram: Math.round(histogram * 100000) / 100000,
  };
}

/**
 * Calculate EMA (Exponential Moving Average)
 * @param {Array} values - Array of numeric values
 * @param {number} period - EMA period
 * @returns {Array|null} Array of EMA values or null if insufficient data
 */
function calculateEMA(values, period) {
  if (!values || values.length < period) {
    return null;
  }

  const multiplier = 2 / (period + 1);
  const ema = [];

  // First EMA is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  ema.push(sum / period);

  // Calculate subsequent EMAs
  for (let i = period; i < values.length; i++) {
    const currentEMA = (values[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(currentEMA);
  }

  return ema;
}

/**
 * Calculate Simple Moving Average
 * @param {Array} values - Array of numeric values
 * @param {number} period - SMA period
 * @returns {number|null} SMA value or null if insufficient data
 */
export function calculateSMA(values, period) {
  if (!values || values.length < period) {
    return null;
  }

  const slice = values.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

/**
 * Calculate VWAP (Volume Weighted Average Price)
 * @param {Array} candles - Array of candle objects with high, low, close, volume
 * @returns {number|null} VWAP value or null if insufficient data
 */
export function calculateVWAP(candles) {
  if (!candles || candles.length === 0) {
    return null;
  }

  let cumulativeTPV = 0; // Typical Price * Volume
  let cumulativeVolume = 0;

  for (const candle of candles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const volume = candle.volume || 0;

    cumulativeTPV += typicalPrice * volume;
    cumulativeVolume += volume;
  }

  if (cumulativeVolume === 0) {
    // If no volume data, return simple average of typical prices
    const avgTP = candles.reduce((sum, c) => sum + (c.high + c.low + c.close) / 3, 0) / candles.length;
    return Math.round(avgTP * 100) / 100;
  }

  return Math.round((cumulativeTPV / cumulativeVolume) * 100) / 100;
}

/**
 * Calculate Heiken Ashi candles
 * @param {Array} candles - Array of standard OHLC candles
 * @returns {Array} Array of Heiken Ashi candles with ha_open, ha_high, ha_low, ha_close
 */
export function calculateHeikenAshi(candles) {
  if (!candles || candles.length === 0) {
    return [];
  }

  const haCandles = [];

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const ha = {
      ...candle,
      ha_close: (candle.open + candle.high + candle.low + candle.close) / 4,
    };

    if (i === 0) {
      // First HA candle
      ha.ha_open = (candle.open + candle.close) / 2;
    } else {
      // Subsequent candles use previous HA open/close
      const prevHA = haCandles[i - 1];
      ha.ha_open = (prevHA.ha_open + prevHA.ha_close) / 2;
    }

    ha.ha_high = Math.max(candle.high, ha.ha_open, ha.ha_close);
    ha.ha_low = Math.min(candle.low, ha.ha_open, ha.ha_close);

    haCandles.push(ha);
  }

  return haCandles;
}

/**
 * Detect market regime based on multiple indicators
 * @param {Array} candles - Array of OHLC candles
 * @returns {string} 'TREND_UP', 'TREND_DOWN', 'RANGE', or 'CHOP'
 */
export function detectRegime(candles) {
  if (!candles || candles.length < 20) {
    return 'CHOP';
  }

  const closes = candles.map(c => c.close);
  const recentCandles = candles.slice(-20);

  // Calculate short and long SMAs
  const sma10 = calculateSMA(closes, 10);
  const sma20 = calculateSMA(closes, 20);

  if (sma10 === null || sma20 === null) {
    return 'CHOP';
  }

  // Calculate ADX-like volatility measure
  const atr = calculateATR(recentCandles);
  const priceRange = Math.max(...closes.slice(-20)) - Math.min(...closes.slice(-20));
  const avgPrice = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const rangePercent = (priceRange / avgPrice) * 100;

  // Calculate directional movement
  const highs = recentCandles.map(c => c.high);
  const lows = recentCandles.map(c => c.low);

  let plusDM = 0;
  let minusDM = 0;

  for (let i = 1; i < recentCandles.length; i++) {
    const highDiff = highs[i] - highs[i - 1];
    const lowDiff = lows[i - 1] - lows[i];

    if (highDiff > lowDiff && highDiff > 0) {
      plusDM += highDiff;
    }
    if (lowDiff > highDiff && lowDiff > 0) {
      minusDM += lowDiff;
    }
  }

  const dmRatio = plusDM + minusDM > 0 ? Math.abs(plusDM - minusDM) / (plusDM + minusDM) : 0;

  // Determine regime
  const trendStrength = Math.abs(sma10 - sma20) / avgPrice * 100;
  const currentPrice = closes[closes.length - 1];

  // Strong trend detection
  if (trendStrength > 0.5 && dmRatio > 0.3) {
    if (sma10 > sma20 && currentPrice > sma10) {
      return 'TREND_UP';
    }
    if (sma10 < sma20 && currentPrice < sma10) {
      return 'TREND_DOWN';
    }
  }

  // Range detection (low volatility, oscillating)
  if (rangePercent < 3 && dmRatio < 0.2) {
    return 'RANGE';
  }

  // Choppy market (high volatility but no clear direction)
  return 'CHOP';
}

/**
 * Calculate Average True Range (ATR)
 * @param {Array} candles - Array of OHLC candles
 * @param {number} period - ATR period (default 14)
 * @returns {number|null} ATR value or null if insufficient data
 */
export function calculateATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) {
    return null;
  }

  const trueRanges = [];

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];

    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );

    trueRanges.push(tr);
  }

  if (trueRanges.length < period) {
    return null;
  }

  // Simple average for ATR
  const recentTR = trueRanges.slice(-period);
  return recentTR.reduce((a, b) => a + b, 0) / period;
}

/**
 * Get the trend direction based on Heiken Ashi candles
 * @param {Array} haCandles - Array of Heiken Ashi candles
 * @param {number} lookback - Number of candles to analyze (default 3)
 * @returns {Object} { direction: 'up'|'down'|'neutral', strength: 0-1 }
 */
export function getHATrend(haCandles, lookback = 3) {
  if (!haCandles || haCandles.length < lookback) {
    return { direction: 'neutral', strength: 0 };
  }

  const recent = haCandles.slice(-lookback);
  let bullishCount = 0;
  let bearishCount = 0;

  for (const ha of recent) {
    if (ha.ha_close > ha.ha_open) {
      bullishCount++;
    } else if (ha.ha_close < ha.ha_open) {
      bearishCount++;
    }
  }

  const strength = Math.max(bullishCount, bearishCount) / lookback;

  if (bullishCount > bearishCount) {
    return { direction: 'up', strength };
  }
  if (bearishCount > bullishCount) {
    return { direction: 'down', strength };
  }

  return { direction: 'neutral', strength: 0 };
}
