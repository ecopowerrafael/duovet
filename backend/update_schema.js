const db = require('./db');

async function updateSchema() {
  try {
    console.log('Updating schema...');

    // Clients
    await db.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS document VARCHAR(50);`);
    await db.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;`);
    await db.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS type VARCHAR(50);`);

    // Animals
    await db.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS sex VARCHAR(20);`);
    await db.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS identification VARCHAR(100);`);
    await db.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS color VARCHAR(50);`);
    await db.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS weight VARCHAR(50);`);
    await db.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS property_id INTEGER;`);
    await db.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS father_id INTEGER;`);
    await db.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS mother_id INTEGER;`);
    await db.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS father_name VARCHAR(255);`);
    await db.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS mother_name VARCHAR(255);`);
    await db.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS father_breed VARCHAR(100);`);
    await db.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS mother_breed VARCHAR(100);`);
    await db.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS father_notes TEXT;`);
    await db.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS mother_notes TEXT;`);
    await db.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS notes TEXT;`);
    await db.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS status VARCHAR(50);`);
    await db.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS birth_date TIMESTAMP;`);
    
    // Attempt to migrate birthdate to birth_date if needed
    try {
       await db.query(`UPDATE animals SET birth_date = birthdate WHERE birth_date IS NULL AND birthdate IS NOT NULL;`);
    } catch (e) {
       console.log('Note: Could not migrate birthdate (column might not exist)');
    }

    // Appointments
    await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS animal_ids INTEGER[];`);
    await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS property_id INTEGER;`);
    await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS type VARCHAR(50);`);
    await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS subtype VARCHAR(50);`);
    await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS symptoms TEXT;`);
    await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS diagnosis TEXT;`);
    await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS observations TEXT;`);
    await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS procedures JSONB;`);
    await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS medications JSONB;`);
    await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reproductive_data JSONB;`);
    await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS andrological_data JSONB;`);
    await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS consultoria_data JSONB;`);
    await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS photos JSONB;`);
    await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2);`);
            await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS displacement_cost NUMERIC(10,2);`);
            
            // Return (Retorno) fields
            await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS needs_return BOOLEAN DEFAULT FALSE;`);
            await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS return_date TIMESTAMP;`);
            await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS return_type VARCHAR(50);`);
            await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS return_notes TEXT;`);
            await db.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS return_status VARCHAR(50);`);

            // Stock movements
            await db.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS prescription_id INTEGER REFERENCES prescriptions(id) ON DELETE SET NULL;`);

            await db.query(`
              CREATE TABLE IF NOT EXISTS consultancies (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
                property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
                type VARCHAR(50) DEFAULT 'pontual',
                technical_area VARCHAR(100),
                scope TEXT,
                start_date DATE,
                end_date DATE,
                status VARCHAR(50) DEFAULT 'ativa',
                frequency VARCHAR(50),
                next_return_date DATE,
                value NUMERIC(10, 2),
                billing_type VARCHAR(50),
                observations TEXT,
                technical_notes TEXT,
                start_time VARCHAR(20),
                end_time VARCHAR(20),
                created_by VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
              );
            `);
            await db.query(`ALTER TABLE consultancies ADD COLUMN IF NOT EXISTS payment_date DATE;`);

            console.log('Schema updated successfully.');
  } catch (err) {
    console.error('Error updating schema:', err);
  } finally {
      process.exit();
  }
}

updateSchema();
