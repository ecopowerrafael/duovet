-- Tabela de configurações/admin para chaves e parâmetros globais
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT
);
-- duo-vet: Estrutura inicial de tabelas PostgreSQL

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  status VARCHAR(32) DEFAULT 'trial'
);

CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE animals (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  species VARCHAR(100),
  breed VARCHAR(100),
  birthdate DATE,
  birth_date TIMESTAMP,
  sex VARCHAR(20),
  identification VARCHAR(100),
  color VARCHAR(50),
  weight VARCHAR(50),
  owner_id INTEGER REFERENCES clients(id),
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
  status VARCHAR(50) DEFAULT 'ativo',
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  animal_id INTEGER REFERENCES animals(id),
  client_id INTEGER REFERENCES clients(id),
  property_id INTEGER,
  date TIMESTAMP NOT NULL,
  type VARCHAR(50),
  subtype VARCHAR(50),
  description TEXT,
  symptoms TEXT,
  diagnosis TEXT,
  observations TEXT,
  procedures JSONB,
  medications JSONB,
  reproductive_data JSONB,
  andrological_data JSONB,
  consultoria_data JSONB,
  animal_ids INTEGER[],
  total_amount NUMERIC(10,2),
  displacement_cost NUMERIC(10,2),
  needs_return BOOLEAN DEFAULT FALSE,
  return_date TIMESTAMP,
  return_time VARCHAR(20),
  return_type VARCHAR(50),
  return_notes TEXT,
  return_status VARCHAR(50),
  status VARCHAR(32) DEFAULT 'scheduled',
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  amount NUMERIC(10,2) NOT NULL,
  date TIMESTAMP NOT NULL,
  method VARCHAR(50),
  status VARCHAR(32) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  status VARCHAR(32) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE vetprofiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  bio TEXT,
  specialty VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  animal_ids INTEGER[],
  appointment_id INTEGER REFERENCES appointments(id),
  date TIMESTAMP,
  medications JSONB,
  notes TEXT,
  symptoms TEXT,
  diagnosis TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
