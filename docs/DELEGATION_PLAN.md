# Plan de Delegación - Polymarket Data Platform

> Quién hace qué y en qué orden

---

## Resumen de Agentes

| Agente          | Contexto     | Uso                                                          |
| --------------- | ------------ | ------------------------------------------------------------ |
| **Codex**       | ~200K tokens | Implementación pesada, boilerplate, código bien especificado |
| **Cursor/Opus** | ~100K tokens | Razonamiento complejo, decisiones de arquitectura, debugging |
| **Gemini**      | ~1M tokens   | Research, code review, análisis de código existente          |
| **Claude (yo)** | Coordinador  | Orquestar, validar resultados, crear prompts                 |

---

## FASE 1: Core Infrastructure → CODEX

**Un solo prompt grande con todo el contexto necesario.**

### Prompt para Codex:

````
## TASK
Implement the core infrastructure for a Node.js data collection platform.

## CONTEXT
- Working directory: /home/jlopez/experimentos/polymarket-data-platform
- Node.js ES Modules (type: "module" in package.json)
- SQLite database with better-sqlite3
- Schema already exists at: src/shared/schema.sql
- Config already exists at: src/shared/markets-config.js

## EXPECTED OUTPUT

### 1. src/shared/rate-limiter.js
Token bucket rate limiter class:
- Constructor takes: { maxTokens, refillRate } (tokens per minute)
- Method: async acquire() - waits if no tokens available
- Method: tryAcquire() - returns boolean immediately
- Uses setTimeout for waiting, not busy loops

### 2. src/shared/service-base.js
Base class for services with graceful shutdown:
- Constructor takes: { name, logger }
- Abstract method: async run() - to be implemented by subclasses
- Method: async start() - calls run() and handles errors
- Method: async stop() - sets stopping flag, calls cleanup()
- Abstract method: async cleanup() - for subclass cleanup
- Registers SIGTERM and SIGINT handlers
- Property: stopping (boolean)

### 3. src/shared/logger.js
Simple structured logger:
- Constructor takes: { name, level }
- Levels: debug, info, warn, error
- Methods: debug(), info(), warn(), error()
- Format: [timestamp] [level] [name] message
- Also logs to collector_logs table if db is available

### 4. src/shared/config.js
Config loader:
- Loads .env file using dotenv
- Exports: DATABASE_PATH, OPENWEATHER_API_KEY, LOG_LEVEL, NODE_ENV
- Validates required env vars exist

### 5. src/shared/db.js
Database layer:
- Opens SQLite connection with better-sqlite3
- Method: initialize() - runs schema.sql
- Method: close() - closes connection
- Prepared statements for common operations:
  - insertMarket(data)
  - insertSnapshot(data)
  - insertCandle(data)
  - insertWeather(data)
  - getActiveMarkets(seriesId)
  - updateCollectorStatus(name, status)
  - logCollector(name, level, message, details)

### 6. scripts/setup-db.js
Setup script:
- Reads schema.sql
- Executes all statements
- Prints "Database initialized at {path}"

## SUCCESS CRITERIA (OBJECTIVE - VERIFIABLE)
1. [ ] `node scripts/setup-db.js` creates data/polymarket.db with all tables
2. [ ] Rate limiter test: 10 acquire() calls with limit 5/min - first 5 instant, next 5 wait
3. [ ] Service base: process.kill(process.pid, 'SIGTERM') triggers cleanup
4. [ ] Logger outputs: [2026-01-31T12:00:00.000Z] [INFO] [test] Hello

## TESTS TO RUN
```bash
# Test 1: Setup database
node scripts/setup-db.js
sqlite3 data/polymarket.db ".tables"
# Expected: asset_candles collector_logs collector_status market_indicators...

# Test 2: Rate limiter
node -e "
import { RateLimiter } from './src/shared/rate-limiter.js';
const rl = new RateLimiter({ maxTokens: 3, refillRate: 60 });
for (let i = 0; i < 5; i++) {
  const start = Date.now();
  await rl.acquire();
  console.log('Acquired', i, 'after', Date.now() - start, 'ms');
}
"
# Expected: First 3 instant (0ms), then waits

# Test 3: Service graceful shutdown
node -e "
import { ServiceBase } from './src/shared/service-base.js';
class TestService extends ServiceBase {
  async run() {
    while (!this.stopping) await new Promise(r => setTimeout(r, 100));
  }
  async cleanup() { console.log('Cleanup done'); }
}
const svc = new TestService({ name: 'test' });
svc.start();
setTimeout(() => process.kill(process.pid, 'SIGTERM'), 500);
"
# Expected: "Cleanup done" printed before exit
````

## CRITICAL RULES

- NO MOCKS - all tests use real files, real database
- ES Modules only (import/export, not require)
- Use async/await, not callbacks
- Handle errors with try/catch, log them

```

