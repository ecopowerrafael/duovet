const db = require('./db');

async function migrateSettings() {
  try {
    console.log('Migrating settings table to support multi-tenancy...');

    // 1. Add user_id column
    await db.query(`
      ALTER TABLE settings 
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    `);

    // 2. Drop existing primary key constraint
    // We need to find the constraint name or just try to drop the PK
    await db.query(`
      DO $$ 
      BEGIN 
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_pkey') THEN 
          ALTER TABLE settings DROP CONSTRAINT settings_pkey; 
        END IF; 
      END $$;
    `);

    // 3. Clear existing settings to avoid violation (or we could assign to a default user, but clearing is safer for dev)
    // Actually, if we add user_id and it's null, we can't make it part of PK easily if we want strictness.
    // Let's delete existing rows where user_id is NULL
    await db.query('DELETE FROM settings WHERE user_id IS NULL');

    // 4. Make user_id NOT NULL (optional, but good for data integrity)
    // await db.query('ALTER TABLE settings ALTER COLUMN user_id SET NOT NULL');
    // For now, let's allow NULL for "system" settings if needed, but for now we enforce user settings.
    // Let's just create a unique index instead of PK to be flexible, or composite PK.
    
    // Let's use a unique constraint on key + user_id
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS settings_key_user_idx ON settings (key, user_id);
    `);

    console.log('Settings table migrated successfully.');
  } catch (err) {
    console.error('Error migrating settings:', err);
  } finally {
    // We don't close pool here because it might be used by the app, but if run standalone:
    // pool.end();
    process.exit(0);
  }
}

migrateSettings();
