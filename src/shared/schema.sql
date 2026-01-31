-- ============================================================
-- POLYMARKET DATA PLATFORM - DATABASE SCHEMA
-- ============================================================
-- Stores ALL market data for posterior analysis
-- ============================================================

-- Tracked markets (each individual Polymarket market)
CREATE TABLE IF NOT EXISTS tracked_markets (
  id INTEGER PRIMARY KEY,
  series_id INTEGER NOT NULL,
  market_slug TEXT UNIQUE NOT NULL,
  asset_name TEXT NOT NULL,           -- BTC_15M, SPX, GOLD, etc.
  category TEXT NOT NULL,             -- crypto, indices, commodities, forex, stocks, weather
  timeframe TEXT NOT NULL,            -- 5m, 15m, 1h, 4h, 1d

  -- Market times
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,

  -- Initial prices (when market detected)
  initial_up_price REAL,
  initial_down_price REAL,
  initial_asset_price REAL,

  -- Final result
  outcome TEXT,                       -- 'Up' or 'Down' when resolved
  final_up_price REAL,
  final_down_price REAL,
  final_asset_price REAL,
  resolution_time INTEGER,

  -- Metadata
  volume REAL,
  liquidity REAL,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_tracked_markets_series ON tracked_markets(series_id);
CREATE INDEX IF NOT EXISTS idx_tracked_markets_asset ON tracked_markets(asset_name);
CREATE INDEX IF NOT EXISTS idx_tracked_markets_category ON tracked_markets(category);
CREATE INDEX IF NOT EXISTS idx_tracked_markets_outcome ON tracked_markets(outcome);
CREATE INDEX IF NOT EXISTS idx_tracked_markets_end_time ON tracked_markets(end_time);

-- ============================================================
-- Market price snapshots (temporal evolution of odds)
-- ============================================================
CREATE TABLE IF NOT EXISTS market_snapshots (
  id INTEGER PRIMARY KEY,
  market_id INTEGER NOT NULL REFERENCES tracked_markets(id) ON DELETE CASCADE,
  timestamp INTEGER NOT NULL,

  -- Polymarket prices
  up_price REAL NOT NULL,
  down_price REAL NOT NULL,

  -- Underlying asset price
  asset_price REAL,

  -- Market volume/liquidity at that moment
  volume REAL,
  liquidity REAL,

  -- Time remaining until close
  time_remaining_seconds INTEGER,

  UNIQUE(market_id, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_market ON market_snapshots(market_id);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_timestamp ON market_snapshots(timestamp);

-- ============================================================
-- Underlying asset candles (BTC, SPX, Gold, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_candles (
  id INTEGER PRIMARY KEY,
  asset_name TEXT NOT NULL,           -- BTC, SOL, SPX, GOLD, etc.
  data_source TEXT NOT NULL,          -- binance, yahoo, etc.
  interval TEXT NOT NULL,             -- 1m, 5m, 1h, 1d
  timestamp INTEGER NOT NULL,

  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL,

  UNIQUE(asset_name, interval, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_asset_candles_asset ON asset_candles(asset_name);
CREATE INDEX IF NOT EXISTS idx_asset_candles_timestamp ON asset_candles(timestamp);
CREATE INDEX IF NOT EXISTS idx_asset_candles_interval ON asset_candles(interval);

-- ============================================================
-- Weather data (for weather markets)
-- ============================================================
CREATE TABLE IF NOT EXISTS weather_snapshots (
  id INTEGER PRIMARY KEY,
  location TEXT NOT NULL,             -- Tokyo, Seoul, LA, etc.
  timestamp INTEGER NOT NULL,

  -- Current data
  temperature REAL,                   -- Celsius
  feels_like REAL,
  humidity REAL,                      -- Percentage
  pressure REAL,                      -- hPa
  wind_speed REAL,                    -- m/s
  wind_direction REAL,                -- degrees
  clouds REAL,                        -- percentage
  weather_main TEXT,                  -- Clear, Clouds, Rain, etc.
  weather_description TEXT,

  -- Forecast data
  forecast_temp_min REAL,
  forecast_temp_max REAL,
  forecast_precipitation_prob REAL,

  UNIQUE(location, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_weather_location ON weather_snapshots(location);
CREATE INDEX IF NOT EXISTS idx_weather_timestamp ON weather_snapshots(timestamp);

-- ============================================================
-- Calculated technical indicators (for analysis)
-- ============================================================
CREATE TABLE IF NOT EXISTS market_indicators (
  id INTEGER PRIMARY KEY,
  market_id INTEGER NOT NULL REFERENCES tracked_markets(id) ON DELETE CASCADE,
  timestamp INTEGER NOT NULL,

  -- Price-based
  price REAL,
  vwap REAL,
  vwap_dist REAL,                     -- Distance from VWAP (%)

  -- Momentum
  rsi REAL,
  rsi_slope REAL,

  -- MACD
  macd_line REAL,
  macd_signal REAL,
  macd_hist REAL,

  -- Heiken Ashi
  heiken_color TEXT,                  -- 'green' or 'red'
  heiken_count INTEGER,               -- Consecutive same color

  -- Volume
  volume_ratio REAL,                  -- Current vs average

  -- Regime
  regime TEXT,                        -- TREND_UP, TREND_DOWN, RANGE, CHOP

  UNIQUE(market_id, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_indicators_market ON market_indicators(market_id);
CREATE INDEX IF NOT EXISTS idx_indicators_timestamp ON market_indicators(timestamp);

-- ============================================================
-- Paper trades
-- ============================================================
CREATE TABLE IF NOT EXISTS paper_trades (
  id INTEGER PRIMARY KEY,
  market_id INTEGER NOT NULL REFERENCES tracked_markets(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,           -- Which strategy model

  -- Trade details
  direction TEXT NOT NULL,            -- 'Up' or 'Down'
  entry_price REAL NOT NULL,          -- Price paid for position
  shares REAL NOT NULL,               -- Number of shares
  stake REAL NOT NULL,                -- Amount invested

  -- Model's prediction
  model_confidence REAL,              -- Model's confidence 0-1
  model_edge REAL,                    -- Calculated edge

  -- Indicators at trade time
  indicators_json TEXT,               -- JSON snapshot of indicators

  -- Result
  outcome TEXT,                       -- 'win', 'loss', or null if pending
  pnl REAL,                           -- Profit/loss
  exit_price REAL,                    -- Price at resolution

  -- Timestamps
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  resolved_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_paper_trades_market ON paper_trades(market_id);
CREATE INDEX IF NOT EXISTS idx_paper_trades_model ON paper_trades(model_name);
CREATE INDEX IF NOT EXISTS idx_paper_trades_outcome ON paper_trades(outcome);

-- ============================================================
-- Trade evaluations (paper trader decisions)
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  market_id INTEGER,
  market_slug TEXT,
  model_name TEXT,
  direction TEXT,
  model_confidence REAL,
  market_price REAL,
  edge REAL,
  decision TEXT,  -- 'TRADE' or 'SKIP'
  reason TEXT
);

-- ============================================================
-- Collector status (for monitoring)
-- ============================================================
CREATE TABLE IF NOT EXISTS collector_status (
  id INTEGER PRIMARY KEY,
  collector_name TEXT UNIQUE NOT NULL, -- polymarket, binance, yahoo, openweather
  started_at INTEGER,
  last_heartbeat INTEGER,
  items_collected INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'stopped'        -- running, stopped, error
);

CREATE TABLE IF NOT EXISTS collector_logs (
  id INTEGER PRIMARY KEY,
  timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  collector_name TEXT NOT NULL,
  level TEXT NOT NULL,                 -- INFO, WARN, ERROR
  message TEXT NOT NULL,
  details TEXT                         -- JSON with additional info
);

CREATE INDEX IF NOT EXISTS idx_collector_logs_timestamp ON collector_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_collector_logs_collector ON collector_logs(collector_name);
CREATE INDEX IF NOT EXISTS idx_collector_logs_level ON collector_logs(level);

-- ============================================================
-- Useful views for analysis
-- ============================================================

-- Resolved markets with metrics
CREATE VIEW IF NOT EXISTS v_resolved_markets AS
SELECT
  tm.id,
  tm.asset_name,
  tm.category,
  tm.timeframe,
  tm.market_slug,
  tm.outcome,
  tm.initial_up_price,
  tm.initial_down_price,
  tm.final_up_price,
  tm.final_down_price,
  tm.initial_asset_price,
  tm.final_asset_price,
  (tm.end_time - tm.start_time) / 1000 / 60 as duration_minutes,
  tm.volume,
  CASE
    WHEN tm.outcome = 'Up' THEN tm.final_asset_price > tm.initial_asset_price
    WHEN tm.outcome = 'Down' THEN tm.final_asset_price < tm.initial_asset_price
    ELSE NULL
  END as price_matched_outcome
FROM tracked_markets tm
WHERE tm.outcome IS NOT NULL;

-- Market efficiency view (do prices predict well?)
CREATE VIEW IF NOT EXISTS v_market_efficiency AS
SELECT
  asset_name,
  category,
  timeframe,
  COUNT(*) as total_markets,
  SUM(CASE WHEN outcome = 'Up' THEN 1 ELSE 0 END) as up_outcomes,
  SUM(CASE WHEN outcome = 'Down' THEN 1 ELSE 0 END) as down_outcomes,
  AVG(initial_up_price) as avg_initial_up_price,
  AVG(CASE WHEN outcome = 'Up' THEN 1.0 ELSE 0.0 END) as actual_up_rate,
  ABS(AVG(initial_up_price) - AVG(CASE WHEN outcome = 'Up' THEN 1.0 ELSE 0.0 END)) as calibration_error
FROM tracked_markets
WHERE outcome IS NOT NULL
GROUP BY asset_name, category, timeframe;

-- Paper trading performance by model
CREATE VIEW IF NOT EXISTS v_model_performance AS
SELECT
  model_name,
  COUNT(*) as total_trades,
  SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins,
  SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) as losses,
  ROUND(100.0 * SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) / COUNT(*), 2) as win_rate,
  ROUND(SUM(pnl), 2) as total_pnl,
  ROUND(AVG(pnl), 2) as avg_pnl,
  ROUND(AVG(model_confidence), 3) as avg_confidence
FROM paper_trades
WHERE outcome IS NOT NULL
GROUP BY model_name;
