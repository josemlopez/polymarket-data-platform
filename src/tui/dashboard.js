import path from "path";
import { fileURLToPath } from "url";
import blessed from "blessed";
import contrib from "blessed-contrib";
import BetterSqlite3 from "better-sqlite3";
import { getCollectorData } from "./views/collectors.js";
import { getRecentTrades } from "./views/trades.js";
import { getMarketStats, getDetailedMarketStats } from "./views/markets.js";
import { getServiceHealth } from "./views/services.js";
import {
  getEvaluationStats,
  getEvaluationsByMarket,
} from "./views/evaluations.js";
import { LogsView, getCollectorLogs } from "./views/logs-view.js";

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

const EDGE_THRESHOLD = 0.05;
const EDGE_MIN = -0.2;
const EDGE_MAX = 0.2;

const getEdgeSeries = (db, limit = 50) => {
  try {
    if (!db) {
      return { x: [], above: [], below: [], hasData: false };
    }
    const rows = db
      .prepare(
        `SELECT timestamp, edge
         FROM trade_evaluations
         ORDER BY timestamp DESC
         LIMIT ?`,
      )
      .all(limit);

    if (rows.length === 0) {
      return { x: [], above: [], below: [], hasData: false };
    }

    const ordered = rows.slice().reverse();
    const x = [];
    const above = [];
    const below = [];

    ordered.forEach((row) => {
      x.push(formatTimestamp(row.timestamp));
      const edge = Number(row.edge);
      if (!Number.isFinite(edge)) {
        above.push(null);
        below.push(null);
      } else if (edge >= EDGE_THRESHOLD) {
        above.push(edge);
        below.push(null);
      } else {
        above.push(null);
        below.push(edge);
      }
    });

    return { x, above, below, hasData: true };
  } catch (error) {
    return { x: [], above: [], below: [], hasData: false };
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

    // Market stats table - by category
    this.marketStatsTable = this.grid.set(6, 0, 6, 6, contrib.table, {
      label: " Stats by Category [Cat | Mkt/Active | Eval | Trade | Skip%] ",
      columnSpacing: 1,
      columnWidth: [9, 10, 8, 8, 8],
      style: {
        header: { fg: "cyan", bold: true },
      },
    });

    // Evaluation stats table - by market
    this.evaluationStatsTable = this.grid.set(6, 6, 2, 6, contrib.table, {
      label: " Best Opportunities (by max edge) ",
      columnSpacing: 1,
      columnWidth: [10, 6, 6, 8, 8],
      style: {
        header: { fg: "cyan", bold: true },
        cell: { fg: "white" },
      },
    });

    // Scrollable log box
    this.edgeChart = this.grid.set(8, 6, 4, 6, contrib.line, {
      label: " Edge Over Time [l: logs] ",
      minY: EDGE_MIN,
      maxY: EDGE_MAX,
      showLegend: true,
      legend: { width: 12 },
      style: {
        text: "white",
        baseline: "black",
      },
    });

    // Keyboard navigation
    this.quitHandler = () => this.stop();
    this.screen.key(["q", "C-c"], this.quitHandler);
    this.screen.key(["tab"], () => this.cycleFocus());
    this.screen.key(["1"], () => this.focusCollectors());
    this.screen.key(["2"], () => this.focusTrades());
    this.screen.key(["3"], () => this.focusChart());
    this.screen.key(["l"], () => this.showLogsView());

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
      this.edgeChart,
    ];

    this.db = null;
    this.logsView = new LogsView({
      screen: this.screen,
      onExit: () => this.hideLogsView(),
    });
    this.logsViewVisible = false;
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

  focusChart() {
    this.focusIndex = 2;
    this.edgeChart.focus();
    this.screen.render();
  }

  setDashboardVisible(visible) {
    const widgets = [
      this.collectorsTable,
      this.tradesTable,
      this.marketStatsTable,
      this.evaluationStatsBox,
      this.edgeChart,
    ];
    widgets.forEach((widget) => {
      if (visible) {
        widget.show();
      } else {
        widget.hide();
      }
    });
  }

  showLogsView() {
    if (this.logsViewVisible) {
      return;
    }
    this.logsViewVisible = true;
    this.setDashboardVisible(false);
    this.screen.unkey(["q"], this.quitHandler);
    this.logsView.show();
    this.screen.render();
  }

  hideLogsView() {
    if (!this.logsViewVisible) {
      return;
    }
    this.logsViewVisible = false;
    this.logsView.hide();
    this.setDashboardVisible(true);
    this.screen.key(["q"], this.quitHandler);
    this.collectorsTable.focus();
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
      this.detailPopup = null;
    }

    let content = `{bold}Trade Details{/bold}\n\n`;
    content += `{bold}Market:{/bold}\n`;
    content += `  Asset: ${trade.assetName} (${trade.category})\n`;
    content += `  Timeframe: ${trade.timeframe}\n`;
    content += `  Slug: ${trade.marketSlug}\n`;
    if (trade.marketUrl) {
      content += `  URL: ${trade.marketUrl}\n`;
    }
    content += `  Start: ${trade.startTime} | End: ${trade.endTime}\n`;
    content += `\n{bold}Trade:{/bold}\n`;
    content += `  Time: ${trade.time}\n`;
    content += `  Model: ${trade.model}\n`;
    content += `  Direction: ${trade.direction}\n`;
    content += `  Entry Price: ${trade.entry}\n`;
    content += `  Stake: $${trade.stake}\n`;
    content += `\n{bold}Model Analysis:{/bold}\n`;
    content += `  Confidence: ${trade.confidence}%\n`;
    content += `  Edge: ${trade.edge}%\n`;
    content += `\n{bold}Result:{/bold}\n`;
    content += `  Outcome: ${trade.outcome}\n`;
    content += `  PnL: $${trade.pnl}\n`;

    this.detailPopup = blessed.box({
      parent: this.screen,
      top: "center",
      left: "center",
      width: "70%",
      height: "70%",
      label: " Trade Details [Esc/q to close] ",
      content: content,
      tags: true,
      border: { type: "line" },
      scrollable: true,
      keys: true,
      vi: true,
      mouse: true,
      style: {
        fg: "white",
        bg: "black",
        border: { fg: "cyan" },
      },
    });

    const closePopup = () => {
      if (this.detailPopup) {
        this.detailPopup.destroy();
        this.detailPopup = null;
        this.screen.render();
      }
    };

    this.detailPopup.key(["escape", "q"], closePopup);
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

    const detailedStats = getDetailedMarketStats(this.db);
    const evaluationStats = getEvaluationStats(this.db);
    const statsRows = [];

    if (detailedStats) {
      // Category breakdown
      detailedStats.byCategory.forEach((cat) => {
        const skipPct =
          cat.evaluated > 0
            ? Math.round((cat.skipped / cat.evaluated) * 100)
            : 0;
        statsRows.push([
          cat.category.substring(0, 8),
          `${cat.total}/${cat.active}`,
          `${cat.evaluated}`,
          `${cat.traded}`,
          `${skipPct}%`,
        ]);
      });

      // Totals row
      const t = detailedStats.totals;
      statsRows.push([
        "TOTAL",
        `${t.markets}/${t.activeMarkets}`,
        `${t.evaluations}`,
        `${t.trades}`,
        t.winRate ? `${t.winRate}%` : "—",
      ]);

      // Recent activity
      const ra = detailedStats.recentActivity;
      statsRows.push([
        "Last",
        `snap:${ra.lastSnapshot}`,
        `eval:${ra.lastEvaluation}`,
        `trade:${ra.lastTrade}`,
        "",
      ]);
    }

    this.marketStatsTable.setData({
      headers: ["Cat", "Mkt/Act", "Eval", "Trade", "Skip%"],
      data: safeTableRows(statsRows, 5),
    });

    // Best opportunities by market
    const evalsByMarket = getEvaluationsByMarket(this.db, 8);
    const evalRows = evalsByMarket.map((m) => [
      m.asset,
      `${m.evals}`,
      `${m.trades}`,
      m.maxEdge,
      m.direction,
    ]);
    this.evaluationStatsTable.setData({
      headers: ["Asset", "Evals", "Trd", "MaxEdge", "Dir"],
      data: safeTableRows(evalRows, 5),
    });

    const edgeSeries = getEdgeSeries(this.db, 50);
    if (!edgeSeries.hasData) {
      this.edgeChart.setLabel(" Edge Over Time (No evaluations yet) ");
      this.edgeChart.setData([
        {
          title: "No evaluations yet",
          x: [""],
          y: [0],
          style: { line: "gray" },
        },
      ]);
    } else {
      this.edgeChart.setLabel(" Edge Over Time [l: logs] ");
      const thresholdLine = edgeSeries.x.map(() => EDGE_THRESHOLD);
      this.edgeChart.setData([
        {
          title: `>= ${EDGE_THRESHOLD}`,
          x: edgeSeries.x,
          y: edgeSeries.above,
          style: { line: "green" },
        },
        {
          title: `< ${EDGE_THRESHOLD}`,
          x: edgeSeries.x,
          y: edgeSeries.below,
          style: { line: "red" },
        },
        {
          title: "Threshold",
          x: edgeSeries.x,
          y: thresholdLine,
          style: { line: "yellow" },
        },
      ]);
    }

    const logs = getCollectorLogs(this.db, 400);
    this.logsView.setLogs(logs);

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
