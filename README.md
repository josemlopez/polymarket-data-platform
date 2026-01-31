# Polymarket Data Platform

24/7 data collection, strategy evaluation, and paper trading for Polymarket prediction markets.

## Features

- **Multi-source Data Collection**: Polymarket odds, Binance crypto, Yahoo Finance stocks/indices/commodities, OpenWeather
- **34+ Markets Tracked**: Crypto (5m/15m/1h/4h/daily), Indices, Commodities, Forex, Stocks, Weather
- **Rate-Limited Services**: Token bucket rate limiting respects all API limits
- **Paper Trading**: Test strategies with real market data before risking capital
- **TUI Dashboard**: Real-time monitoring of collectors and paper trades
- **Graceful Shutdown**: All services handle SIGTERM/SIGINT cleanly

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your API keys (OpenWeather required for weather data)

# Initialize database
npm run setup

# Start data collection
npm run collect

# Or start individual collectors
npm run collect:polymarket
npm run collect:binance

# Start paper trading
npm run paper

# View dashboard
npm run dashboard
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  POLYMARKET DATA PLATFORM                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │Polymarket│ │ Binance  │ │  Yahoo   │ │OpenWeather│       │
│  │100 req/m │ │1200 req/m│ │100 req/m │ │ 60 req/m │       │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
│       │            │            │             │              │
│       └────────────┴────────────┴─────────────┘              │
│                          │                                   │
│                          ▼                                   │
│              ┌───────────────────────┐                       │
│              │    SQLite Database    │                       │
│              │   data/polymarket.db  │                       │
│              └───────────────────────┘                       │
│                          │                                   │
│          ┌───────────────┴───────────────┐                   │
│          ▼                               ▼                   │
│  ┌───────────────┐              ┌───────────────┐           │
│  │Strategy Engine│              │ Paper Trading │           │
│  │  (models)     │──────────────│   Service     │           │
│  └───────────────┘              └───────────────┘           │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   TUI Dashboard                      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Markets Tracked

| Category    | Markets                         | Timeframes          |
| ----------- | ------------------------------- | ------------------- |
| Crypto      | BTC, ETH, SOL, XRP              | 5m, 15m, 1h, 4h, 1d |
| Indices     | SPX, DJI, NDX, FTSE             | 1d                  |
| Commodities | Gold, Silver, Platinum, Oil     | 1d                  |
| Forex       | USDJPY, AUDUSD, EURUSD, etc.    | 1d                  |
| Stocks      | TSLA, PLTR, NFLX, RKLB          | 1d                  |
| Weather     | Tokyo, LA, Phoenix, Seoul, etc. | 1d                  |

## Production Deployment (PM2)

```bash
# Install PM2 globally
npm install -g pm2

# Start all services
pm2 start ecosystem.config.cjs

# View status
pm2 status

# View logs
pm2 logs

# Stop all
pm2 stop all
```

## Project Structure

```
src/
├── shared/           # Shared utilities
│   ├── db.js         # Database connection
│   ├── rate-limiter.js
│   ├── service-base.js
│   └── logger.js
├── collectors/       # Data collector services
│   ├── polymarket.service.js
│   ├── binance.service.js
│   ├── yahoo.service.js
│   └── openweather.service.js
├── strategy/         # Strategy models
│   └── models/
├── paper/            # Paper trading
└── tui/              # Dashboard
```

## License

MIT
