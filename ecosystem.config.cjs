module.exports = {
  apps: [
    {
      name: 'collector-polymarket',
      script: 'src/collectors/polymarket.service.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '200M',
    },
    {
      name: 'collector-binance',
      script: 'src/collectors/binance.service.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '200M',
    },
    {
      name: 'collector-yahoo',
      script: 'src/collectors/yahoo.service.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '200M',
    },
    {
      name: 'paper-trader',
      script: 'src/paper/paper-trader.service.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '200M',
    },
  ],
};
