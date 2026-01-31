/**
 * POLYMARKET DATA PLATFORM - MARKET CONFIGURATION
 *
 * All recurring Polymarket markets for 24/7 data collection
 */

export const MARKETS_CONFIG = {
  // ============================================================
  // CRYPTO - Multiple timeframes
  // ============================================================

  crypto_15m: {
    category: "crypto",
    timeframe: "15m",
    pollInterval: 60_000, // Check every 1 minute
    snapshotInterval: 60_000, // Snapshot every 1 minute
    dataSource: "binance",
    candleInterval: "1m",
    markets: [
      { name: "BTC_15M", seriesId: 10192, symbol: "BTCUSDT" },
      { name: "SOL_15M", seriesId: 10423, symbol: "SOLUSDT" },
      { name: "XRP_15M", seriesId: 10422, symbol: "XRPUSDT" },
    ],
  },

  crypto_5m: {
    category: "crypto",
    timeframe: "5m",
    pollInterval: 30_000, // Check every 30 sec
    snapshotInterval: 30_000,
    dataSource: "binance",
    candleInterval: "1m",
    markets: [
      { name: "ETH_5M", seriesId: 10683, symbol: "ETHUSDT" },
      { name: "XRP_5M", seriesId: 10685, symbol: "XRPUSDT" },
    ],
  },

  crypto_hourly: {
    category: "crypto",
    timeframe: "1h",
    pollInterval: 60_000,
    snapshotInterval: 60_000,
    dataSource: "binance",
    candleInterval: "1m",
    markets: [
      { name: "BTC_1H", seriesId: 10114, symbol: "BTCUSDT" },
      { name: "ETH_1H", seriesId: 10117, symbol: "ETHUSDT" },
      { name: "XRP_1H", seriesId: 10123, symbol: "XRPUSDT" },
    ],
  },

  crypto_4h: {
    category: "crypto",
    timeframe: "4h",
    pollInterval: 300_000, // Check every 5 min
    snapshotInterval: 300_000,
    dataSource: "binance",
    candleInterval: "5m",
    markets: [
      { name: "BTC_4H", seriesId: 10331, symbol: "BTCUSDT" },
      { name: "ETH_4H", seriesId: 10325, symbol: "ETHUSDT" },
      { name: "SOL_4H", seriesId: 10233, symbol: "SOLUSDT" },
    ],
  },

  crypto_daily: {
    category: "crypto",
    timeframe: "1d",
    pollInterval: 300_000,
    snapshotInterval: 300_000,
    dataSource: "binance",
    candleInterval: "1h",
    markets: [{ name: "BTC_DAILY", seriesId: 41, symbol: "BTCUSDT" }],
  },

  // ============================================================
  // INDICES - Daily
  // ============================================================

  indices_daily: {
    category: "indices",
    timeframe: "1d",
    pollInterval: 300_000, // Check every 5 min
    snapshotInterval: 300_000,
    dataSource: "yahoo",
    candleInterval: "1d",
    tradingHours: {
      start: "09:30",
      end: "16:00",
      timezone: "America/New_York",
    },
    markets: [
      { name: "SPX", seriesId: 10383, symbol: "^GSPC" },
      { name: "DJI", seriesId: 10384, symbol: "^DJI" },
      { name: "NDX", seriesId: 10381, symbol: "^NDX" },
      { name: "FTSE", seriesId: 10385, symbol: "^FTSE" },
    ],
  },

  // ============================================================
  // COMMODITIES - Daily
  // ============================================================

  commodities_daily: {
    category: "commodities",
    timeframe: "1d",
    pollInterval: 300_000,
    snapshotInterval: 300_000,
    dataSource: "yahoo",
    candleInterval: "1d",
    markets: [
      // Precious Metals
      { name: "GOLD", seriesId: 10457, symbol: "GC=F", altSeriesId: 10396 },
      { name: "SILVER", seriesId: 10458, symbol: "SI=F", altSeriesId: 10397 },
      { name: "PLATINUM", seriesId: 10399, symbol: "PL=F" },
      {
        name: "PALLADIUM",
        seriesId: 10459,
        symbol: "PA=F",
        altSeriesId: 10398,
      },

      // Energy
      { name: "CRUDE_OIL", seriesId: 10401, symbol: "CL=F" },
      { name: "BRENT_OIL", seriesId: 10462, symbol: "BZ=F" },
    ],
  },

  // ============================================================
  // FOREX - Daily
  // ============================================================

  forex_daily: {
    category: "forex",
    timeframe: "1d",
    pollInterval: 300_000,
    snapshotInterval: 300_000,
    dataSource: "yahoo",
    candleInterval: "1d",
    markets: [
      { name: "USDJPY", seriesId: 10988, symbol: "USDJPY=X" },
      { name: "AUDUSD", seriesId: 10402, symbol: "AUDUSD=X" },
      // These might exist - to be discovered
      { name: "EURUSD", seriesId: null, symbol: "EURUSD=X", discover: true },
      { name: "GBPUSD", seriesId: null, symbol: "GBPUSD=X", discover: true },
      { name: "USDCHF", seriesId: null, symbol: "USDCHF=X", discover: true },
      { name: "EURCHF", seriesId: null, symbol: "EURCHF=X", discover: true },
    ],
  },

  // ============================================================
  // STOCKS - Daily
  // ============================================================

  stocks_daily: {
    category: "stocks",
    timeframe: "1d",
    pollInterval: 300_000,
    snapshotInterval: 300_000,
    dataSource: "yahoo",
    candleInterval: "1d",
    tradingHours: {
      start: "09:30",
      end: "16:00",
      timezone: "America/New_York",
    },
    markets: [
      { name: "TSLA", seriesId: 10375, symbol: "TSLA" },
      { name: "PLTR", seriesId: 10391, symbol: "PLTR" },
      { name: "OPEN", seriesId: 10392, symbol: "OPEN" },
      { name: "NFLX", seriesId: 10389, symbol: "NFLX" },
      { name: "RKLB", seriesId: 10393, symbol: "RKLB" },
    ],
  },

  // ============================================================
  // WEATHER - Daily
  // ============================================================

  weather_daily: {
    category: "weather",
    timeframe: "1d",
    pollInterval: 600_000, // Check every 10 min
    snapshotInterval: 600_000,
    dataSource: "openweather",
    markets: [
      {
        name: "TOKYO",
        seriesId: 10740,
        location: "Tokyo,JP",
        lat: 35.6762,
        lon: 139.6503,
      },
      {
        name: "LOS_ANGELES",
        seriesId: 10725,
        location: "Los Angeles,US",
        lat: 34.0522,
        lon: -118.2437,
      },
      {
        name: "PHOENIX",
        seriesId: 10729,
        location: "Phoenix,US",
        lat: 33.4484,
        lon: -112.074,
      },
      {
        name: "AUCKLAND",
        seriesId: 10901,
        location: "Auckland,NZ",
        lat: -36.8509,
        lon: 174.7645,
      },
      {
        name: "SEOUL",
        seriesId: 10742,
        location: "Seoul,KR",
        lat: 37.5665,
        lon: 126.978,
      },
      // Additional cities to discover
      {
        name: "NEW_YORK",
        seriesId: null,
        location: "New York,US",
        lat: 40.7128,
        lon: -74.006,
        discover: true,
      },
      {
        name: "LONDON",
        seriesId: null,
        location: "London,GB",
        lat: 51.5074,
        lon: -0.1278,
        discover: true,
      },
      {
        name: "PARIS",
        seriesId: null,
        location: "Paris,FR",
        lat: 48.8566,
        lon: 2.3522,
        discover: true,
      },
      {
        name: "SYDNEY",
        seriesId: null,
        location: "Sydney,AU",
        lat: -33.8688,
        lon: 151.2093,
        discover: true,
      },
      {
        name: "MIAMI",
        seriesId: null,
        location: "Miami,US",
        lat: 25.7617,
        lon: -80.1918,
        discover: true,
      },
      {
        name: "CHICAGO",
        seriesId: null,
        location: "Chicago,US",
        lat: 41.8781,
        lon: -87.6298,
        discover: true,
      },
      {
        name: "DALLAS",
        seriesId: null,
        location: "Dallas,US",
        lat: 32.7767,
        lon: -96.797,
        discover: true,
      },
    ],
  },
};

