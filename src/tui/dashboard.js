import path from 'path';
import { fileURLToPath } from 'url';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import BetterSqlite3 from 'better-sqlite3';
import { getCollectorData } from './views/collectors.js';
import { getRecentTrades } from './views/trades.js';
import { getMarketStats } from './views/markets.js';
import { getServiceHealth } from './views/services.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const formatTimestamp = (timestamp) => {
  if (!timestamp) {
    return '—';
  }
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const safeTableRows = (rows, columns) => {
  if (!rows || rows.length === 0) {
    return [Array(columns).fill('No data')];
  }
  return rows;
};

const getActivityLog = (db, limit = 30) => {
  try {
    if (!db) {
      return [];
    }
    const rows = db
      .prepare(
        `SELECT timestamp, level, collector_name, message
         FROM collector_logs
         ORDER BY timestamp DESC
         LIMIT ?`
      )
      .all(limit);

    return rows.map((row) => {
      const time = formatTimestamp(row.timestamp);
      const level = row.level ?? 'INFO';
      const collector = row.collector_name ?? 'system';
      const message = row.message ?? '';
      return `[${time}] ${level} ${collector} - ${message}`;
    });
  } catch (error) {
    return [];
  }
};

export class Dashboard {
  constructor({ dbPath = null, refreshIntervalMs = 5000 } = {}) {
    const defaultDbPath = path.resolve(__dirname, '../../data/polymarket.db');
    this.dbPath = dbPath ?? defaultDbPath;
    this.refreshIntervalMs = refreshIntervalMs;
    this.interval = null;

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Polymarket Data Platform',
      fullUnicode: false,
    });

    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

    this.collectorsTable = this.grid.set(0, 0, 6, 6, contrib.table, {
      label: 'Collector Status',
      columnSpacing: 2,
      columnWidth: [16, 10, 14, 16],
    });

    this.tradesTable = this.grid.set(0, 6, 6, 6, contrib.table, {
      label: 'Recent Trades',
      columnSpacing: 2,
      columnWidth: [10, 12, 10, 10, 10, 10],
    });

    this.marketStatsTable = this.grid.set(6, 0, 6, 6, contrib.table, {
      label: 'Market Stats',
      columnSpacing: 2,
      columnWidth: [20, 28],
    });

    this.activityLog = this.grid.set(6, 6, 6, 6, contrib.log, {
      label: 'Log / Activity',
    });

    this.screen.key(['q', 'C-c'], () => this.stop());

    this.db = null;
  }

  start() {
    try {
      this.db = new BetterSqlite3(this.dbPath, { readonly: false });
    } catch (error) {
      this.db = null;
    }

    this.refresh();
    this.interval = setInterval(() => this.refresh(), this.refreshIntervalMs);
  }

  refresh() {
    const collectorData = getCollectorData(this.db);
    const collectorRows = collectorData.map((collector) => [
      collector.name,
      collector.status,
      collector.lastHeartbeat,
      String(collector.itemsCollected),
    ]);
    this.collectorsTable.setData({
      headers: ['Name', 'Status', 'Heartbeat', 'Items'],
      data: safeTableRows(collectorRows, 4),
    });

    const tradeData = getRecentTrades(this.db, 10);
    const tradeRows = tradeData.map((trade) => [
      trade.time,
      trade.model,
      trade.direction,
      trade.entry,
      trade.outcome,
      trade.pnl,
    ]);
    this.tradesTable.setData({
      headers: ['Time', 'Model', 'Direction', 'Entry', 'Outcome', 'PnL'],
      data: safeTableRows(tradeRows, 6),
    });

    const marketStats = getMarketStats(this.db);
    const serviceHealth = getServiceHealth(this.db);
    const statsRows = [];

    if (marketStats) {
      statsRows.push(['Total markets', String(marketStats.totalMarkets)]);
      statsRows.push(['Resolved markets', String(marketStats.resolvedMarkets)]);
      statsRows.push([
        'Calibration error',
        marketStats.calibrationError ?? '—',
      ]);

      if (marketStats.winRateByCategory.length > 0) {
        marketStats.winRateByCategory.forEach((entry) => {
          const rate = entry.winRate ? `${entry.winRate}%` : '—';
          statsRows.push([
            `Win ${entry.category}`,
            `${rate} (${entry.total})`,
          ]);
        });
      } else {
        statsRows.push(['Win rate', 'No data']);
      }
    }

    if (serviceHealth.length > 0) {
      serviceHealth.forEach((service) => {
        statsRows.push([
          `Svc ${service.name}`,
          `${service.status} ${service.uptime} err:${service.errors}`,
        ]);
      });
    } else {
      statsRows.push(['Services', 'No data']);
    }

    this.marketStatsTable.setData({
      headers: ['Metric', 'Value'],
      data: safeTableRows(statsRows, 2),
    });

    const logs = getActivityLog(this.db, 40);
    if (logs.length === 0) {
      this.activityLog.setContent('No data');
    } else {
      this.activityLog.setContent(logs.join('\n'));
    }

    this.screen.render();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    if (this.db) {
      try {
        this.db.close();
      } catch (error) {
        // ignore close errors
      }
    }
    this.screen.destroy();
    process.exit(0);
  }
}

export default Dashboard;
