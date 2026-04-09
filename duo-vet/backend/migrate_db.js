
const db = require('./db');

async function migrateDatabase() {
  console.log('Starting database migration...');
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    const tables = [
      'clients', 'animals', 'appointments', 'payments', 
      'events', 'invoices', 'notifications', 'properties',
      'vet_profiles', 'contracts', 'consultancies', 'expenses', 'lots',
      'prescriptions', 'protocols', 'subscriptions', 'tickets'
    ];

    for (const table of tables) {
      // Check if table exists
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);

      if (tableExists.rows[0].exists) {
        // Check if created_by column exists
        const columnExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = $1 
            AND column_name = 'created_by'
          );
        `, [table]);

        if (!columnExists.rows[0].exists) {
          console.log(`Adding created_by column to ${table}...`);
          await client.query(`ALTER TABLE ${table} ADD COLUMN created_by VARCHAR(255)`);
        } else {
          // console.log(`Column created_by already exists in ${table}.`);
        }
      }
    }

    // Special checks for other columns that might be missing
     
     // Clients: document, notes, type
     const clientsTableExists = await client.query(`
       SELECT EXISTS (
         SELECT FROM information_schema.tables 
         WHERE table_schema = 'public' 
         AND table_name = 'clients'
       );
     `);
     if (clientsTableExists.rows[0].exists) {
       const clientCols = ['document', 'notes', 'type'];
       for (const col of clientCols) {
         const colExists = await client.query(`
           SELECT EXISTS (
             SELECT FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'clients' 
             AND column_name = $1
           );
         `, [col]);
         if (!colExists.rows[0].exists) {
           console.log(`Adding ${col} column to clients...`);
           await client.query(`ALTER TABLE clients ADD COLUMN ${col} TEXT`);
         }
       }
     }

    // Users: status
    const usersTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (usersTableExists.rows[0].exists) {
       const statusExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = 'status'
          );
        `);
        if (!statusExists.rows[0].exists) {
            console.log('Adding status column to users...');
            await client.query("ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'trial'");
        }

        const resetTokenExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = 'reset_token'
          );
        `);
        if (!resetTokenExists.rows[0].exists) {
            console.log('Adding reset_token columns to users...');
            await client.query("ALTER TABLE users ADD COLUMN reset_token VARCHAR(255)");
            await client.query("ALTER TABLE users ADD COLUMN reset_token_expiry TIMESTAMP");
        }
    }

    // Invoices: items, due_date
    const invoicesTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'invoices'
      );
    `);

    if (invoicesTableExists.rows[0].exists) {
        const itemsExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'invoices' 
            AND column_name = 'items'
          );
        `);
        if (!itemsExists.rows[0].exists) {
            console.log('Adding items column to invoices...');
            await client.query("ALTER TABLE invoices ADD COLUMN items JSONB");
        }
    }

    // Settings: user_id (Multi-tenancy support)
    const settingsTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'settings'
      );
    `);

    if (settingsTableExists.rows[0].exists) {
        const userIdExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'settings' 
            AND column_name = 'user_id'
          );
        `);
        if (!userIdExists.rows[0].exists) {
            console.log('Migrating settings table for multi-tenancy...');
            await client.query("ALTER TABLE settings ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
            // Remove old PK constraint if it exists (assuming it was on 'key')
            await client.query("DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_pkey') THEN ALTER TABLE settings DROP CONSTRAINT settings_pkey; END IF; END $$;");
            // Create new unique index
            await client.query("CREATE UNIQUE INDEX IF NOT EXISTS settings_key_user_idx ON settings (key, user_id)");
            // Create partial unique index for global settings (where user_id is NULL)
            await client.query("CREATE UNIQUE INDEX IF NOT EXISTS settings_key_global_idx ON settings (key) WHERE user_id IS NULL");
            // Optional: Remove global settings that might conflict or leave them as system defaults (user_id IS NULL)
            // For now, we leave them.
        }

        // Add index on user_id for core tables if not exists
        const indexedTables = ['clients', 'animals', 'appointments', 'payments', 'expenses', 'properties', 'lots'];
        for (const table of indexedTables) {
          const tableExists = await client.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = $1
            );
          `, [table]);
          
          if (tableExists.rows[0].exists) {
            const columnExists = await client.query(`
              SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = $1 
                AND column_name = 'created_by'
              );
            `, [table]);

            if (columnExists.rows[0].exists) {
              await client.query(`CREATE INDEX IF NOT EXISTS idx_${table}_created_by ON ${table} (created_by)`);
            }
          }
        }
    }

    const appointmentsTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
      );
    `);
    if (appointmentsTableExists.rows[0].exists) {
      await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS photos JSONB`);
    }

    // Events: appointment_id (link to appointments)
    const eventsTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'events'
      );
    `);

    if (eventsTableExists.rows[0].exists) {
        const appointmentIdExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'events' 
            AND column_name = 'appointment_id'
          );
        `);
        if (!appointmentIdExists.rows[0].exists) {
            console.log('Adding appointment_id column to events...');
            await client.query("ALTER TABLE events ADD COLUMN appointment_id INTEGER");
            await client.query("CREATE INDEX IF NOT EXISTS idx_events_appointment_id ON events (appointment_id)");
        }
    }

    // Products table (Inventory)
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        unit VARCHAR(50),
        current_stock NUMERIC(10, 2) DEFAULT 0,
        minimum_stock NUMERIC(10, 2) DEFAULT 0,
        cost_price NUMERIC(10, 2) DEFAULT 0,
        sale_price NUMERIC(10, 2) DEFAULT 0,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Stock movements table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL, -- 'in' or 'out'
        quantity NUMERIC(10, 2) NOT NULL,
        reason VARCHAR(255),
        date TIMESTAMP DEFAULT NOW(),
        appointment_id INTEGER, -- Loose coupling, no FK to allow deleting appointments without losing movement history or vice versa
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Product categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

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
        created_by VARCHAR(255),
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
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_ticket_code_unique ON tickets(ticket_code) WHERE ticket_code IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON tickets(updated_at DESC)`);

    await client.query('COMMIT');
    console.log('Database migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error migrating database:', err);
  } finally {
    client.release();
  }
}

module.exports = migrateDatabase;