---

## FASE 2: Collectors → CODEX (4 prompts separados)

### 2.1 Polymarket Collector

```

## TASK

Implement Polymarket collector service that fetches active markets and their prices.

## CONTEXT

- Working directory: /home/jlopez/experimentos/polymarket-data-platform
- Uses: ServiceBase, RateLimiter, db, logger from src/shared/
- Markets config: src/shared/markets-config.js (MARKETS_CONFIG with seriesId)
- API: https://gamma-api.polymarket.com/events?series_id={id}&active=true
- Rate limit: 100 requests/minute

## EXPECTED OUTPUT

### src/collectors/polymarket.service.js

- Extends ServiceBase
- On each poll cycle:
  1. For each series_id in config, fetch active events
  2. For each event, check if market exists in DB, if not insert
  3. Insert snapshot with current prices (yes_bid as up_price)
  4. Check if any markets have ended, update outcome
- Poll interval: 60 seconds
- Graceful shutdown: finish current cycle, close connections

API Response format:

```json
{
  "events": [
    {
      "slug": "btc-15m-2026-01-31-12-00",
      "start_time": "2026-01-31T11:45:00Z",
      "end_time": "2026-01-31T12:00:00Z",
      "markets": [
        {
          "yes_bid": 0.52,
          "no_bid": 0.48,
          "volume": 1234.56
        }
      ]
    }
  ]
}
```

## SUCCESS CRITERIA

1. [ ] Service starts, fetches BTC_15M series (10192), logs found markets
2. [ ] Market inserted into tracked_markets table
3. [ ] Snapshot inserted into market_snapshots table
4. [ ] SIGTERM stops cleanly after current cycle

## TESTS TO RUN

```bash
# Start collector, wait 2 cycles, stop
timeout 130s node src/collectors/polymarket.service.js || true
sqlite3 data/polymarket.db "SELECT COUNT(*) FROM tracked_markets"
sqlite3 data/polymarket.db "SELECT COUNT(*) FROM market_snapshots"
# Expected: >0 for both
```

```

### 2.2 Binance Collector

```

## TASK

Implement Binance collector for crypto candles (BTCUSDT, ETHUSDT, etc.)

## CONTEXT

- API: https://api.binance.com/api/v3/klines?symbol={}&interval={}&limit=100
- Rate limit: 1200 requests/minute
- Symbols from MARKETS_CONFIG where dataSource === 'binance'

## EXPECTED OUTPUT

### src/collectors/binance.service.js

- Fetches 1m and 5m candles for configured symbols
- Inserts into asset_candles table
- Only inserts new candles (checks timestamp)
- Poll interval: 60 seconds

## SUCCESS CRITERIA

1. [ ] Fetches BTCUSDT 1m candles
2. [ ] Inserts candles into asset_candles
3. [ ] No duplicate candles on second run

## TESTS TO RUN

```bash
timeout 70s node src/collectors/binance.service.js || true
sqlite3 data/polymarket.db "SELECT COUNT(*) FROM asset_candles WHERE asset_name='BTC'"
# Expected: >50
```

```

### 2.3 Yahoo Collector

```

## TASK

Implement Yahoo Finance collector for stocks, indices, commodities.

## CONTEXT

- API: https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d
- Rate limit: 100 requests/minute
- Symbols from MARKETS_CONFIG where dataSource === 'yahoo'

## EXPECTED OUTPUT

### src/collectors/yahoo.service.js

- Fetches daily data for indices (^GSPC, ^DJI), commodities (GC=F), stocks (TSLA)
- Inserts into asset_candles with interval='1d'
- Poll interval: 300 seconds (5 min)

## SUCCESS CRITERIA

1. [ ] Fetches SPX (^GSPC) data
2. [ ] Inserts candle into asset_candles
3. [ ] Handles market closed gracefully

## TESTS TO RUN

```bash
timeout 30s node src/collectors/yahoo.service.js || true
sqlite3 data/polymarket.db "SELECT * FROM asset_candles WHERE asset_name='SPX' LIMIT 1"
```

```

### 2.4 OpenWeather Collector

