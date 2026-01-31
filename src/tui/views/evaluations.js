const HOUR_MS = 60 * 60 * 1000;

const formatEdge = (edge) => {
  if (edge === null || edge === undefined) return "—";
  return `${(edge * 100).toFixed(1)}%`;
};

export const getEvaluationStats = (db) => {
  try {
    if (!db) {
      return null;
    }

    const since = Date.now() - HOUR_MS;

    const totalEvaluated =
      db
        .prepare(
          `SELECT COUNT(*) as count
         FROM trade_evaluations
         WHERE timestamp >= ?`,
        )
        .get(since)?.count ?? 0;

    const totalSkipped =
      db
        .prepare(
          `SELECT COUNT(*) as count
         FROM trade_evaluations
         WHERE timestamp >= ?
           AND decision = 'SKIP'`,
        )
        .get(since)?.count ?? 0;

    const totalTraded =
      db
        .prepare(
          `SELECT COUNT(*) as count
         FROM trade_evaluations
         WHERE timestamp >= ?
           AND decision = 'TRADE'`,
        )
        .get(since)?.count ?? 0;

    const lastEvaluationTime =
      db
        .prepare(
          `SELECT MAX(timestamp) as last_time
         FROM trade_evaluations`,
        )
        .get()?.last_time ?? null;

    const skipReasons = db
      .prepare(
        `SELECT reason, COUNT(*) as count
         FROM trade_evaluations
         WHERE timestamp >= ?
           AND decision = 'SKIP'
         GROUP BY reason
         ORDER BY count DESC`,
      )
      .all(since)
      .map((row) => ({
        reason: row.reason || "unknown",
        count: row.count ?? 0,
      }));

    return {
      totalEvaluated,
      totalSkipped,
      totalTraded,
      lastEvaluationTime,
      skipReasons,
    };
  } catch (error) {
    return null;
  }
};

// Get evaluations grouped by market with best opportunities
export const getEvaluationsByMarket = (db, limit = 10) => {
  try {
    if (!db) {
      return [];
    }

    const since = Date.now() - HOUR_MS;

    // Get markets with highest average edge and most activity
    const rows = db
      .prepare(
        `SELECT
           te.market_slug,
           tm.asset_name,
           tm.category,
           COUNT(*) as eval_count,
           SUM(CASE WHEN te.decision = 'TRADE' THEN 1 ELSE 0 END) as trades,
           SUM(CASE WHEN te.decision = 'SKIP' THEN 1 ELSE 0 END) as skips,
           MAX(te.edge) as max_edge,
           AVG(te.edge) as avg_edge,
           MAX(te.model_confidence) as max_conf,
           te.direction as last_direction
         FROM trade_evaluations te
         LEFT JOIN tracked_markets tm ON tm.id = te.market_id
         WHERE te.timestamp >= ?
         GROUP BY te.market_slug
         ORDER BY max_edge DESC, eval_count DESC
         LIMIT ?`,
      )
      .all(since, limit);

    return rows.map((row) => ({
      slug: row.market_slug?.substring(0, 25) || "—",
      asset: row.asset_name || "—",
      category: row.category || "—",
      evals: row.eval_count || 0,
      trades: row.trades || 0,
      skips: row.skips || 0,
      maxEdge: formatEdge(row.max_edge),
      avgEdge: formatEdge(row.avg_edge),
      maxConf: row.max_conf ? `${(row.max_conf * 100).toFixed(0)}%` : "—",
      direction: row.last_direction || "—",
    }));
  } catch (error) {
    return [];
  }
};

// Get recent individual evaluations
export const getRecentEvaluations = (db, limit = 20) => {
  try {
    if (!db) {
      return [];
    }

    const rows = db
      .prepare(
        `SELECT
           te.timestamp,
           te.market_slug,
           tm.asset_name,
           te.direction,
           te.edge,
           te.model_confidence,
           te.decision,
           te.reason
         FROM trade_evaluations te
         LEFT JOIN tracked_markets tm ON tm.id = te.market_id
         ORDER BY te.timestamp DESC
         LIMIT ?`,
      )
      .all(limit);

    return rows.map((row) => {
      const time = new Date(row.timestamp);
      const hh = String(time.getHours()).padStart(2, "0");
      const mm = String(time.getMinutes()).padStart(2, "0");
      const ss = String(time.getSeconds()).padStart(2, "0");
      return {
        time: `${hh}:${mm}:${ss}`,
        asset: row.asset_name || row.market_slug?.substring(0, 10) || "—",
        direction: row.direction || "—",
        edge: formatEdge(row.edge),
        conf: row.model_confidence
          ? `${(row.model_confidence * 100).toFixed(0)}%`
          : "—",
        decision: row.decision || "—",
        reason: row.reason?.substring(0, 12) || "—",
      };
    });
  } catch (error) {
    return [];
  }
};
