import path from "path";
import { fileURLToPath } from "url";
import blessed from "blessed";
import contrib from "blessed-contrib";
import BetterSqlite3 from "better-sqlite3";
import { getCollectorData } from "./views/collectors.js";
import { getRecentTrades } from "./views/trades.js";
import { getMarketStats } from "./views/markets.js";
import { getServiceHealth } from "./views/services.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const formatTimestamp = (timestamp) => {
  if (!timestamp) {
    return "—";
  }
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

const safeTableRows = (rows, columns) => {
  if (!rows || rows.length === 0) {
    return [Array(columns).fill("No data")];
  }
  return rows;
};

const getActivityLog = (db, limit = 100) => {
  try {
    if (!db) {
      return [];
    }
    const rows = db
      .prepare(
        `SELECT timestamp, level, collector_name, message
         FROM collector_logs
         ORDER BY timestamp DESC
         LIMIT ?`,
      )
      .all(limit);

    return rows.map((row) => {
      const time = formatTimestamp(row.timestamp);
      const level = row.level ?? "INFO";
      const collector = row.collector_name ?? "system";
      const message = row.message ?? "";
      return `[${time}] ${level} ${collector} - ${message}`;
    });
  } catch (error) {
    return [];
  }
};

const getCollectorDetails = (db, collectorName) => {
  try {
    if (!db) return null;

    const status = db
      .prepare(`SELECT * FROM collector_status WHERE collector_name = ?`)
      .get(collectorName);

    const recentLogs = db
      .prepare(
        `SELECT timestamp, level, message FROM collector_logs
       WHERE collector_name = ? ORDER BY timestamp DESC LIMIT 20`,
      )
      .all(collectorName);

    const errorCount = db
      .prepare(
        `SELECT COUNT(*) as count FROM collector_logs
       WHERE collector_name = ? AND level = 'ERROR'`,
      )
      .get(collectorName);

    return { status, recentLogs, errorCount: errorCount?.count || 0 };
  } catch (error) {
    return null;
  }
};

const getTradeDetails = (db, tradeIndex, trades) => {
  try {
    if (!db || !trades || tradeIndex >= trades.length) return null;
    const trade = trades[tradeIndex];
    return trade;
  } catch (error) {
    return null;
  }
};

export class Dashboard {
  constructor({ dbPath = null, refreshIntervalMs = 5000 } = {}) {
    const defaultDbPath = path.resolve(__dirname, "../../data/polymarket.db");
    this.dbPath = dbPath ?? defaultDbPath;
    this.refreshIntervalMs = refreshIntervalMs;
    this.interval = null;
    this.collectorData = [];
    this.tradeData = [];
    this.selectedCollector = 0;
    this.selectedTrade = 0;
    this.detailPopup = null;

    this.screen = blessed.screen({
      smartCSR: true,
      title: "Polymarket Data Platform",
      fullUnicode: false,
      mouse: true,
    });

    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

    // Collectors table - interactive
    this.collectorsTable = this.grid.set(0, 0, 6, 6, contrib.table, {
      label: " Collector Status [↑↓ Enter for details] ",
      columnSpacing: 2,
      columnWidth: [16, 10, 14, 16],
      interactive: true,
      keys: true,
      mouse: true,
      style: {
        header: { fg: "cyan", bold: true },
        cell: { fg: "white", selected: { bg: "blue" } },
      },
    });

    // Trades table - interactive
    this.tradesTable = this.grid.set(0, 6, 6, 6, contrib.table, {
      label: " Recent Trades [↑↓ Enter for details] ",
      columnSpacing: 2,
      columnWidth: [10, 12, 10, 10, 10, 10],
      interactive: true,
      keys: true,
      mouse: true,
      style: {
        header: { fg: "cyan", bold: true },
        cell: { fg: "white", selected: { bg: "blue" } },
      },
    });

    // Market stats table
    this.marketStatsTable = this.grid.set(6, 0, 6, 6, contrib.table, {
      label: " Market Stats ",
      columnSpacing: 2,
      columnWidth: [20, 28],
      style: {
        header: { fg: "cyan", bold: true },
      },
    });

    // Scrollable log box
    this.activityLog = this.grid.set(6, 6, 6, 6, blessed.box, {
      label: " Log / Activity [↑↓ PgUp/PgDn to scroll] ",
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: "█",
        track: { bg: "gray" },
        style: { bg: "cyan" },
      },
      keys: true,
      vi: true,
      mouse: true,
      style: {
        fg: "white",
        border: { fg: "white" },
      },
    });

    // Keyboard navigation
    this.screen.key(["q", "C-c"], () => this.stop());
    this.screen.key(["tab"], () => this.cycleFocus());
    this.screen.key(["1"], () => this.focusCollectors());
    this.screen.key(["2"], () => this.focusTrades());
    this.screen.key(["3"], () => this.focusLog());

    // Collectors table events
    this.collectorsTable.rows.on("select", (item, index) => {
      this.showCollectorDetails(index);
    });

    // Trades table events
    this.tradesTable.rows.on("select", (item, index) => {
      this.showTradeDetails(index);
    });

    this.focusIndex = 0;
    this.focusElements = [
      this.collectorsTable,
      this.tradesTable,
      this.activityLog,
    ];

