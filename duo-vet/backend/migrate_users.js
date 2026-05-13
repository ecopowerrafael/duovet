const db = require('./db');
require('dotenv').config();

async function migrate() {
  try {
    console.log('Conectado ao banco de dados...');
    
    // Verificar se a tabela users existe
    const tableCheck = await db.query("SELECT to_regclass('public.users')");
    if (!tableCheck.rows[0].to_regclass) {
      console.log('Criando tabela users...');
      await db.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          status VARCHAR(50) DEFAULT 'trial',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Tabela users criada com sucesso.');
    } else {
      console.log('Tabela users já existe. Verificando colunas...');
      
      // Adicionar coluna status se não existir
      await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'trial'");
      console.log('Coluna status verificada.');

      // Adicionar coluna created_at se não existir
      await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
      console.log('Coluna created_at verificada.');
    }

    console.log('Migração concluída com sucesso!');
  } catch (error) {
    console.error('Erro durante a migração:', error);
  } finally {
    await db.pool.end();
  }
}

migrate();