```

## TASK

Implement OpenWeather collector for weather markets.

## CONTEXT

- API: https://api.openweathermap.org/data/2.5/weather?lat={}&lon={}&appid={}&units=metric
- Requires OPENWEATHER_API_KEY from env
- Rate limit: 60 requests/minute
- Locations from MARKETS_CONFIG weather_daily

## EXPECTED OUTPUT

### src/collectors/openweather.service.js

- Fetches current weather for configured cities
- Inserts into weather_snapshots table
- Poll interval: 600 seconds (10 min)
- Skip if API key not configured (log warning)

## SUCCESS CRITERIA

1. [ ] Fetches Tokyo weather
2. [ ] Inserts into weather_snapshots
3. [ ] Graceful handling when API key missing

## TESTS TO RUN

```bash
# With API key configured
timeout 30s node src/collectors/openweather.service.js || true
sqlite3 data/polymarket.db "SELECT * FROM weather_snapshots LIMIT 1"
```

```

---

## FASE 3: Strategy Engine → CURSOR/OPUS

**Requiere razonamiento sobre modelos y lógica de trading.**

```

## TASK

Design and implement the strategy engine with multiple models.

## CONTEXT

The previous BTC 15m experiment failed because:

1. Edge was calculated against hardcoded 50/50 instead of real market prices
2. Even with fix, model was miscalibrated - Polymarket is efficient

We need:

1. A model interface that ALL models must implement
2. A TA model (fixed version of original)
3. A simple baseline model for comparison
4. An evaluator that can run multiple models and compare

## DESIGN QUESTIONS TO ANSWER

1. Should models return confidence or edge directly?
2. How do we handle the "market is already efficient" problem?
3. What indicators are actually useful?

## EXPECTED OUTPUT

- src/strategy/indicators.js - RSI, MACD, VWAP calculations
- src/strategy/models/base-model.js - Model interface
- src/strategy/models/ta-model.js - Technical Analysis model (fixed)
- src/strategy/models/baseline-model.js - Simple baseline
- src/strategy/evaluator.js - Runs and compares models

```

---

## FASE 4: Paper Trading → CODEX

```

## TASK

Implement paper trading service that uses strategy models to make simulated trades.

## CONTEXT

- Reads active markets from DB
- Applies models from strategy engine
- Records trades with all context
- Checks results when markets resolve

## EXPECTED OUTPUT

- src/paper/decision-engine.js
- src/paper/trade-recorder.js
- src/paper/result-checker.js
- src/paper/paper-trader.service.js

## SUCCESS CRITERIA

1. [ ] Detects new market, evaluates with models
2. [ ] Records trade decision with all indicators
3. [ ] Updates result when market resolves
4. [ ] Service runs as daemon

```

---

## FASE 5: TUI Dashboard → CODEX

```

## TASK

Implement TUI dashboard using blessed-contrib.

## EXPECTED OUTPUT

- src/tui/dashboard.js - Main dashboard
- src/tui/views/collectors.js - Collector status
- src/tui/views/trades.js - Paper trades
- src/tui/views/markets.js - Market efficiency

## SUCCESS CRITERIA

1. [ ] Shows collector status (running/stopped, items collected)
2. [ ] Shows recent paper trades
3. [ ] Updates in real-time
4. [ ] Keyboard navigation works (q to quit)

```

---

## FASE 6: CLI & PM2 → CODEX

```

## TASK

Implement CLI and PM2 configuration.

## EXPECTED OUTPUT

- src/cli/index.js - Main CLI with commander
- src/cli/collect.js - Start collectors
- src/cli/paper.js - Start paper trading
- src/cli/dashboard.js - Start TUI
- ecosystem.config.cjs - PM2 configuration

## SUCCESS CRITERIA

1. [ ] `npm run collect` starts all collectors
2. [ ] `pm2 start ecosystem.config.cjs` works
3. [ ] `npm run dashboard` shows TUI

```

---

## FASE 7: Review → GEMINI

```

## TASK

Code review of entire codebase.

## FOCUS AREAS

1. Error handling completeness
2. Rate limiting correctness
3. Database transaction safety
4. Memory leaks in long-running services
5. Graceful shutdown correctness

```

---

## Orden de Ejecución

```

Día 1:
├─ FASE 1 (Core) → Codex ← EMPEZAR AQUÍ
│
Día 2:
├─ FASE 2.1 (Polymarket) → Codex
├─ FASE 2.2 (Binance) → Codex (paralelo)
├─ FASE 2.3 (Yahoo) → Codex (paralelo)
├─ FASE 2.4 (OpenWeather) → Codex (paralelo)
│
Día 3:
├─ FASE 3 (Strategy) → Cursor/Opus
│
Día 4:
├─ FASE 4 (Paper Trading) → Codex
│
Día 5:
├─ FASE 5 (TUI) → Codex
├─ FASE 6 (CLI/PM2) → Codex
│
Día 6:
└─ FASE 7 (Review) → Gemini

```

---

## Próximo Paso

**Ejecutar FASE 1 con Codex usando el prompt de arriba.**

Comando: `/codex-slave` con el prompt de FASE 1.
```
