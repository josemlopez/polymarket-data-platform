# Plan de Implementación - Polymarket Data Platform

> Sistema completo de recolección, estrategias y paper trading para Polymarket

## Arquitectura General

```
┌────────────────────────────────────────────────────────────────────────┐
│                      POLYMARKET DATA PLATFORM                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                    SERVICE MANAGER (pm2/systemd)                  │ │
│  │  - Process management, graceful shutdown, health checks           │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────────┐  │
│  │ POLYMARKET  │ │   BINANCE   │ │    YAHOO    │ │  OPENWEATHER   │  │
│  │  COLLECTOR  │ │  COLLECTOR  │ │  COLLECTOR  │ │   COLLECTOR    │  │
│  │  (service)  │ │  (service)  │ │  (service)  │ │   (service)    │  │
│  │             │ │             │ │             │ │                │  │
│  │ Rate: 100/m │ │ Rate: 1200/m│ │ Rate: 100/m │ │  Rate: 60/m    │  │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └───────┬────────┘  │
│         │               │               │                 │           │
│         └───────────────┴───────────────┴─────────────────┘           │
│                                   │                                    │
│                                   ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                     SQLite DATABASE                               │ │
│  │                   data/polymarket.db                              │ │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────────┐   │ │
│  │  │tracked_markets │ │market_snapshots│ │   asset_candles    │   │ │
│  │  └────────────────┘ └────────────────┘ └────────────────────┘   │ │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────────┐   │ │
│  │  │weather_snapshots│ │market_indicators│ │   paper_trades    │   │ │
│  │  └────────────────┘ └────────────────┘ └────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                   │                                    │
│                                   ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                    STRATEGY ENGINE                                │ │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────────┐   │ │
│  │  │   Indicator    │ │    Model       │ │      Signal        │   │ │
│  │  │   Calculator   │ │   Evaluator    │ │     Generator      │   │ │
│  │  └────────────────┘ └────────────────┘ └────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                   │                                    │
│                                   ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                  PAPER TRADING ENGINE (service)                   │ │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────────┐   │ │
│  │  │    Decision    │ │     Trade      │ │      Result        │   │ │
│  │  │     Engine     │ │    Recorder    │ │      Checker       │   │ │
│  │  └────────────────┘ └────────────────┘ └────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                   │                                    │
│                                   ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                       TUI DASHBOARD                               │ │
│  │  - Collector status (live)                                        │ │
│  │  - Paper trading results                                          │ │
│  │  - Market efficiency analysis                                     │ │
│  │  - Service health                                                 │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Principios de Diseño

1. **Desacoplado sobre DB**: Cada servicio lee/escribe de SQLite independientemente
2. **Rate Limits**: Cada collector respeta su rate limit con token bucket
3. **Graceful Shutdown**: SIGTERM/SIGINT manejados correctamente
4. **Portable**: Fácil de mover a servidor 24/7
5. **Observable**: TUI muestra estado de todo el sistema

---

## Estructura de Archivos Final

```
polymarket-backtest/
├── package.json
├── ecosystem.config.cjs          # PM2 configuration
├── .env.example                  # Environment variables template
│
├── src/
│   ├── shared/                   # Shared utilities
│   │   ├── db.js                 # Database connection & queries
│   │   ├── rate-limiter.js       # Token bucket rate limiter
│   │   ├── service-base.js       # Base class for services
│   │   ├── logger.js             # Structured logging
│   │   └── config.js             # Config loader (env + markets)
│   │
│   ├── collectors/               # Data collector services
│   │   ├── polymarket.service.js # Polymarket markets + prices
│   │   ├── binance.service.js    # Crypto candles
│   │   ├── yahoo.service.js      # Stocks/indices/commodities
│   │   └── openweather.service.js# Weather data
│   │
│   ├── strategy/                 # Strategy engine
│   │   ├── indicators.js         # RSI, MACD, VWAP, Heiken
│   │   ├── models/               # Multiple strategy models
│   │   │   ├── ta-model.js       # Technical Analysis model
│   │   │   ├── momentum-model.js # Momentum-based model
│   │   │   └── base-model.js     # Model interface
│   │   └── evaluator.js          # Model evaluation
│   │
│   ├── paper/                    # Paper trading service
│   │   ├── paper-trader.service.js
│   │   ├── decision-engine.js
│   │   ├── trade-recorder.js
│   │   └── result-checker.js
│   │
│   ├── tui/                      # Terminal UI
│   │   ├── dashboard.js          # Main dashboard
│   │   ├── views/
│   │   │   ├── collectors.js     # Collector status view
│   │   │   ├── trades.js         # Paper trades view
│   │   │   ├── markets.js        # Market efficiency view
│   │   │   └── services.js       # Service health view
│   │   └── components/
│   │       ├── table.js
│   │       ├── chart.js
│   │       └── status-bar.js
│   │
│   └── cli/                      # CLI commands
│       ├── index.js              # Main CLI entry
│       ├── collect.js            # Start collectors
│       ├── paper.js              # Start paper trading
│       ├── analyze.js            # Run analysis
│       └── dashboard.js          # Start TUI
│
├── scripts/                      # Utility scripts
│   ├── setup-db.js               # Initialize database
│   ├── analyze-efficiency.js     # Market efficiency analysis
│   └── export-data.js            # Export to CSV
│
├── data/
│   └── polymarket.db             # SQLite database
│
└── docs/
    ├── DATA_DAEMON_PLAN.md       # Original plan
    ├── IMPLEMENTATION_PLAN.md    # This document
    └── API_REFERENCE.md          # API documentation
