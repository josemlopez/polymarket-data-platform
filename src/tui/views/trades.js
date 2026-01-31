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

const formatNumber = (value, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return Number(value).toFixed(digits);
};

export const getRecentTrades = (db, limit = 10) => {
  try {
    if (!db) {
      return [];
    }
    const rows = db
      .prepare(
        `SELECT pt.model_name, pt.direction, pt.outcome, pt.pnl, pt.entry_price,
                pt.created_at, pt.stake, pt.model_confidence, pt.model_edge,
                m.market_slug, m.asset_name, m.category, m.timeframe,
                m.start_time, m.end_time
         FROM paper_trades pt
         JOIN tracked_markets m ON pt.market_id = m.id
         ORDER BY pt.created_at DESC
         LIMIT ?`,
      )
      .all(limit);

    return rows.map((row) => ({
      time: formatTimestamp(row.created_at),
      model: row.model_name ?? "—",
      direction: row.direction ?? "—",
      entry: formatNumber(row.entry_price, 3),
      outcome: row.outcome ?? "pending",
      pnl: formatNumber(row.pnl, 2),
      // Extended data for details popup
      stake: formatNumber(row.stake, 2),
      confidence: formatNumber(row.model_confidence * 100, 1),
      edge: formatNumber(row.model_edge * 100, 1),
      marketSlug: row.market_slug ?? "—",
      assetName: row.asset_name ?? "—",
      category: row.category ?? "—",
      timeframe: row.timeframe ?? "—",
      marketUrl: row.market_slug
        ? `https://polymarket.com/event/${row.market_slug}`
        : null,
      startTime: formatTimestamp(row.start_time),
      endTime: formatTimestamp(row.end_time),
    }));
  } catch (error) {
    return [];
  }
};
