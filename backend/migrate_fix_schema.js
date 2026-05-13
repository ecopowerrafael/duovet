const db = require('./db');

async function migrate() {
  const client = await db.pool.connect();
  try {
    console.log('Starting migration...');

    // 0. Check and create users table (Critical for other tables)
    console.log('Checking users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'trial',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Users table verified/created.');

    // 1. Check and create events table
    console.log('Checking events table...');
    await client.query(`
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
    console.log('Events table verified/created.');

    // 1.5 Check and create payments table (before invoices that references it)
    console.log('Checking payments table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        client_id INTEGER,
        amount DECIMAL(10,2),
        date DATE,
        method VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Payments table verified/created.');

    // 1.6 Check and create invoices table
    console.log('Checking invoices table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        client_id INTEGER,
        amount DECIMAL(10,2),
        status VARCHAR(50),
        due_date DATE,
        description TEXT,
        items JSONB,
        created_by VARCHAR(255),
        payment_id INTEGER REFERENCES payments(id),
        created_at TIMESTAMP DEFAULT NOW(),
        notes TEXT,
        nf_data JSONB
      );
    `);
    console.log('Invoices table verified/created.');

    // 2. Check and add payment_id to invoices
    console.log('Checking invoices table schema...');
    const invoicesColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'invoices' AND column_name = 'payment_id'
    `);
    
    if (invoicesColumns.rows.length === 0) {
      console.log('Adding payment_id column to invoices...');
      await client.query(`
        ALTER TABLE invoices 
        ADD COLUMN payment_id INTEGER REFERENCES payments(id);
      `);
      console.log('Column payment_id added.');
    } else {
      console.log('Column payment_id already exists.');
    }

    // 3. Check settings table for user_id
    console.log('Checking settings table schema...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) NOT NULL,
        value TEXT,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(key, user_id)
      );
    `);
    console.log('Settings table verified/created.');
    
    const settingsColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'settings' AND column_name = 'user_id'
    `);

    if (settingsColumns.rows.length === 0) {
      console.log('Adding user_id column to settings...');
      await client.query(`
        ALTER TABLE settings 
        ADD COLUMN user_id INTEGER REFERENCES users(id);
      `);
      console.log('Column user_id added.');
      
      // Add unique constraint for (key, user_id)
      // First drop existing constraint if any (likely 'settings_key_key')
      try {
        await client.query('ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key');
        await client.query('CREATE UNIQUE INDEX IF NOT EXISTS settings_key_user_id_idx ON settings (key, user_id)');
      } catch (e) {
        console.warn('Warning updating settings constraints:', e.message);
      }
    } else {
        console.log('Column user_id already exists.');
    }

    // 4. Check clients table for created_by
    console.log('Checking clients table schema...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        cpf_cnpj VARCHAR(20),
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Clients table verified/created.');
    
    const clientsColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clients' AND column_name = 'created_by'
    `);

    if (clientsColumns.rows.length === 0) {
      console.log('Adding created_by column to clients...');
      await client.query(`
        ALTER TABLE clients 
        ADD COLUMN created_by VARCHAR(255);
      `);
    }

    // 5. Check appointments table for created_by
    console.log('Checking appointments table schema...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        animal_id INTEGER,
        client_id INTEGER,
        date TIMESTAMP,
        description TEXT,
        status VARCHAR(50) DEFAULT 'scheduled',
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Appointments table verified/created.');
    
    const appointmentsColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'appointments' AND column_name = 'created_by'
    `);

    if (appointmentsColumns.rows.length === 0) {
      console.log('Adding created_by column to appointments...');
      await client.query(`
        ALTER TABLE appointments 
        ADD COLUMN created_by VARCHAR(255);
      `);
    }

    // 6. Check payments table for created_by
    console.log('Checking payments table schema...');
    const paymentsColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'payments' AND column_name = 'created_by'
    `);

    if (paymentsColumns.rows.length === 0) {
      console.log('Adding created_by column to payments...');
      await client.query(`
        ALTER TABLE payments 
        ADD COLUMN created_by VARCHAR(255);
      `);
    }
    
    // 7. Check animals table for created_by (good practice)
    console.log('Checking animals table schema...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS animals (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        species VARCHAR(50),
        breed VARCHAR(50),
        age INTEGER,
        weight DECIMAL(5,2),
        client_id INTEGER,
        owner_id INTEGER,
        property_id INTEGER,
        created_by VARCHAR(255),
        birthdate DATE,
        birth_date DATE,
        sex VARCHAR(20),
        identification VARCHAR(100),
        color VARCHAR(50),
        father_id INTEGER,
        mother_id INTEGER,
        father_name VARCHAR(255),
        mother_name VARCHAR(255),
        father_breed VARCHAR(100),
        mother_breed VARCHAR(100),
        father_notes TEXT,
        mother_notes TEXT,
        notes TEXT,
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Animals table verified/created.');
    
    // Check and add missing columns to animals table
    const animalColumnsToCheck = [
        { name: 'owner_id', type: 'INTEGER' },
        { name: 'property_id', type: 'INTEGER' },
        { name: 'birthdate', type: 'DATE' },
        { name: 'birth_date', type: 'DATE' },
        { name: 'sex', type: 'VARCHAR(20)' },
        { name: 'identification', type: 'VARCHAR(100)' },
        { name: 'color', type: 'VARCHAR(50)' },
        { name: 'father_id', type: 'INTEGER' },
        { name: 'mother_id', type: 'INTEGER' },
        { name: 'father_name', type: 'VARCHAR(255)' },
        { name: 'mother_name', type: 'VARCHAR(255)' },
        { name: 'father_breed', type: 'VARCHAR(100)' },
        { name: 'mother_breed', type: 'VARCHAR(100)' },
        { name: 'father_notes', type: 'TEXT' },
        { name: 'mother_notes', type: 'TEXT' },
        { name: 'notes', type: 'TEXT' },
        { name: 'status', type: 'VARCHAR(50)' },
        { name: 'created_by', type: 'VARCHAR(255)' }
    ];

    for (const col of animalColumnsToCheck) {
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'animals' AND column_name = '${col.name}'
        `);
        
        if (res.rows.length === 0) {
            console.log(`Adding ${col.name} column to animals...`);
            await client.query(`ALTER TABLE animals ADD COLUMN ${col.name} ${col.type}`);
        }
    }

    // 8. Check and create vet_profiles table
    console.log('Checking vet_profiles table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS vet_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        bio TEXT,
        specialty VARCHAR(255),
        crmv VARCHAR(50),
        photo_url VARCHAR(255),
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Vet profiles table verified/created.');

    // 9. Check and create events table
    console.log('Checking events table...');
    await client.query(`
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
        status VARCHAR(50) DEFAULT 'scheduled',
        reminder_1day BOOLEAN DEFAULT false,
        reminder_1hour BOOLEAN DEFAULT false,
        reminder_15min BOOLEAN DEFAULT false,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Events table verified/created.');
    
    // 10. Check and create prescriptions table

    console.log('Checking prescriptions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id SERIAL PRIMARY KEY,
        client_id INTEGER,
        animal_ids INTEGER[],
        appointment_id INTEGER,
        date TIMESTAMP,
        medications JSONB,
        notes TEXT,
        symptoms TEXT,
        diagnosis TEXT,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Prescriptions table verified/created.');

    // Add missing columns to prescriptions if they don't exist
    const prescriptionColumnsToCheck = [
      { name: 'symptoms', type: 'TEXT' },
      { name: 'diagnosis', type: 'TEXT' }
    ];

    for (const col of prescriptionColumnsToCheck) {
      const res = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'prescriptions' AND column_name = '${col.name}'
      `);
      
      if (res.rows.length === 0) {
          console.log(`Adding ${col.name} column to prescriptions...`);
          await client.query(`ALTER TABLE prescriptions ADD COLUMN ${col.name} ${col.type}`);
      }
    }

    // 11. Check and create properties table
    console.log('Checking properties table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id),
        name VARCHAR(255) NOT NULL,
        address TEXT,
        details JSONB,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Properties table verified/created.');

    // 11.5 Check and create protocols table
    console.log('Checking protocols table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS protocols (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        type VARCHAR(50),
        subtype VARCHAR(50),
        description TEXT,
        default_procedures JSONB,
        default_medications JSONB,
        follow_up_days INTEGER,
        observations_template TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Protocols table verified/created.');
    
    // 12. Apply updates from update_schema.js (Missing columns in Clients, Animals, Appointments)
    console.log('Applying additional schema updates...');

    // Clients
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS document VARCHAR(50);`);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;`);
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS type VARCHAR(50);`);

    // Animals
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS sex VARCHAR(20);`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS identification VARCHAR(100);`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS color VARCHAR(50);`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS weight VARCHAR(50);`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS property_id INTEGER;`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS father_id INTEGER;`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS mother_id INTEGER;`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS father_name VARCHAR(255);`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS mother_name VARCHAR(255);`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS father_breed VARCHAR(100);`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS mother_breed VARCHAR(100);`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS father_notes TEXT;`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS mother_notes TEXT;`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS notes TEXT;`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS status VARCHAR(50);`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS birth_date TIMESTAMP;`);
    
    // Attempt to migrate birthdate to birth_date if needed
    try {
       await client.query(`UPDATE animals SET birth_date = birthdate WHERE birth_date IS NULL AND birthdate IS NOT NULL;`);
    } catch (e) {
       console.log('Note: Could not migrate birthdate (column might not exist or data issue)');
    }

    // Appointments
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS animal_ids INTEGER[];`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS property_id INTEGER;`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS type VARCHAR(50);`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS subtype VARCHAR(50);`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS symptoms TEXT;`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS diagnosis TEXT;`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS observations TEXT;`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS procedures JSONB;`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS medications JSONB;`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reproductive_data JSONB;`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS andrological_data JSONB;`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS consultoria_data JSONB;`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS photos JSONB;`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2);`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS displacement_cost NUMERIC(10,2);`);
    
    // Return (Retorno) fields
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS needs_return BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS return_date TIMESTAMP;`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS return_time VARCHAR(20);`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS return_type VARCHAR(50);`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS return_notes TEXT;`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS return_status VARCHAR(50);`);

    // Prescriptions updates
    await client.query(`ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS animal_ids INTEGER[];`);
    await client.query(`ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS appointment_id INTEGER;`);
    await client.query(`ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS date TIMESTAMP;`);

    // Payments updates
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2);`);
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;`);
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;`);
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS appointment_id INTEGER;`);

    // 12. Check and create contracts table
    console.log('Checking contracts table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS contracts (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        property_id INTEGER,
        contract_type VARCHAR(50),
        billing_frequency VARCHAR(50),
        amount NUMERIC(10, 2),
        payment_method VARCHAR(50),
        start_date DATE,
        next_billing_date DATE,
        status VARCHAR(50) DEFAULT 'ativo',
        issue_invoice BOOLEAN DEFAULT FALSE,
        description TEXT,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Contracts table verified/created.');

    console.log('Checking consultancies table...');
    await client.query(`
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
        payment_date DATE,
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
    console.log('Consultancies table verified/created.');

    // Subscriptions table
    console.log('Checking subscriptions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        status VARCHAR(50) DEFAULT 'trialing',
        plan VARCHAR(50) DEFAULT 'profissional',
        billing_period VARCHAR(20) DEFAULT 'monthly',
        amount NUMERIC(10, 2),
        trial_end_date TIMESTAMP,
        next_billing_date TIMESTAMP,
        stripe_subscription_id VARCHAR(255),
        stripe_customer_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'profissional'`);
    await client.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_period VARCHAR(20) DEFAULT 'monthly'`);
    await client.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2)`);
    await client.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP`);
    await client.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP`);
    await client.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255)`);
    await client.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)`);
    console.log('Subscriptions table verified/created.');

    console.log('Checking tickets table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        ticket_code VARCHAR(30),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        assigned_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        subject VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(30) DEFAULT 'open',
        priority VARCHAR(30) DEFAULT 'normal',
        messages JSONB DEFAULT '[]'::jsonb,
        created_by VARCHAR(255),
        last_user_message_at TIMESTAMP,
        last_admin_message_at TIMESTAMP,
        closed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_code VARCHAR(30)`);
    await client.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'open'`);
    await client.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority VARCHAR(30) DEFAULT 'normal'`);
    await client.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]'::jsonb`);
    await client.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS last_user_message_at TIMESTAMP`);
    await client.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS last_admin_message_at TIMESTAMP`);
    await client.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP`);
    await client.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_ticket_code_unique ON tickets(ticket_code) WHERE ticket_code IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON tickets(updated_at DESC)`);
    console.log('Tickets table verified/created.');

    console.log('Additional schema updates applied.');

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

migrate();
