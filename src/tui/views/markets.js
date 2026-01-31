const formatNumber = (value, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return Number(value).toFixed(digits);
};

const formatTime = (timestamp) => {
  if (!timestamp) {
    return "-";
  }
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

const CATEGORY_LIST = [
  "crypto",
  "indices",
  "commodities",
  "forex",
  "stocks",
  "weather",
];

export const getMarketStats = (db) => {
  try {
    if (!db) {
      return null;
    }

    const totalMarketsRow = db
      .prepare('SELECT COUNT(*) as count FROM tracked_markets')
      .get();
    const resolvedMarketsRow = db
      .prepare('SELECT COUNT(*) as count FROM tracked_markets WHERE outcome IS NOT NULL')
      .get();
    const calibrationRow = db
      .prepare('SELECT AVG(calibration_error) as avg_error FROM v_market_efficiency')
      .get();

    const winRateRows = db
      .prepare(
        `SELECT category,
                COUNT(*) as total,
                SUM(CASE WHEN price_matched_outcome THEN 1 ELSE 0 END) as wins
         FROM v_resolved_markets
         GROUP BY category
         ORDER BY total DESC`
      )
      .all();

    const winRateByCategory = winRateRows.map((row) => {
      const total = row.total || 0;
      const wins = row.wins || 0;
      const rate = total > 0 ? (wins / total) * 100 : null;
      return {
        category: row.category ?? 'unknown',
        winRate: formatNumber(rate, 1),
        total,
      };
    });

    return {
      totalMarkets: totalMarketsRow?.count ?? 0,
      resolvedMarkets: resolvedMarketsRow?.count ?? 0,
      calibrationError: formatNumber(calibrationRow?.avg_error, 3),
      winRateByCategory,
    };
  } catch (error) {
    return null;
  }
};

export const getDetailedMarketStats = (db) => {
  try {
    if (!db) {
      return null;
    }

    const now = Date.now();

    const totalsByCategory = db
      .prepare(
        `SELECT category, COUNT(*) as total
         FROM tracked_markets
         GROUP BY category`,
      )
      .all();

    const activeByCategory = db
      .prepare(
        `SELECT category, COUNT(*) as active
         FROM tracked_markets
         WHERE end_time > ?
         GROUP BY category`,
      )
      .all(now);

    const evaluatedByCategory = db
      .prepare(
        `SELECT tm.category, COUNT(*) as evaluated
         FROM trade_evaluations te
         JOIN tracked_markets tm ON tm.id = te.market_id
         GROUP BY tm.category`,
      )
      .all();

    const skippedByCategory = db
      .prepare(
        `SELECT tm.category, COUNT(*) as skipped
         FROM trade_evaluations te
         JOIN tracked_markets tm ON tm.id = te.market_id
         WHERE te.decision = 'SKIP'
         GROUP BY tm.category`,
      )
      .all();

    const tradedByCategory = db
      .prepare(
        `SELECT tm.category, COUNT(*) as traded
         FROM paper_trades pt
         JOIN tracked_markets tm ON tm.id = pt.market_id
         GROUP BY tm.category`,
      )
      .all();

    const totalMarketsRow = db
      .prepare("SELECT COUNT(*) as count FROM tracked_markets")
      .get();
    const activeMarketsRow = db
      .prepare(
        "SELECT COUNT(*) as count FROM tracked_markets WHERE end_time > ?",
      )
      .get(now);
    const snapshotsRow = db
      .prepare("SELECT COUNT(*) as count FROM market_snapshots")
      .get();
    const evaluationsRow = db
      .prepare("SELECT COUNT(*) as count FROM trade_evaluations")
      .get();
    const skippedEvaluationsRow = db
      .prepare(
        "SELECT COUNT(*) as count FROM trade_evaluations WHERE decision = 'SKIP'",
      )
      .get();
    const tradesRow = db
      .prepare("SELECT COUNT(*) as count FROM paper_trades")
      .get();
    const pendingTradesRow = db
      .prepare(
        "SELECT COUNT(*) as count FROM paper_trades WHERE outcome IS NULL",
      )
      .get();
    const resolvedTradesRow = db
      .prepare(
        "SELECT COUNT(*) as count FROM paper_trades WHERE outcome IS NOT NULL",
      )
      .get();
    const winsRow = db
      .prepare(
        "SELECT COUNT(*) as count FROM paper_trades WHERE outcome = 'win'",
      )
      .get();

    const lastSnapshotRow = db
      .prepare("SELECT MAX(timestamp) as last_time FROM market_snapshots")
      .get();
    const lastEvaluationRow = db
      .prepare("SELECT MAX(timestamp) as last_time FROM trade_evaluations")
      .get();
    const lastTradeRow = db
      .prepare("SELECT MAX(created_at) as last_time FROM paper_trades")
      .get();

    const totalsMap = new Map();
    totalsByCategory.forEach((row) => {
      totalsMap.set(row.category, {
        total: row.total ?? 0,
      });
    });

    const activeMap = new Map();
    activeByCategory.forEach((row) => {
      activeMap.set(row.category, row.active ?? 0);
    });

    const evaluatedMap = new Map();
    evaluatedByCategory.forEach((row) => {
      evaluatedMap.set(row.category, row.evaluated ?? 0);
    });

    const skippedMap = new Map();
    skippedByCategory.forEach((row) => {
      skippedMap.set(row.category, row.skipped ?? 0);
    });

    const tradedMap = new Map();
    tradedByCategory.forEach((row) => {
      tradedMap.set(row.category, row.traded ?? 0);
    });

    const byCategory = CATEGORY_LIST.map((category) => {
      const total = totalsMap.get(category)?.total ?? 0;
      const active = activeMap.get(category) ?? 0;
      const evaluated = evaluatedMap.get(category) ?? 0;
      const skipped = skippedMap.get(category) ?? 0;
      const traded = tradedMap.get(category) ?? 0;

      return {
        category,
        total,
        active,
        evaluated,
        traded,
        skipped,
      };
    });

    const resolvedTrades = resolvedTradesRow?.count ?? 0;
    const wins = winsRow?.count ?? 0;
    const winRate = resolvedTrades > 0 ? (wins / resolvedTrades) * 100 : null;

    return {
      byCategory,
      totals: {
        markets: totalMarketsRow?.count ?? 0,
        activeMarkets: activeMarketsRow?.count ?? 0,
        snapshots: snapshotsRow?.count ?? 0,
        evaluations: evaluationsRow?.count ?? 0,
        skippedEvaluations: skippedEvaluationsRow?.count ?? 0,
        trades: tradesRow?.count ?? 0,
        pendingTrades: pendingTradesRow?.count ?? 0,
        resolvedTrades,
        tradeWins: wins,
        winRate: formatNumber(winRate, 1),
      },
      recentActivity: {
        lastSnapshot: formatTime(lastSnapshotRow?.last_time),
        lastEvaluation: formatTime(lastEvaluationRow?.last_time),
        lastTrade: formatTime(lastTradeRow?.last_time),
      },
    };
  } catch (error) {
    return null;
  }
};
