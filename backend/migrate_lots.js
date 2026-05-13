const db = require('./db');

async function migrateLots() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Creating lots table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS lots (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        species VARCHAR(50),
        quantity INTEGER DEFAULT 0,
        notes TEXT,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('Adding lot_id to appointments table...');
    await client.query(`
      ALTER TABLE appointments 
      ADD COLUMN IF NOT EXISTS lot_id INTEGER REFERENCES lots(id) ON DELETE SET NULL;
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.log('Migration failed:', err.message);
  } finally {
    client.release();
  }
}

migrateLots();
