const db = require('./db');

async function setupEventsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        event_type VARCHAR(50),
        start_datetime TIMESTAMP,
        end_datetime TIMESTAMP,
        client_id INTEGER,
        property_id INTEGER,
        animal_ids INTEGER[],
        appointment_type VARCHAR(50),
        location VARCHAR(255),
        notes TEXT,
        status VARCHAR(50) DEFAULT 'agendado',
        reminder_1day BOOLEAN DEFAULT FALSE,
        reminder_1hour BOOLEAN DEFAULT FALSE,
        reminder_15min BOOLEAN DEFAULT FALSE,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Events table created/verified successfully.');

    // Invoices table
    await db.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        client_id INTEGER,
        amount NUMERIC(10,2),
        status VARCHAR(50) DEFAULT 'pendente',
        due_date TIMESTAMP,
        description TEXT,
        items JSONB,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Invoices table created/verified successfully.');

    // Notifications table
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50),
        title VARCHAR(255),
        description TEXT,
        status VARCHAR(50) DEFAULT 'unread',
        created_by VARCHAR(255),
        related_entity_type VARCHAR(50),
        related_entity_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Notifications table created/verified successfully.');

    // Properties table
    await db.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        client_id INTEGER,
        name VARCHAR(255),
        address TEXT,
        details JSONB,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Properties table created/verified successfully.');

  } catch (err) {
    console.error('Error creating events table:', err);
  }
}

module.exports = setupEventsTable;
