export class Logger {
  constructor({ name, level = 'info', db = null }) {
    if (!name) {
      throw new Error('Logger requires a name');
    }
    this.name = name;
    this.level = level;
    this.db = db;

    this.levels = {
      debug: 10,
      info: 20,
      warn: 30,
      error: 40,
    };
  }

  debug(message, details) {
    this._log('debug', message, details);
  }

  info(message, details) {
    this._log('info', message, details);
  }

  warn(message, details) {
    this._log('warn', message, details);
  }

  error(message, details) {
    this._log('error', message, details);
  }

  _log(level, message, details) {
    if (this.levels[level] < this.levels[this.level]) return;

    const timestamp = new Date().toISOString();
    const levelLabel = level.toUpperCase();
    const base = `[${timestamp}] [${levelLabel}] [${this.name}] ${message}`;

    if (level === 'error') {
      console.error(base);
    } else if (level === 'warn') {
      console.warn(base);
    } else {
      console.log(base);
    }

    if (this.db && typeof this.db.logCollector === 'function') {
      try {
        const payload = details && typeof details === 'object' ? JSON.stringify(details) : details;
        this.db.logCollector(this.name, levelLabel, message, payload ?? null);
      } catch (error) {
        const fallback = `[${timestamp}] [WARN] [${this.name}] Failed to log to database: ${error.message || error}`;
        console.warn(fallback);
      }
    }
  }
}
