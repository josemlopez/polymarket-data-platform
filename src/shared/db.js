import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import BetterSqlite3 from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Database {
  constructor({ databasePath }) {
    if (!databasePath) {
      throw new Error('Database requires databasePath');
    }
    this.databasePath = databasePath;
    this.db = new BetterSqlite3(databasePath);
    this.statements = {};
  }

  async initialize() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    this.db.exec(schemaSql);
    this._prepareStatements();
  }

  _prepareStatements() {
    this.statements.insertMarket = this.db.prepare(`
      INSERT INTO tracked_markets (
        series_id,
        market_slug,
        asset_name,
        category,
        timeframe,
        start_time,
        end_time,
        initial_up_price,
        initial_down_price,
        initial_asset_price,
        outcome,
        final_up_price,
        final_down_price,
        final_asset_price,
        resolution_time,
        volume,
        liquidity,
        updated_at
      ) VALUES (
        @series_id,
        @market_slug,
        @asset_name,
        @category,
        @timeframe,
        @start_time,
        @end_time,
        @initial_up_price,
        @initial_down_price,
        @initial_asset_price,
        @outcome,
        @final_up_price,
        @final_down_price,
        @final_asset_price,
        @resolution_time,
        @volume,
        @liquidity,
        COALESCE(@updated_at, (strftime('%s', 'now') * 1000))
      )
    `);

    this.statements.insertSnapshot = this.db.prepare(`
      INSERT INTO market_snapshots (
        market_id,
        timestamp,
        up_price,
        down_price,
        asset_price,
        volume,
        liquidity,
        time_remaining_seconds
      ) VALUES (
        @market_id,
        @timestamp,
        @up_price,
        @down_price,
        @asset_price,
        @volume,
        @liquidity,
        @time_remaining_seconds
      )
    `);

    this.statements.insertCandle = this.db.prepare(`
      INSERT INTO asset_candles (
        asset_name,
        data_source,
        interval,
        timestamp,
        open,
        high,
        low,
        close,
        volume
      ) VALUES (
        @asset_name,
        @data_source,
        @interval,
        @timestamp,
        @open,
        @high,
        @low,
        @close,
        @volume
      )
    `);

    this.statements.insertWeather = this.db.prepare(`
      INSERT INTO weather_snapshots (
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

    this.statements.getActiveMarkets = this.db.prepare(`
      SELECT *
      FROM tracked_markets
      WHERE series_id = ?
        AND outcome IS NULL
      ORDER BY end_time ASC
    `);

    this.statements.updateCollectorStatus = this.db.prepare(`
      INSERT INTO collector_status (
        collector_name,
        started_at,
        last_heartbeat,
        status
      ) VALUES (
        @collector_name,
        @started_at,
        @last_heartbeat,
        @status
      )
      ON CONFLICT(collector_name) DO UPDATE SET
        last_heartbeat = excluded.last_heartbeat,
        status = excluded.status,
        started_at = COALESCE(collector_status.started_at, excluded.started_at)
    `);

    this.statements.logCollector = this.db.prepare(`
      INSERT INTO collector_logs (
        collector_name,
        level,
        message,
        details
      ) VALUES (
        @collector_name,
        @level,
        @message,
        @details
      )
    `);
  }

  insertMarket(data) {
    return this.statements.insertMarket.run(data);
  }

  insertSnapshot(data) {
    return this.statements.insertSnapshot.run(data);
  }

  insertCandle(data) {
    return this.statements.insertCandle.run(data);
  }

  insertWeather(data) {
    return this.statements.insertWeather.run(data);
  }

  getActiveMarkets(seriesId) {
    return this.statements.getActiveMarkets.all(seriesId);
  }

  updateCollectorStatus(name, status) {
    const now = Date.now();
    const startedAt = status === 'running' ? now : null;
    return this.statements.updateCollectorStatus.run({
      collector_name: name,
      started_at: startedAt,
      last_heartbeat: now,
      status,
    });
  }

  logCollector(name, level, message, details) {
    return this.statements.logCollector.run({
      collector_name: name,
      level,
      message,
      details,
    });
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}
