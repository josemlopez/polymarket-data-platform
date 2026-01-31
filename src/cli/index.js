#!/usr/bin/env node
import { Command } from 'commander';
import startCollectors from './collect.js';
import startPaperTrader from './paper.js';
import startDashboard from './dashboard.js';

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return 'never';
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const program = new Command();

program
  .name('polymarket')
  .description('Polymarket data platform CLI')
  .option('-v, --verbose', 'enable debug logging');

program
  .command('collect [collector]')
  .description('Start collectors (polymarket, binance, yahoo, weather)')
  .action(async (collector) => {
    const { verbose } = program.opts();
    try {
      await startCollectors({ collector, verbose });
    } catch (error) {
      console.error(`[collect] ${error.message || error}`);
      process.exitCode = 1;
    }
  });

program
  .command('paper')
  .description('Start paper trading service')
  .action(async () => {
    const { verbose } = program.opts();
    await startPaperTrader({ verbose });
  });

program
  .command('dashboard')
  .description('Start the TUI dashboard')
  .action(async () => {
    const { verbose } = program.opts();
    await startDashboard({ verbose });
  });

program
  .command('status')
  .description('Show quick status from the database')
  .action(async () => {
    const { verbose } = program.opts();
    if (verbose) {
      process.env.LOG_LEVEL = 'debug';
    }

    try {
      const { Database } = await import('../shared/db.js');
      const { DATABASE_PATH } = await import('../shared/config.js');

      const db = new Database({ databasePath: DATABASE_PATH });
      await db.initialize();

      const collectors = db.db
        .prepare(
          `SELECT collector_name, status, last_heartbeat, items_collected, errors_count
           FROM collector_status
           ORDER BY collector_name ASC`,
        )
        .all();

      console.log('Collector status:');
      if (collectors.length === 0) {
        console.log('- No collectors recorded yet');
      } else {
        for (const row of collectors) {
          const heartbeat = formatRelativeTime(row.last_heartbeat);
          const items = row.items_collected ?? 0;
          const errors = row.errors_count ?? 0;
          const status = row.status ?? 'unknown';
          console.log(
            `- ${row.collector_name}: ${status} (heartbeat ${heartbeat}, items ${items}, errors ${errors})`,
          );
        }
      }

      const counts = db.db
        .prepare(
          `SELECT
            (SELECT COUNT(*) FROM tracked_markets) AS markets,
            (SELECT COUNT(*) FROM market_snapshots) AS snapshots,
            (SELECT COUNT(*) FROM asset_candles) AS candles,
            (SELECT COUNT(*) FROM weather_snapshots) AS weather,
            (SELECT COUNT(*) FROM paper_trades) AS trades`,
        )
        .get();

      console.log('Database totals:');
      console.log(
        `- markets ${counts.markets}, snapshots ${counts.snapshots}, candles ${counts.candles}, weather ${counts.weather}, trades ${counts.trades}`,
      );

      db.close();
    } catch (error) {
      console.error(`[status] Failed to load status: ${error.message || error}`);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