```

---

## Rate Limits por Servicio

| Servicio      | Rate Limit   | Intervalo Poll | Notas                     |
| ------------- | ------------ | -------------- | ------------------------- |
| Polymarket    | 100 req/min  | 60s            | Markets + prices          |
| Binance       | 1200 req/min | 60s (crypto)   | 1m candles for short TF   |
| Yahoo Finance | 100 req/min  | 300s           | Daily data, less frequent |
| OpenWeather   | 60 req/min   | 600s           | Requires API key          |

---

## Fases de Implementación

### FASE 1: Core Infrastructure

**Agente: Codex** (implementación directa, bien especificada)

| #   | Tarea                                  | Archivos                     | Estimación |
| --- | -------------------------------------- | ---------------------------- | ---------- |
| 1.1 | Rate Limiter con Token Bucket          | `src/shared/rate-limiter.js` | -          |
| 1.2 | Service Base Class (graceful shutdown) | `src/shared/service-base.js` | -          |
| 1.3 | Logger estructurado                    | `src/shared/logger.js`       | -          |
| 1.4 | Config loader (env + markets)          | `src/shared/config.js`       | -          |
| 1.5 | Database layer unificado               | `src/shared/db.js`           | -          |
| 1.6 | Setup DB script                        | `scripts/setup-db.js`        | -          |

**Success Criteria:**

- [ ] `node scripts/setup-db.js` crea todas las tablas
- [ ] Rate limiter: 10 requests en 1s con limit 5/s bloquea correctamente
- [ ] Service base: SIGTERM hace cleanup y exit(0)

---

### FASE 2: Collectors

**Agente: Codex** (cada collector es independiente, bien especificado)

| #   | Tarea                         | Archivos                                | Rate Limit |
| --- | ----------------------------- | --------------------------------------- | ---------- |
| 2.1 | Polymarket Collector Service  | `src/collectors/polymarket.service.js`  | 100/min    |
| 2.2 | Binance Collector Service     | `src/collectors/binance.service.js`     | 1200/min   |
| 2.3 | Yahoo Collector Service       | `src/collectors/yahoo.service.js`       | 100/min    |
| 2.4 | OpenWeather Collector Service | `src/collectors/openweather.service.js` | 60/min     |

**Success Criteria:**

- [ ] `node src/collectors/polymarket.service.js` corre y almacena datos
- [ ] `node src/collectors/binance.service.js` corre y almacena candles
- [ ] Cada collector respeta su rate limit
- [ ] Graceful shutdown funciona en todos

---

### FASE 3: Strategy Engine

**Agente: Cursor/Opus** (requiere razonamiento sobre modelos)

| #   | Tarea                                | Archivos                                | Notas                   |
| --- | ------------------------------------ | --------------------------------------- | ----------------------- |
| 3.1 | Port indicators del código existente | `src/strategy/indicators.js`            | RSI, MACD, VWAP, Heiken |
| 3.2 | Base Model interface                 | `src/strategy/models/base-model.js`     | Abstract class          |
| 3.3 | TA Model (modelo actual corregido)   | `src/strategy/models/ta-model.js`       | Con fix de edge         |
| 3.4 | Momentum Model (nuevo)               | `src/strategy/models/momentum-model.js` | Alternativo             |
| 3.5 | Model Evaluator                      | `src/strategy/evaluator.js`             | Aplica modelos          |

**Success Criteria:**

- [ ] Indicators calculan correctamente vs datos de Binance
- [ ] TA Model usa precios REALES de mercado (no hardcoded)
- [ ] Evaluator puede correr múltiples modelos sobre mismo dataset

---

### FASE 4: Paper Trading Service

**Agente: Codex** (implementación clara basada en diseño)

| #   | Tarea                         | Archivos                            |
| --- | ----------------------------- | ----------------------------------- |
| 4.1 | Decision Engine (multi-model) | `src/paper/decision-engine.js`      |
| 4.2 | Trade Recorder                | `src/paper/trade-recorder.js`       |
| 4.3 | Result Checker                | `src/paper/result-checker.js`       |
| 4.4 | Paper Trader Service          | `src/paper/paper-trader.service.js` |

**Success Criteria:**

- [ ] Paper trader detecta mercados nuevos y evalúa
- [ ] Trades se registran con TODOS los campos necesarios
- [ ] Result checker actualiza outcomes cuando mercado cierra
- [ ] Service corre como daemon independiente

---

### FASE 5: TUI Dashboard

**Agente: Codex** (UI con specs claras)

| #   | Tarea                 | Archivos                      |
| --- | --------------------- | ----------------------------- |
| 5.1 | Dashboard principal   | `src/tui/dashboard.js`        |
| 5.2 | Vista de collectors   | `src/tui/views/collectors.js` |
| 5.3 | Vista de paper trades | `src/tui/views/trades.js`     |
| 5.4 | Vista de eficiencia   | `src/tui/views/markets.js`    |
| 5.5 | Vista de servicios    | `src/tui/views/services.js`   |

**Success Criteria:**

- [ ] `node src/cli/index.js dashboard` muestra TUI
- [ ] Actualización en tiempo real de stats
- [ ] Navegación con teclas funciona

---

### FASE 6: CLI & Integration

**Agente: Codex** (implementación directa)

| #   | Tarea                | Archivos               |
| --- | -------------------- | ---------------------- |
| 6.1 | CLI principal        | `src/cli/index.js`     |
| 6.2 | Comando collect      | `src/cli/collect.js`   |
| 6.3 | Comando paper        | `src/cli/paper.js`     |
| 6.4 | Comando dashboard    | `src/cli/dashboard.js` |
| 6.5 | PM2 ecosystem config | `ecosystem.config.cjs` |

**Success Criteria:**

- [ ] `npm run collect` inicia todos los collectors
- [ ] `npm run paper` inicia paper trading
- [ ] `npm run dashboard` muestra TUI
- [ ] `pm2 start ecosystem.config.cjs` levanta todo

---

### FASE 7: Testing & Review

**Agente: Gemini** (research) + **Yo** (coordinación)

| #   | Tarea                     | Agente |
| --- | ------------------------- | ------ |
| 7.1 | Code review de collectors | Gemini |
| 7.2 | Code review de strategy   | Gemini |
| 7.3 | Integration testing real  | Manual |
| 7.4 | Performance testing       | Manual |

---

## Comandos CLI Finales

```bash
# Setup inicial
npm run setup                    # Crea DB y tablas

