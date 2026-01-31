import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLLECTOR_SCRIPTS = {
  polymarket: path.resolve(__dirname, '../collectors/polymarket.service.js'),
  binance: path.resolve(__dirname, '../collectors/binance.service.js'),
  yahoo: path.resolve(__dirname, '../collectors/yahoo.service.js'),
  weather: path.resolve(__dirname, '../collectors/openweather.service.js'),
};

const formatCollectorList = (names) => names.join(', ');

export const startCollectors = ({ collector = null, verbose = false } = {}) => {
  const target = collector ? [collector] : Object.keys(COLLECTOR_SCRIPTS);
  const selected = target.filter((name) => COLLECTOR_SCRIPTS[name]);

  if (selected.length === 0) {
    throw new Error(
      `Unknown collector "${collector}". Use one of: ${formatCollectorList(
        Object.keys(COLLECTOR_SCRIPTS),
      )}`,
    );
  }

  const children = new Map();
  const logPrefix = '[collect]';

  const env = {
    ...process.env,
    ...(verbose ? { LOG_LEVEL: 'debug' } : {}),
  };

  console.log(`${logPrefix} Starting collectors: ${formatCollectorList(selected)}`);

  for (const name of selected) {
    const script = COLLECTOR_SCRIPTS[name];
    const child = spawn(process.execPath, [script], {
      stdio: 'inherit',
      env,
    });

    children.set(name, child);
    console.log(`${logPrefix} ${name} running (pid ${child.pid})`);

    child.on('exit', (code, signal) => {
      children.delete(name);
      const exitLabel = signal ? `signal ${signal}` : `code ${code}`;
      console.log(`${logPrefix} ${name} exited (${exitLabel})`);

      if (children.size === 0) {
        if (code && code !== 0) {
          process.exitCode = code;
        }
        process.exit();
      }
    });
  }

  const shutdown = (signal) => {
    console.log(`${logPrefix} Received ${signal}, stopping collectors...`);
    for (const [name, child] of children.entries()) {
      if (!child.killed) {
        console.log(`${logPrefix} Sending SIGTERM to ${name} (pid ${child.pid})`);
        child.kill('SIGTERM');
      }
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

export default startCollectors;
