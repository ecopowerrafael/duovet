
const db = require('./db');

async function fixCreatedBy() {
  try {
    console.log('Iniciando limpeza da coluna created_by...');
    
    // Remove espaços e converte para lowercase todos os e-mails na tabela clients
    const result = await db.query(`
      UPDATE clients 
      SET created_by = LOWER(TRIM(created_by))
      WHERE created_by IS NOT NULL
    `);
    
    console.log(`Sucesso! ${result.rowCount} clientes atualizados.`);
    
    // Opcional: fazer o mesmo para outras tabelas se necessário
    await db.query(`UPDATE animals SET created_by = LOWER(TRIM(created_by)) WHERE created_by IS NOT NULL`);
    await db.query(`UPDATE properties SET created_by = LOWER(TRIM(created_by)) WHERE created_by IS NOT NULL`);
    
    process.exit(0);
  } catch (err) {
    console.error('Erro ao limpar dados:', err);
    process.exit(1);
  }
}

fixCreatedBy();