// ============================================================
// DATA SOURCE CONFIGURATIONS
// ============================================================

export const DATA_SOURCES = {
  binance: {
    baseUrl: "https://api.binance.com/api/v3",
    endpoints: {
      klines: "/klines",
      ticker: "/ticker/price",
    },
    rateLimit: 1200, // requests per minute
  },

  yahoo: {
    baseUrl: "https://query1.finance.yahoo.com/v8/finance",
    endpoints: {
      chart: "/chart",
    },
    rateLimit: 100, // requests per minute (conservative)
  },

  openweather: {
    baseUrl: "https://api.openweathermap.org/data/2.5",
    endpoints: {
      forecast: "/forecast",
      current: "/weather",
    },
    rateLimit: 60, // free tier
    requiresApiKey: true,
  },

  polymarket: {
    baseUrl: "https://gamma-api.polymarket.com",
    endpoints: {
      events: "/events",
      series: "/series",
    },
    rateLimit: 100,
  },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getMarketsSummary() {
  const summary = {
    total: 0,
    byCategory: {},
    byTimeframe: {},
  };

  for (const [groupKey, group] of Object.entries(MARKETS_CONFIG)) {
    const count = group.markets.filter((m) => m.seriesId !== null).length;
    summary.total += count;

    summary.byCategory[group.category] =
      (summary.byCategory[group.category] || 0) + count;
    summary.byTimeframe[group.timeframe] =
      (summary.byTimeframe[group.timeframe] || 0) + count;
  }

  return summary;
}

export function getMarketsForDataSource(dataSource) {
  const markets = [];
  for (const [groupKey, group] of Object.entries(MARKETS_CONFIG)) {
    if (group.dataSource === dataSource) {
      for (const market of group.markets) {
        markets.push({
          ...market,
          category: group.category,
          timeframe: group.timeframe,
          pollInterval: group.pollInterval,
          candleInterval: group.candleInterval,
        });
      }
    }
  }
  return markets;
}

export function getMarketsByCategory(category) {
  const markets = [];
  for (const [groupKey, group] of Object.entries(MARKETS_CONFIG)) {
    if (group.category === category) {
      markets.push(
        ...group.markets.map((m) => ({ ...m, timeframe: group.timeframe })),
      );
    }
  }
  return markets;
}