# Collectors (servicios individuales)
npm run collect                  # Inicia todos los collectors
npm run collect:polymarket       # Solo Polymarket
npm run collect:binance          # Solo Binance
npm run collect:yahoo            # Solo Yahoo
npm run collect:weather          # Solo OpenWeather

# Paper Trading
npm run paper                    # Inicia paper trading service
npm run paper:status             # Muestra estado actual

# Dashboard
npm run dashboard                # TUI interactivo

# Análisis
npm run analyze:efficiency       # Análisis de eficiencia de mercados
npm run analyze:edge             # Buscar edge en subsets

# Production (PM2)
pm2 start ecosystem.config.cjs   # Inicia todo
pm2 status                       # Ver estado
pm2 logs                         # Ver logs
pm2 stop all                     # Parar todo
```

---

## Variables de Entorno

```bash
# .env
DATABASE_PATH=./data/polymarket.db
OPENWEATHER_API_KEY=your_key_here
LOG_LEVEL=info
NODE_ENV=production
```

---

## PM2 Ecosystem Config

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "collector-polymarket",
      script: "src/collectors/polymarket.service.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      env: { NODE_ENV: "production" },
    },
    {
      name: "collector-binance",
      script: "src/collectors/binance.service.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      env: { NODE_ENV: "production" },
    },
    {
      name: "collector-yahoo",
      script: "src/collectors/yahoo.service.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      env: { NODE_ENV: "production" },
    },
    {
      name: "paper-trader",
      script: "src/paper/paper-trader.service.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      env: { NODE_ENV: "production" },
    },
  ],
};
```

---

## Orden de Ejecución de Tareas

```
FASE 1 (Core) ─────────────┐
  1.1 Rate Limiter         │
  1.2 Service Base         │──► Codex (1 prompt grande)
  1.3 Logger               │
  1.4 Config               │
  1.5 DB Layer             │
  1.6 Setup Script         │
                           │
FASE 2 (Collectors) ───────┤
  2.1 Polymarket Collector │
  2.2 Binance Collector    │──► Codex (1 prompt por collector)
  2.3 Yahoo Collector      │
  2.4 OpenWeather Collector│
                           │
FASE 3 (Strategy) ─────────┤
  3.1-3.5 Models + Eval    │──► Cursor/Opus (razonamiento)
                           │
FASE 4 (Paper Trading) ────┤
  4.1-4.4 Paper Service    │──► Codex (basado en diseño)
                           │
FASE 5 (TUI) ──────────────┤
  5.1-5.5 Dashboard + Views│──► Codex (UI clara)
                           │
FASE 6 (CLI) ──────────────┤
  6.1-6.5 CLI + PM2        │──► Codex (integración)
                           │
FASE 7 (Review) ───────────┘
  7.1-7.4 Testing          │──► Gemini + Manual
```

---

## Próxima Acción

**Empezar con FASE 1: Core Infrastructure**

Delegar a Codex con prompt específico para crear:

1. `src/shared/rate-limiter.js`
2. `src/shared/service-base.js`
3. `src/shared/logger.js`
4. `src/shared/config.js`
5. `src/shared/db.js`
6. `scripts/setup-db.js`

---

_Documento creado: 2026-01-31_
_Coordinador: Claude | Implementadores: Codex, Cursor/Opus, Gemini_
