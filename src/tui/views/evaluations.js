const HOUR_MS = 60 * 60 * 1000;

export const getEvaluationStats = (db) => {
  try {
    if (!db) {
      return null;
    }

    const since = Date.now() - HOUR_MS;

    const totalEvaluated = db
      .prepare(
        `SELECT COUNT(*) as count
         FROM trade_evaluations
         WHERE timestamp >= ?`
      )
      .get(since)?.count ?? 0;

    const totalSkipped = db
      .prepare(
        `SELECT COUNT(*) as count
         FROM trade_evaluations
         WHERE timestamp >= ?
           AND decision = 'SKIP'`
      )
      .get(since)?.count ?? 0;

    const totalTraded = db
      .prepare(
        `SELECT COUNT(*) as count
         FROM trade_evaluations
         WHERE timestamp >= ?
           AND decision = 'TRADE'`
      )
      .get(since)?.count ?? 0;

    const lastEvaluationTime = db
      .prepare(
        `SELECT MAX(timestamp) as last_time
         FROM trade_evaluations`
      )
      .get()?.last_time ?? null;

    const skipReasons = db
      .prepare(
        `SELECT reason, COUNT(*) as count
         FROM trade_evaluations
         WHERE timestamp >= ?
           AND decision = 'SKIP'
         GROUP BY reason
         ORDER BY count DESC`
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
