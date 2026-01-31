export class ResultChecker {
  constructor({ db }) {
    if (!db) {
      throw new Error('ResultChecker requires db');
    }
    this.db = db;
    this.updateResultStmt = this.db.db.prepare(`
      UPDATE paper_trades
      SET outcome = @outcome,
          pnl = @pnl,
          exit_price = @exit_price,
          resolved_at = @resolved_at
      WHERE id = @id
    `);
  }

  checkAndUpdate(trade, actualOutcome) {
    if (!trade || !actualOutcome) {
      return null;
    }

    const won = trade.direction === actualOutcome;
    const outcome = won ? 'win' : 'loss';
    const stake = trade.stake || 0;
    const entryPrice = trade.entry_price || 0;

    let pnl = -stake;
    let exitPrice = 0;

    if (won) {
      pnl = stake * ((1 / entryPrice) - 1);
      exitPrice = 1;
    }

    return this.updateResultStmt.run({
      id: trade.id,
      outcome,
      pnl,
      exit_price: exitPrice,
      resolved_at: Date.now(),
    });
  }
}
