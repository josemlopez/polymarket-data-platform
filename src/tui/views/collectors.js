const formatRelativeTime = (timestamp) => {
  if (!timestamp) {
    return 'Never';
  }
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const getCollectorData = (db) => {
  try {
    if (!db) {
      return [];
    }
    const rows = db
      .prepare(
        `SELECT collector_name, status, last_heartbeat, items_collected
         FROM collector_status
         ORDER BY collector_name ASC`
      )
      .all();

    return rows.map((row) => ({
      name: row.collector_name,
      status: row.status ?? 'unknown',
      lastHeartbeat: formatRelativeTime(row.last_heartbeat),
      itemsCollected: row.items_collected ?? 0,
    }));
  } catch (error) {
    return [];
  }
};
