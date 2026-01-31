export const startPaperTrader = async ({ verbose = false } = {}) => {
  if (verbose) {
    process.env.LOG_LEVEL = 'debug';
  }

  const { PaperTraderService } = await import('../paper/paper-trader.service.js');
  const service = new PaperTraderService();

  try {
    await service.start();
  } catch (error) {
    service.logger?.error('Paper trader exited with error', {
      error: service._serializeError?.(error) ?? {
        message: error?.message ?? String(error),
      },
    });
    process.exitCode = 1;
  }
};

export default startPaperTrader;
