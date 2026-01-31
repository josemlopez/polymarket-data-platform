# Polymarket Data Daemon - Plan de Implementación

> Documento para recolección de datos 24/7 de múltiples mercados de Polymarket

## Estado Actual

### Lo que aprendimos del Paper Trading BTC 15m

1. **El modelo original tenía un bug crítico**: Calculaba edge contra 50/50 fijo, no contra precios reales
2. **Win rate real**: 33% (2/6 trades) vs 53% del backtest simulado
3. **Conclusión**: El mercado de Polymarket es eficiente - los indicadores técnicos ya están "priced in"
4. **Solución**: Recolectar MUCHOS datos de MUCHOS mercados para encontrar dónde HAY ineficiencias

### Fix aplicado

```javascript
// strategy.js - ANTES (bug)
const edge = computeEdge({
  marketYes: 0.5, // HARDCODED!
  marketNo: 0.5,
});

// DESPUÉS (corregido)
const edge = computeEdge({
  marketYes: marketPrices.up, // PRECIO REAL
  marketNo: marketPrices.down,
});
```

---

## Arquitectura del Data Daemon

```
┌─────────────────────────────────────────────────────────────┐
│                 POLYMARKET DATA DAEMON                       │
│                    (runs 24/7)                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   CRYPTO    │  │   INDICES   │  │ COMMODITIES │          │
│  │ BTC,SOL,XRP │  │ SPX,DJI,NDX │  │ GOLD,SILVER │          │
│  │ 5m,15m,1h,4h│  │   Daily     │  │ OIL,COPPER  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   FOREX     │  │   STOCKS    │  │   WEATHER   │          │
│  │ USDJPY,EUR  │  │ TSLA,NFLX   │  │ Tokyo,Seoul │          │
│  │   Daily     │  │   Daily     │  │ LA,Phoenix  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                      COLLECTORS                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 1. Polymarket: Fetch mercados abiertos + precios    │    │
│  │ 2. Binance: Candles crypto (1m, 5m, 1h)            │    │
│  │ 3. Yahoo: Candles stocks/indices/commodities        │    │
│  │ 4. OpenWeather: Datos meteorológicos                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    SQLite Database                           │
│            data/polymarket-data.db                          │
│  - tracked_markets (mercados)                               │
│  - market_snapshots (precios en el tiempo)                  │
│  - asset_candles (BTC, SPX, Gold candles)                   │
│  - weather_snapshots (datos clima)                          │
│  - market_indicators (RSI, MACD, etc.)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Mercados Configurados (34 total)

### CRYPTO (12 mercados)

| Nombre    | Series ID | Symbol  | Timeframe | Data Source |
| --------- | --------- | ------- | --------- | ----------- |
| BTC_15M   | 10192     | BTCUSDT | 15m       | Binance     |
| SOL_15M   | 10423     | SOLUSDT | 15m       | Binance     |
| XRP_15M   | 10422     | XRPUSDT | 15m       | Binance     |
| ETH_5M    | 10683     | ETHUSDT | 5m        | Binance     |
| XRP_5M    | 10685     | XRPUSDT | 5m        | Binance     |
| BTC_1H    | 10114     | BTCUSDT | 1h        | Binance     |
| ETH_1H    | 10117     | ETHUSDT | 1h        | Binance     |
| XRP_1H    | 10123     | XRPUSDT | 1h        | Binance     |
| BTC_4H    | 10331     | BTCUSDT | 4h        | Binance     |
| ETH_4H    | 10325     | ETHUSDT | 4h        | Binance     |
| SOL_4H    | 10233     | SOLUSDT | 4h        | Binance     |
| BTC_DAILY | 41        | BTCUSDT | 1d        | Binance     |

### INDICES (4 mercados)

| Nombre | Series ID | Symbol | Data Source |
| ------ | --------- | ------ | ----------- |
| SPX    | 10383     | ^GSPC  | Yahoo       |
| DJI    | 10384     | ^DJI   | Yahoo       |
| NDX    | 10381     | ^NDX   | Yahoo       |
| FTSE   | 10385     | ^FTSE  | Yahoo       |

### COMMODITIES (6 mercados)

| Nombre    | Series ID | Symbol | Data Source |
| --------- | --------- | ------ | ----------- |
| GOLD      | 10457     | GC=F   | Yahoo       |
| SILVER    | 10458     | SI=F   | Yahoo       |
| PLATINUM  | 10399     | PL=F   | Yahoo       |
| PALLADIUM | 10459     | PA=F   | Yahoo       |
| CRUDE_OIL | 10401     | CL=F   | Yahoo       |
| BRENT_OIL | 10462     | BZ=F   | Yahoo       |

### FOREX (2 mercados confirmados)

| Nombre | Series ID | Symbol   | Data Source |
| ------ | --------- | -------- | ----------- |
| USDJPY | 10988     | USDJPY=X | Yahoo       |
| AUDUSD | 10402     | AUDUSD=X | Yahoo       |

### STOCKS (5 mercados)

| Nombre | Series ID | Symbol | Data Source |
| ------ | --------- | ------ | ----------- |
| TSLA   | 10375     | TSLA   | Yahoo       |
| PLTR   | 10391     | PLTR   | Yahoo       |
| OPEN   | 10392     | OPEN   | Yahoo       |
| NFLX   | 10389     | NFLX   | Yahoo       |
| RKLB   | 10393     | RKLB   | Yahoo       |

### WEATHER (5 mercados confirmados)

| Nombre      | Series ID | Location       | Data Source |
| ----------- | --------- | -------------- | ----------- |
| TOKYO       | 10740     | Tokyo,JP       | OpenWeather |
| LOS_ANGELES | 10725     | Los Angeles,US | OpenWeather |
| PHOENIX     | 10729     | Phoenix,US     | OpenWeather |
| AUCKLAND    | 10901     | Auckland,NZ    | OpenWeather |
| SEOUL       | 10742     | Seoul,KR       | OpenWeather |

---

## Archivos Creados

```
src/daemon/
├── config.js          # ✅ Configuración de todos los mercados
├── schema.sql         # ✅ Schema de base de datos
├── index.js           # ❌ TODO: Main daemon loop
├── collectors/
│   ├── polymarket.js  # ❌ TODO: Fetch mercados y precios
│   ├── binance.js     # ❌ TODO: Fetch candles crypto
│   ├── yahoo.js       # ❌ TODO: Fetch candles stocks
│   └── openweather.js # ❌ TODO: Fetch weather data
├── db.js              # ❌ TODO: Database helpers
└── utils.js           # ❌ TODO: Utilities
```

---

## Database Schema (ya creado)

### Tablas principales

```sql
-- Mercados individuales de Polymarket
CREATE TABLE tracked_markets (
  id, series_id, market_slug, asset_name, category, timeframe,
  start_time, end_time, outcome, initial_up_price, final_up_price, ...
);

