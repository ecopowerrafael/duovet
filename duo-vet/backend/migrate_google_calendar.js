const db = require('./db');

async function migrateGoogleCalendar() {
  try {
    console.log('Starting Google Calendar migration...');

    // Update users table
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS google_access_token TEXT,
      ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
      ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMP;
    `);
    console.log('Users table updated with Google tokens columns.');

    // Update events table
    await db.query(`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS is_synced BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS sync_pending BOOLEAN DEFAULT FALSE;
    `);
    console.log('Events table updated with Google Calendar columns.');

    console.log('Google Calendar migration completed successfully.');
  } catch (err) {
    console.error('Error in Google Calendar migration:', err);
  }
}

if (require.main === module) {
  migrateGoogleCalendar().then(() => process.exit());
}

module.exports = migrateGoogleCalendar;
