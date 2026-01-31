# Polymarket Recurring Markets Catalog

> Documento exhaustivo de todos los mercados recurrentes en Polymarket que pueden ser utilizados con estrategias de trading algorítmico similares a BTC 15m.

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Crypto 15-Minute Markets](#crypto-15-minute-markets)
3. [Financial Indices Daily](#financial-indices-daily)
4. [Commodities Daily](#commodities-daily)
5. [Individual Stocks Daily](#individual-stocks-daily)
6. [Weather Markets](#weather-markets)
7. [Sports Markets](#sports-markets)
8. [APIs de Datos por Asset](#apis-de-datos-por-asset)
9. [Adaptación del Sistema](#adaptación-del-sistema)
10. [Prioridades de Implementación](#prioridades-de-implementación)

---

## Resumen Ejecutivo

### Tipos de Mercados Disponibles

| Categoría         | Frecuencia      | Timeframe  | Dificultad Adaptación |
| ----------------- | --------------- | ---------- | --------------------- |
| Crypto 15m        | Cada 15 min     | 15 minutos | ⭐ Muy fácil          |
| Indices Daily     | Diario          | 24 horas   | ⭐⭐ Fácil            |
| Commodities Daily | Diario          | 24 horas   | ⭐⭐ Fácil            |
| Stocks Daily      | Diario          | 24 horas   | ⭐⭐ Fácil            |
| Weather           | Diario/Variable | Variable   | ⭐⭐⭐ Media          |
| Sports            | Por evento      | 2-3 horas  | ⭐⭐⭐⭐ Compleja     |

### API Base

```
https://gamma-api.polymarket.com
```

### Endpoints Clave

```bash
# Obtener mercados de una serie
GET /events?series_id={ID}&closed=false&limit=10

# Listar todas las series
GET /series?limit=100

# Buscar por texto
GET /events?_q={search_term}&closed=false

# Obtener detalles de un mercado
GET /events/{slug}
```

---

## Crypto 15-Minute Markets

### Características Comunes

- **Frecuencia**: Nuevo mercado cada 15 minutos, 24/7
- **Duración**: 15 minutos exactos
- **Resolución**: Precio al cierre del período
- **Outcomes**: "Up" o "Down" vs precio de apertura
- **Ventana óptima de entrada**: 10-14 minutos antes del cierre

### BTC Up or Down 15m

| Parámetro           | Valor                       |
| ------------------- | --------------------------- |
| **Series ID**       | `10192`                     |
| **Símbolo Binance** | `BTCUSDT`                   |
| **Volumen típico**  | $500 - $5,000 por mercado   |
| **Liquidez**        | Alta                        |
| **Ejemplo slug**    | `btc-updown-15m-1769853600` |

```bash
# Fetch mercados abiertos
curl "https://gamma-api.polymarket.com/events?series_id=10192&closed=false&limit=5"
```

### SOL Up or Down 15m

| Parámetro           | Valor                      |
| ------------------- | -------------------------- |
| **Series ID**       | `10423`                    |
| **Símbolo Binance** | `SOLUSDT`                  |
| **Volumen típico**  | $100 - $1,000 por mercado  |
| **Liquidez**        | Media                      |
| **Correlación BTC** | Alta (sigue a BTC con lag) |

```bash
curl "https://gamma-api.polymarket.com/events?series_id=10423&closed=false&limit=5"
```

### XRP Up or Down 15m

| Parámetro           | Valor                  |
| ------------------- | ---------------------- |
| **Series ID**       | `10422`                |
| **Símbolo Binance** | `XRPUSDT`              |
| **Volumen típico**  | $50 - $500 por mercado |
| **Liquidez**        | Media-Baja             |
| **Volatilidad**     | Alta                   |

```bash
curl "https://gamma-api.polymarket.com/events?series_id=10422&closed=false&limit=5"
```

### Edge Potencial en Crypto 15m

1. **Análisis técnico**: RSI, MACD, VWAP funcionan bien en timeframes cortos
2. **Correlación entre assets**: Si BTC se mueve fuerte, SOL/XRP siguen con lag
3. **Régimen de mercado**: TREND vs RANGE vs CHOP
4. **Volume ratio**: Volumen anormal indica movimiento inminente

---

## Financial Indices Daily

### Características Comunes

- **Frecuencia**: Un mercado nuevo cada día de trading
- **Duración**: ~24 horas (apertura a cierre)
- **Resolución**: Precio de cierre oficial
- **Horario**: Cierre ~21:00 UTC (4pm ET)

### S&P 500 (SPX) Daily

| Parámetro           | Valor                               |
| ------------------- | ----------------------------------- |
| **Series ID**       | `10383`                             |
| **Yahoo Symbol**    | `^GSPC`                             |
| **Volumen típico**  | $1,000 - $10,000                    |
| **Horario trading** | 9:30am - 4:00pm ET                  |
| **Ejemplo slug**    | `spx-up-or-down-on-february-2-2026` |

```bash
curl "https://gamma-api.polymarket.com/events?series_id=10383&closed=false&limit=3"
```

**Datos históricos:**

```bash
# Yahoo Finance API
curl "https://query1.finance.yahoo.com/v8/finance/chart/^GSPC?interval=1d&range=1mo"
```

### Dow Jones (DJI) Daily

| Parámetro          | Valor         |
| ------------------ | ------------- |
| **Series ID**      | `10384`       |
| **Yahoo Symbol**   | `^DJI`        |
| **Volumen típico** | $500 - $5,000 |

### NASDAQ (NDX) Daily

| Parámetro          | Valor         |
| ------------------ | ------------- |
| **Series ID**      | `10381`       |
| **Yahoo Symbol**   | `^NDX`        |
| **Volumen típico** | $500 - $5,000 |

### FTSE 100 Daily

| Parámetro        | Valor               |
| ---------------- | ------------------- |
| **Series ID**    | `10385`             |
| **Yahoo Symbol** | `^FTSE`             |
| **Horario**      | 8:00am - 4:30pm GMT |

### USD/JPY Daily

| Parámetro     | Valor      |
| ------------- | ---------- |
| **Series ID** | `10988`    |
| **Symbol**    | `USDJPY=X` |
| **Tipo**      | Forex      |

### Edge Potencial en Indices

1. **Momentum intradía**: Tendencia desde apertura suele continuar
2. **Correlación global**: FTSE predice US open, Asia predice Europa
3. **Eventos macro**: Fed meetings, earnings season
4. **VIX como indicador**: Alta volatilidad = más incertidumbre

---

## Commodities Daily

### Gold Futures (GC) Daily

| Parámetro              | Valor                              |
| ---------------------- | ---------------------------------- |
| **Series ID**          | `10457`                            |
| **Yahoo Symbol**       | `GC=F`                             |
| **Exchange**           | COMEX                              |
| **Volumen Polymarket** | $100 - $1,000                      |
| **Ejemplo slug**       | `gc-up-or-down-on-february-2-2026` |

```bash
curl "https://gamma-api.polymarket.com/events?series_id=10457&closed=false&limit=3"
```

**Edge potencial:**

- Correlación inversa con USD (DXY)
- Safe haven en risk-off
- Bajo volumen en Polymarket = posible ineficiencia

### Silver Futures (SI) Daily

| Parámetro              | Valor                  |
| ---------------------- | ---------------------- |
| **Series ID**          | `10458`                |
| **Yahoo Symbol**       | `SI=F`                 |
| **Exchange**           | COMEX                  |
| **Volumen Polymarket** | $10 - $100 (muy bajo!) |

**Nota:** Volumen muy bajo puede significar spreads amplios pero también oportunidad de edge.

### Copper Futures (HG)

| Parámetro        | Valor                    |
| ---------------- | ------------------------ |
| **Series ID**    | `10980`                  |
| **Yahoo Symbol** | `HG=F`                   |
| **Frecuencia**   | Variable (price targets) |

---

## Individual Stocks Daily

### Tesla (TSLA) Daily

| Parámetro        | Valor    |
| ---------------- | -------- |
| **Series ID**    | `10375`  |
| **Yahoo Symbol** | `TSLA`   |
| **Volatilidad**  | Muy alta |

### Palantir (PLTR) Daily

| Parámetro        | Valor   |
| ---------------- | ------- |
| **Series ID**    | `10391` |
| **Yahoo Symbol** | `PLTR`  |

### Opendoor (OPEN) Daily

| Parámetro        | Valor   |
| ---------------- | ------- |
| **Series ID**    | `10392` |
| **Yahoo Symbol** | `OPEN`  |

### Weekly Options-like Markets

| Mercado              | Series ID | Tipo    |
| -------------------- | --------- | ------- |
| Google Multi Strikes | `10496`   | Weekly  |
| Nvidia Multi Strikes | `10511`   | Monthly |
| MSTR Weeklies        | `10036`   | Weekly  |
| Mag 7 Weekly         | `10759`   | Weekly  |

---

## Weather Markets

### Caso de Estudio: Weather Trader ($24k profit)

**Perfil:** https://polymarket.com/@0xf2e346ab

**Estrategia documentada:**

- Comprar shares underpriced (< $0.15)
- Shortear incertidumbre (40-50¢)
- Cost basis bajo = reward >> risk

**ROIs reportados:**

- $48 → $1,020 (+2,022%)
- $205 → $1,194 (+481%)
- $599 → $3,179 (+430%)
- $200 → $1,020 (+410%)

### Seoul Daily Weather

| Parámetro      | Valor                               |
| -------------- | ----------------------------------- |
| **Series ID**  | `10742`                             |
| **Tipo**       | Temperature bands                   |
| **Resolución** | Korea Meteorological Administration |

### Auckland Daily Weather

| Parámetro      | Valor                  |
| -------------- | ---------------------- |
| **Series ID**  | `10901`                |
| **Tipo**       | Temperature/conditions |
| **Resolución** | MetService NZ          |

### APIs de Datos Meteorológicos

| API                   | Uso                  | Costo    |
| --------------------- | -------------------- | -------- |
| **NWS (weather.gov)** | USA forecasts        | Gratis   |
| **OpenWeatherMap**    | Global               | Freemium |
| **Weather.com**       | Detailed forecasts   | API key  |
| **Windy.com**         | Models visualization | Gratis   |
| **ECMWF**             | European model       | Pagado   |
| **GFS**               | US model             | Gratis   |

### Edge Potencial en Weather

1. **Model convergence**: Los modelos meteorológicos convergen antes que el mercado
2. **Local knowledge**: Conocer patrones locales (monsoon, sea breeze)
3. **Ensemble models**: Combinar múltiples forecasts
4. **Timing**: Actualizar predicción cerca del cierre

---

## Sports Markets

### Endpoints de Descubrimiento

```bash
# Listar deportes/ligas activas
GET /sports

# Mercados de una liga específica
GET /events?series_id={LEAGUE_ID}&closed=false
```

### Ligas Disponibles

| Liga                | Tipo       | Frecuencia          |
| ------------------- | ---------- | ------------------- |
| NBA                 | Basketball | Diario en temporada |
| NFL                 | Football   | Semanal             |
| Soccer (various)    | Football   | Variable            |
| Cricket             | Cricket    | Variable            |
| Esports (CoD, Dota) | Gaming     | Por torneo          |

### Edge Potencial en Sports

1. **Injury news**: Lesiones de última hora
2. **Line movement**: Smart money vs public
3. **Rest days**: Back-to-back games
4. **Home/away splits**: Estadísticas locales

---

## APIs de Datos por Asset

### Crypto (Binance)

```javascript
// 1-minute candles
const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=240`;

// Símbolos disponibles
const CRYPTO_SYMBOLS = {
  BTC: "BTCUSDT",
  SOL: "SOLUSDT",
  XRP: "XRPUSDT",
  ETH: "ETHUSDT",
};
```

### Stocks/Indices (Yahoo Finance)

```javascript
// Daily candles
const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;

// Símbolos
const STOCK_SYMBOLS = {
  SPX: "^GSPC",
  DJI: "^DJI",
  NDX: "^NDX",
  FTSE: "^FTSE",
  TSLA: "TSLA",
  GOLD: "GC=F",
  SILVER: "SI=F",
};
```

### Forex (Free APIs)

```javascript
// ExchangeRate-API (free tier)
const url = `https://api.exchangerate-api.com/v4/latest/USD`;

// Alpha Vantage (free with API key)
const url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=USD&to_symbol=JPY&apikey=${key}`;
```

### Weather

```javascript
// OpenWeatherMap
const url = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${key}`;

// NWS (USA only, free)
const url = `https://api.weather.gov/gridpoints/${office}/${x},${y}/forecast`;
```

---

## Adaptación del Sistema

### Arquitectura Actual (BTC 15m)

```
src/paper/
├── market-monitor.js    # Fetch Polymarket markets
├── candle-collector.js  # Fetch Binance candles
├── decision-engine.js   # Technical analysis + decision
├── result-checker.js    # Check outcomes
└── paper-trader.js      # Main loop
```

### Cambios Necesarios por Tipo de Mercado

#### Para otros Crypto 15m (SOL, XRP)

```javascript
// market-monitor.js - Solo cambiar SERIES_ID
const SERIES_ID = 10423; // SOL instead of 10192

// candle-collector.js - Solo cambiar símbolo
const SYMBOL = "SOLUSDT"; // instead of BTCUSDT
```

**Tiempo estimado**: 30 minutos

#### Para Daily Markets (SPX, Gold, Silver)

```javascript
// Cambios necesarios:
// 1. Timeframe de candles: 1d instead of 1m
// 2. Indicadores: Ajustar períodos (RSI 14d, MACD 12/26/9d)
// 3. Entry window: Diferente (ej: 2-4 horas antes del cierre)
// 4. Data source: Yahoo Finance instead of Binance
```

**Tiempo estimado**: 2-4 horas

#### Para Weather Markets

```javascript
// Cambios necesarios:
// 1. Data source: Weather APIs instead of price APIs
// 2. Modelo: Probabilístico basado en forecasts
// 3. Features: Temperature, precipitation probability, wind
// 4. Sin indicadores técnicos tradicionales
```

**Tiempo estimado**: 1-2 días

---

## Prioridades de Implementación

### Fase 1: Validar BTC 15m (ACTUAL)

- [x] Paper trading funcionando
- [x] Datos guardados en SQLite
- [ ] Acumular 50+ trades para validación estadística
- [ ] Comparar con backtest histórico

### Fase 2: Expandir a otros Crypto 15m

- [ ] SOL 15m (Series 10423)
- [ ] XRP 15m (Series 10422)
- [ ] Correr en paralelo con BTC

### Fase 3: Daily Markets

- [ ] S&P 500 (Series 10383)
- [ ] Gold (Series 10457)
- [ ] Adaptar indicadores a timeframe diario

### Fase 4: Weather Markets

- [ ] Investigar APIs meteorológicas
- [ ] Crear modelo de predicción de temperatura
- [ ] Paper trade en Seoul/Auckland

---

## Apéndice: Series IDs Completos

```javascript
const POLYMARKET_SERIES = {
  // Crypto 15m
  BTC_15M: 10192,
  SOL_15M: 10423,
  XRP_15M: 10422,

  // Indices Daily
  SPX_DAILY: 10383,
  DJI_DAILY: 10384,
  NDX_DAILY: 10381,
  FTSE_DAILY: 10385,

  // Forex Daily
  USDJPY_DAILY: 10988,

  // Commodities Daily
  GOLD_DAILY: 10457,
  SILVER_DAILY: 10458,
  COPPER: 10980,

  // Stocks Daily
  TSLA_DAILY: 10375,
  PLTR_DAILY: 10391,
  OPEN_DAILY: 10392,

  // Weather
  SEOUL_WEATHER: 10742,
  AUCKLAND_WEATHER: 10901,

  // Options-like
  GOOGLE_WEEKLY: 10496,
  NVIDIA_MONTHLY: 10511,
  MSTR_WEEKLY: 10036,
  MAG7_WEEKLY: 10759,
};
```

---

## Referencias

- Polymarket API: https://gamma-api.polymarket.com
- Weather Trader Profile: https://polymarket.com/@0xf2e346ab
- Binance API: https://api.binance.com
- Yahoo Finance: https://finance.yahoo.com

---

_Documento generado: 2026-01-31_
_Última actualización: Validación en curso con BTC 15m paper trading_
