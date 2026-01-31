const formatNumber = (value, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return Number(value).toFixed(digits);
};

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
