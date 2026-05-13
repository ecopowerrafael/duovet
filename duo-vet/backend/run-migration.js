const migrateDatabase = require('./migrate_db');
migrateDatabase()
  .then(() => {
    console.log('Migration finished');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
