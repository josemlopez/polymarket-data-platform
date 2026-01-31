export class ServiceBase {
  constructor({ name, logger }) {
    if (!name) {
      throw new Error('ServiceBase requires a name');
    }
    this.name = name;
    this.logger = logger;
    this.stopping = false;

    this._handleSignal = this._handleSignal.bind(this);
    process.on('SIGTERM', this._handleSignal);
    process.on('SIGINT', this._handleSignal);
  }

  async run() {
    throw new Error('run() must be implemented by subclass');
  }

  async cleanup() {
    throw new Error('cleanup() must be implemented by subclass');
  }

  async start() {
    try {
      await this.run();
    } catch (error) {
      if (!this.stopping) {
        this._log('error', 'Service crashed', { error: this._serializeError(error) });
      }
      throw error;
    }
  }

  async stop() {
    if (this.stopping) return;
    this.stopping = true;
    try {
      await this.cleanup();
    } catch (error) {
      this._log('error', 'Cleanup failed', { error: this._serializeError(error) });
    }
  }

  _log(level, message, details) {
    if (!this.logger) return;
    const method = this.logger[level] || this.logger.info;
    method.call(this.logger, message, details);
  }

  _serializeError(error) {
    if (!error) return null;
    return {
      message: error.message || String(error),
      stack: error.stack,
      name: error.name,
    };
  }

  _handleSignal(signal) {
    this._log('info', `Received ${signal}, shutting down...`);
    this.stop().then(() => {
      process.exit(0);
    });
  }
}
