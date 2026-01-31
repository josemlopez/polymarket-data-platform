export const startDashboard = async ({ verbose = false } = {}) => {
  if (verbose) {
    process.env.LOG_LEVEL = 'debug';
  }

  const { Dashboard } = await import('../tui/dashboard.js');
  const dashboard = new Dashboard();

  console.log('[dashboard] Starting TUI dashboard...');
  dashboard.start();
};

export default startDashboard;
