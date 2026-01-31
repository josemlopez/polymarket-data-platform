const formatRelativeTime = (timestamp) => {
  if (!timestamp) {
    return '—';
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

const formatUptime = (startedAt) => {
  if (!startedAt) {
    return '—';
  }
  return formatRelativeTime(startedAt).replace('ago', 'up');
};

export const getServiceHealth = (db) => {
  try {
    if (!db) {
      return [];
    }

    const services = db
      .prepare(
        `SELECT collector_name, started_at, status, errors_count
         FROM collector_status
         ORDER BY collector_name ASC`
      )
      .all();

    return services.map((service) => {
      let lastError = null;
      try {
        lastError = db
          .prepare(
            `SELECT timestamp, message
             FROM collector_logs
             WHERE collector_name = ?
               AND level = 'ERROR'
             ORDER BY timestamp DESC
             LIMIT 1`
          )
          .get(service.collector_name);
      } catch (error) {
        lastError = null;
      }

      return {
        name: service.collector_name,
        status: service.status ?? 'unknown',
        uptime: formatUptime(service.started_at),
        errors: service.errors_count ?? 0,
        lastErrorTime: lastError?.timestamp ? formatRelativeTime(lastError.timestamp) : '—',
        lastErrorMessage: lastError?.message ?? '—',
      };
    });
  } catch (error) {
    return [];
  }
};
