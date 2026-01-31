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

const formatNumber = (value, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
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
        `SELECT model_name, direction, outcome, pnl, entry_price, created_at
         FROM paper_trades
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(limit);

    return rows.map((row) => ({
      time: formatTimestamp(row.created_at),
      model: row.model_name ?? '—',
      direction: row.direction ?? '—',
      entry: formatNumber(row.entry_price, 3),
      outcome: row.outcome ?? 'pending',
      pnl: formatNumber(row.pnl, 2),
    }));
  } catch (error) {
    return [];
  }
};
