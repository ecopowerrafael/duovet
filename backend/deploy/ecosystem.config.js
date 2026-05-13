module.exports = {
  apps: [
    {
      name: 'duovet-api',
      script: './index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        PORT: 4000,
        FRONTEND_URL: 'https://duovet.app',
        BACKEND_URL: 'https://duovet.app/api',
        // GOOGLE_CLIENT_ID: '',
        // GOOGLE_CLIENT_SECRET: '',
        PGUSER: 'postgres',
        PGHOST: 'localhost',
        PGDATABASE: 'duovet',
        PGPASSWORD: 'postgres',
        PGPORT: 5432,
        JWT_SECRET: 'troque_este_segredo'
      }
    }
  ]
}