-- Snapshots de precios (cada minuto)
CREATE TABLE market_snapshots (
  id, market_id, timestamp, up_price, down_price, asset_price, ...
);

-- Candles del asset subyacente
CREATE TABLE asset_candles (
  id, asset_name, data_source, interval, timestamp, open, high, low, close, volume
);

-- Datos meteorológicos
CREATE TABLE weather_snapshots (
  id, location, timestamp, temperature, humidity, wind_speed, forecast_temp_max, ...
);

-- Indicadores técnicos
CREATE TABLE market_indicators (
  id, market_id, timestamp, rsi, macd_hist, vwap_dist, regime, ...
);
```

### Vistas para análisis

```sql
-- Eficiencia de mercado (calibración)
CREATE VIEW v_market_efficiency AS
SELECT asset_name, category,
  AVG(initial_up_price) as avg_predicted_up,
  AVG(CASE WHEN outcome='Up' THEN 1.0 ELSE 0.0 END) as actual_up_rate,
  ABS(avg_predicted - actual) as calibration_error
FROM tracked_markets
GROUP BY asset_name, category;
```

---

## APIs de Datos

### Binance (Crypto)

```javascript
// Candles
GET https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=240

// Precio actual
GET https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT
```

### Yahoo Finance (Stocks/Indices/Commodities)

```javascript
// Chart data
GET https://query1.finance.yahoo.com/v8/finance/chart/^GSPC?interval=1d&range=1mo
```

### Polymarket

```javascript
// Mercados de una serie
GET https://gamma-api.polymarket.com/events?series_id=10192&closed=false&limit=10

// Todas las series
GET https://gamma-api.polymarket.com/series?limit=200
```

### OpenWeather

```javascript
// Forecast (requiere API key)
GET https://api.openweathermap.org/data/2.5/forecast?q=Tokyo&appid=KEY
```

---

## Estimación de Datos

| Período  | Snapshots  | Tamaño DB |
| -------- | ---------- | --------- |
| 1 día    | ~14,000    | ~5 MB     |
| 1 semana | ~100,000   | ~35 MB    |
| 1 mes    | ~420,000   | ~150 MB   |
| 1 año    | ~5,000,000 | ~2 GB     |

---

## Próximos Pasos (TODO)

### 1. Implementar el Daemon Principal

```javascript
// src/daemon/index.js
async function main() {
  // Initialize DB
  initializeDatabase();

  // Start collectors for each market group
  for (const [name, config] of Object.entries(MARKETS_CONFIG)) {
    startCollector(name, config);
  }

  // Heartbeat loop
  while (true) {
    updateDaemonStatus();
    await sleep(60000);
  }
}
```

### 2. Implementar Collectors

- `collectors/polymarket.js` - Fetch mercados abiertos, precios
- `collectors/binance.js` - Fetch candles crypto
- `collectors/yahoo.js` - Fetch candles stocks/commodities
- `collectors/openweather.js` - Fetch weather (necesita API key)

### 3. Script de Systemd

```ini
[Unit]
Description=Polymarket Data Daemon
After=network.target

[Service]
Type=simple
User=jlopez
WorkingDirectory=/home/jlopez/experimentos/polymarket-backtest
ExecStart=/usr/bin/node src/daemon/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

### 4. Scripts de Análisis

- `scripts/analyze-market-efficiency.js` - ¿Qué mercados son ineficientes?
- `scripts/find-edge.js` - ¿Dónde hay edge real?
- `scripts/backtest-on-collected.js` - Backtest con datos reales

---

## Flujo de Trabajo Propuesto

```
1. RECOLECTAR (daemon 24/7)
   └── Acumular datos de 34+ mercados durante 1-4 semanas

2. ANALIZAR
   └── ¿Qué mercados tienen calibración_error > 5%?
   └── ¿Dónde los precios NO predicen bien el outcome?

3. SIMULAR
   └── Con datos REALES (precios de entrada, outcomes)
   └── Probar estrategias solo donde hay ineficiencia

4. PAPER TEST
   └── Si la simulación muestra edge, correr paper trading
   └── Validar con dinero simulado pero precios reales

5. (Opcional) LIVE
   └── Si paper test es rentable, considerar real
```

---

## Referencias

- Config file: `src/daemon/config.js`
- Schema: `src/daemon/schema.sql`
- Catálogo de mercados: `docs/POLYMARKET_MARKETS_CATALOG.md`
- Paper trading actual: `src/paper/`

---

_Documento creado: 2026-01-31_
_Para continuar implementación después de compactación de contexto_