    this.db = null;
  }

  cycleFocus() {
    this.focusIndex = (this.focusIndex + 1) % this.focusElements.length;
    this.focusElements[this.focusIndex].focus();
    this.screen.render();
  }

  focusCollectors() {
    this.focusIndex = 0;
    this.collectorsTable.focus();
    this.screen.render();
  }

  focusTrades() {
    this.focusIndex = 1;
    this.tradesTable.focus();
    this.screen.render();
  }

  focusLog() {
    this.focusIndex = 2;
    this.activityLog.focus();
    this.screen.render();
  }

  showCollectorDetails(index) {
    if (index < 0 || index >= this.collectorData.length) return;

    const collector = this.collectorData[index];
    const details = getCollectorDetails(this.db, collector.name);

    if (this.detailPopup) {
      this.detailPopup.destroy();
    }

    let content = `{bold}Collector: ${collector.name}{/bold}\n\n`;
    content += `Status: ${collector.status}\n`;
    content += `Last Heartbeat: ${collector.lastHeartbeat}\n`;
    content += `Items Collected: ${collector.itemsCollected}\n`;

    if (details) {
      content += `Total Errors: ${details.errorCount}\n`;
      content += `\n{bold}Recent Logs:{/bold}\n`;
      if (details.recentLogs && details.recentLogs.length > 0) {
        details.recentLogs.slice(0, 10).forEach((log) => {
          const time = formatTimestamp(log.timestamp);
          content += `[${time}] ${log.level}: ${log.message}\n`;
        });
      } else {
        content += "No logs available\n";
      }
    }

    this.detailPopup = blessed.box({
      parent: this.screen,
      top: "center",
      left: "center",
      width: "70%",
      height: "60%",
      label: ` ${collector.name} Details [Esc to close] `,
      content: content,
      tags: true,
      border: { type: "line" },
      style: {
        fg: "white",
        bg: "black",
        border: { fg: "cyan" },
      },
      scrollable: true,
      keys: true,
      vi: true,
      mouse: true,
      scrollbar: {
        ch: "█",
        style: { bg: "cyan" },
      },
    });

    this.detailPopup.key(["escape", "q"], () => {
      this.detailPopup.destroy();
      this.detailPopup = null;
      this.screen.render();
    });

    this.detailPopup.focus();
    this.screen.render();
  }

  showTradeDetails(index) {
    if (index < 0 || index >= this.tradeData.length) return;

    const trade = this.tradeData[index];

    if (this.detailPopup) {
      this.detailPopup.destroy();
    }

    let content = `{bold}Trade Details{/bold}\n\n`;
    content += `Time: ${trade.time}\n`;
    content += `Model: ${trade.model}\n`;
    content += `Direction: ${trade.direction}\n`;
    content += `Entry Price: ${trade.entry}\n`;
    content += `Outcome: ${trade.outcome}\n`;
    content += `PnL: ${trade.pnl}\n`;

    this.detailPopup = blessed.box({
      parent: this.screen,
      top: "center",
      left: "center",
      width: "50%",
      height: "40%",
      label: " Trade Details [Esc to close] ",
      content: content,
      tags: true,
      border: { type: "line" },
      style: {
        fg: "white",
        bg: "black",
        border: { fg: "cyan" },
      },
    });

    this.detailPopup.key(["escape", "q"], () => {
      this.detailPopup.destroy();
      this.detailPopup = null;
      this.screen.render();
    });

    this.detailPopup.focus();
    this.screen.render();
  }

  start() {
    try {
      this.db = new BetterSqlite3(this.dbPath, { readonly: false });
    } catch (error) {
      this.db = null;
    }

    this.refresh();
    this.interval = setInterval(() => this.refresh(), this.refreshIntervalMs);
    this.collectorsTable.focus();
  }

  refresh() {
    this.collectorData = getCollectorData(this.db);
    const collectorRows = this.collectorData.map((collector) => [
      collector.name,
      collector.status,
      collector.lastHeartbeat,
      String(collector.itemsCollected),
    ]);
    this.collectorsTable.setData({
      headers: ["Name", "Status", "Heartbeat", "Items"],
      data: safeTableRows(collectorRows, 4),
    });

    this.tradeData = getRecentTrades(this.db, 10);
    const tradeRows = this.tradeData.map((trade) => [
      trade.time,
      trade.model,
      trade.direction,
      trade.entry,
      trade.outcome,
      trade.pnl,
    ]);
    this.tradesTable.setData({
      headers: ["Time", "Model", "Direction", "Entry", "Outcome", "PnL"],
      data: safeTableRows(tradeRows, 6),
    });

    const marketStats = getMarketStats(this.db);
    const serviceHealth = getServiceHealth(this.db);
    const statsRows = [];

    if (marketStats) {
      statsRows.push(["Total markets", String(marketStats.totalMarkets)]);
      statsRows.push(["Resolved markets", String(marketStats.resolvedMarkets)]);
      statsRows.push([
        "Calibration error",
        marketStats.calibrationError ?? "—",
      ]);

      if (marketStats.winRateByCategory.length > 0) {
        marketStats.winRateByCategory.forEach((entry) => {
          const rate = entry.winRate ? `${entry.winRate}%` : "—";
          statsRows.push([`Win ${entry.category}`, `${rate} (${entry.total})`]);
        });
      } else {
        statsRows.push(["Win rate", "No data"]);
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
      statsRows.push(["Services", "No data"]);
    }

    this.marketStatsTable.setData({
      headers: ["Metric", "Value"],
      data: safeTableRows(statsRows, 2),
    });

    const logs = getActivityLog(this.db, 100);
    if (logs.length === 0) {
      this.activityLog.setContent("No data");
    } else {
      this.activityLog.setContent(logs.join("\n"));
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
