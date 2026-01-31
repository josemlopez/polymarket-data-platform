import { ServiceBase } from '../shared/service-base.js';
import { RateLimiter } from '../shared/rate-limiter.js';
import { Database } from '../shared/db.js';
import { Logger } from '../shared/logger.js';
import { DATABASE_PATH, LOG_LEVEL, OPENWEATHER_API_KEY } from '../shared/config.js';
import { getMarketsForDataSource } from '../shared/markets-config.js';

const POLL_INTERVAL_MS = 600_000;
const RATE_LIMIT_PER_MIN = 60;

export class OpenWeatherCollector extends ServiceBase {
  constructor() {
    const logger = new Logger({ name: 'openweather', level: LOG_LEVEL });
    super({ name: 'openweather', logger });
    this.logger = logger;
    this.db = new Database({ databasePath: DATABASE_PATH });
    this.rateLimiter = new RateLimiter({
      maxTokens: RATE_LIMIT_PER_MIN,
      refillRate: RATE_LIMIT_PER_MIN,
    });
    this.polling = false;
    this.intervalId = null;
    this.insertWeatherStmt = null;
    this.apiKey = OPENWEATHER_API_KEY || process.env.OPENWEATHER_API_KEY || null;
  }

  async run() {
    if (!this.apiKey) {
      this.logger.warn('OPENWEATHER_API_KEY not set; skipping OpenWeather collector.');
      return;
    }

    await this.db.initialize();
    this.logger.db = this.db;
    this._prepareStatements();
    this._updateStatus('running');

    await this._poll();
    this.intervalId = setInterval(() => {
      if (this.stopping) return;
      this._poll();
    }, POLL_INTERVAL_MS);
  }

  async cleanup() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.apiKey) {
      this._updateStatus('stopped');
    }
    if (this.db) {
      this.db.close();
    }
  }

  _prepareStatements() {
    this.insertWeatherStmt = this.db.db.prepare(`
      INSERT OR IGNORE INTO weather_snapshots (
        location,
        timestamp,
        temperature,
        feels_like,
        humidity,
        pressure,
        wind_speed,
        wind_direction,
        clouds,
        weather_main,
        weather_description,
        forecast_temp_min,
        forecast_temp_max,
        forecast_precipitation_prob
      ) VALUES (
        @location,
        @timestamp,
        @temperature,
        @feels_like,
        @humidity,
        @pressure,
        @wind_speed,
        @wind_direction,
        @clouds,
        @weather_main,
        @weather_description,
        @forecast_temp_min,
        @forecast_temp_max,
        @forecast_precipitation_prob
      )
    `);
  }

  _updateStatus(status) {
    try {
      this.db.updateCollectorStatus(this.name, status);
    } catch (error) {
      this.logger.warn('Failed to update collector status', {
        error: this._serializeError(error),
      });
    }
  }

  async _poll() {
    if (this.polling || !this.apiKey) return;
    this.polling = true;

    try {
      const markets = getMarketsForDataSource('openweather');
      for (const market of markets) {
        if (this.stopping) break;
        if (!Number.isFinite(market.lat) || !Number.isFinite(market.lon)) continue;

        await this.rateLimiter.acquire();
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${market.lat}&lon=${market.lon}&appid=${this.apiKey}&units=metric`;

        let response;
        try {
          response = await fetch(url);
        } catch (error) {
          this.logger.warn('Network error fetching OpenWeather', {
            location: market.location ?? market.name,
            error: this._serializeError(error),
          });
          continue;
        }

        if (!response.ok) {
          this.logger.warn('OpenWeather API error', {
            location: market.location ?? market.name,
            status: response.status,
          });
          continue;
        }

        let payload;
        try {
          payload = await response.json();
        } catch (error) {
          this.logger.warn('Failed to parse OpenWeather response', {
            location: market.location ?? market.name,
            error: this._serializeError(error),
          });
          continue;
        }

        try {
          const timestampSeconds = Number(payload?.dt);
          const timestamp = Number.isFinite(timestampSeconds)
            ? timestampSeconds * 1000
            : Date.now();
          const weather = Array.isArray(payload?.weather) ? payload.weather[0] : {};
          const main = payload?.main ?? {};
          const wind = payload?.wind ?? {};
          const clouds = payload?.clouds ?? {};

          this.insertWeatherStmt.run({
            location: market.location ?? market.name,
            timestamp,
            temperature: Number.isFinite(Number(main.temp)) ? Number(main.temp) : null,
            feels_like: Number.isFinite(Number(main.feels_like)) ? Number(main.feels_like) : null,
            humidity: Number.isFinite(Number(main.humidity)) ? Number(main.humidity) : null,
            pressure: Number.isFinite(Number(main.pressure)) ? Number(main.pressure) : null,
            wind_speed: Number.isFinite(Number(wind.speed)) ? Number(wind.speed) : null,
            wind_direction: Number.isFinite(Number(wind.deg)) ? Number(wind.deg) : null,
            clouds: Number.isFinite(Number(clouds.all)) ? Number(clouds.all) : null,
            weather_main: weather?.main ?? null,
            weather_description: weather?.description ?? null,
            forecast_temp_min: null,
            forecast_temp_max: null,
            forecast_precipitation_prob: null,
          });
        } catch (error) {
          this.logger.warn('Failed to insert OpenWeather snapshot', {
            location: market.location ?? market.name,
            error: this._serializeError(error),
          });
        }
      }

      this._updateStatus('running');
    } catch (error) {
      this.logger.error('OpenWeather poll failed', {
        error: this._serializeError(error),
      });
    } finally {
      this.polling = false;
    }
  }
}

const service = new OpenWeatherCollector();
service.start().catch((error) => {
  service.logger.error('OpenWeather collector exited with error', {
    error: service._serializeError(error),
  });
  process.exit(1);
});
