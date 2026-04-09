
const db = require('./db');

async function setupFullDatabase() {
  try {
    console.log('Starting full database setup...');

    // Users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'trial',
        reset_token VARCHAR(255),
        reset_token_expiry TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Users table ready.');

    // Clients table
    await db.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        document VARCHAR(50),
        notes TEXT,
        type VARCHAR(50),
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Clients table ready.');

    // Animals table
    await db.query(`
      CREATE TABLE IF NOT EXISTS animals (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        species VARCHAR(100),
        breed VARCHAR(100),
        birth_date TIMESTAMP,
        birthdate TIMESTAMP,
        sex VARCHAR(20),
        identification VARCHAR(100),
        color VARCHAR(50),
        weight VARCHAR(50),
        owner_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        property_id INTEGER,
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
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Animals table ready.');

    // Appointments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        animal_id INTEGER REFERENCES animals(id) ON DELETE SET NULL,
        animal_ids INTEGER[],
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        property_id INTEGER,
        date TIMESTAMP,
        description TEXT,
        status VARCHAR(50) DEFAULT 'scheduled',
        type VARCHAR(50),
        subtype VARCHAR(50),
        symptoms TEXT,
        diagnosis TEXT,
        observations TEXT,
        procedures JSONB,
        medications JSONB,
        reproductive_data JSONB,
        andrological_data JSONB,
        consultoria_data JSONB,
        photos JSONB,
        total_amount NUMERIC(10, 2),
        displacement_cost NUMERIC(10, 2),
        needs_return BOOLEAN DEFAULT FALSE,
        return_date TIMESTAMP,
        return_type VARCHAR(50),
        return_notes TEXT,
        return_status VARCHAR(50),
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Appointments table ready.');

    // Payments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        amount NUMERIC(10, 2),
        amount_paid NUMERIC(10, 2),
        date TIMESTAMP,
        due_date TIMESTAMP,
        payment_date TIMESTAMP,
        method VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
        created_by VARCHAR(255)
      );
    `);
    console.log('Payments table ready.');

    // Prescriptions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        animal_ids INTEGER[],
        appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
        date TIMESTAMP,
        medications JSONB,
        notes TEXT,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Prescriptions table ready.');

    // Protocols table
    await db.query(`
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
    console.log('Protocols table ready.');

    // Settings table
    await db.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT
      );
    `);
    console.log('Settings table ready.');

    // Events table (Calendar)
    await db.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        event_type VARCHAR(50),
        start_datetime TIMESTAMP,
        end_datetime TIMESTAMP,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
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
    console.log('Events table ready.');

    // Invoices table (Notas Fiscais)
    await db.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
        amount NUMERIC(10,2),
        status VARCHAR(50) DEFAULT 'pendente',
        due_date TIMESTAMP,
        description TEXT,
        items JSONB,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        appointment_ids INTEGER[]
      );
    `);
    console.log('Invoices table ready.');

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
    console.log('Notifications table ready.');

    await db.query(`
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
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_ticket_code_unique ON tickets(ticket_code) WHERE ticket_code IS NOT NULL`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON tickets(updated_at DESC)`);
    console.log('Tickets table ready.');

    // Properties table
    await db.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        name VARCHAR(255),
        address TEXT,
        details JSONB,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Properties table ready.');

    // VetProfiles table
    await db.query(`
      CREATE TABLE IF NOT EXISTS vet_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        crmv VARCHAR(50),
        specialties VARCHAR(255),
        bio TEXT,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('VetProfiles table ready.');

    // Expenses table
    await db.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        description TEXT NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        date TIMESTAMP NOT NULL,
        category VARCHAR(100),
        payment_method VARCHAR(50),
        notes TEXT,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Expenses table ready.');

    // Contracts table
    await db.query(`
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
    console.log('Contracts table ready.');

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
    console.log('Consultancies table ready.');

    // Subscriptions table
    await db.query(`
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
    console.log('Subscriptions table ready.');

    // Products table (Inventory)
    await db.query(`
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
    console.log('Products table ready.');

    // Stock movements table
    await db.query(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL, -- 'in' or 'out'
        quantity NUMERIC(10, 2) NOT NULL,
        reason VARCHAR(255),
        date TIMESTAMP DEFAULT NOW(),
        appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
        prescription_id INTEGER REFERENCES prescriptions(id) ON DELETE SET NULL,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Stock movements table ready.');

    console.log('Full database setup completed successfully.');
  } catch (err) {
    console.error('Error setting up database:', err);
  }
}

module.exports = setupFullDatabase;
