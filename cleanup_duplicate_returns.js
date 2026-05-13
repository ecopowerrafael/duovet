#!/usr/bin/env node
/**
 * Script para limpar eventos de retorno duplicados
 * Mantem apenas o primeiro evento criado para cada atendimento
 */

const db = require('./backend/db');

async function cleanupDuplicateReturns() {
  try {
    console.log('🔍 Iniciando limpeza de eventos de retorno duplicados...\n');

    // Buscar atendimentos com múltiplos eventos de retorno
    const result = await db.query(`
      SELECT appointment_id, COUNT(*) as count, ARRAY_AGG(id ORDER BY created_at) as event_ids
      FROM events
      WHERE event_type = 'retorno' AND appointment_id IS NOT NULL
      GROUP BY appointment_id
      HAVING COUNT(*) > 1
    `);

    if (result.rows.length === 0) {
      console.log('✅ Nenhum evento de retorno duplicado encontrado!');
      process.exit(0);
      return;
    }

    console.log(`⚠️  Encontrados ${result.rows.length} atendimentos com eventos de retorno duplicados:\n`);

    let totalDeleted = 0;

    for (const row of result.rows) {
      const { appointment_id, count, event_ids } = row;
      const idsToDelete = event_ids.slice(1); // Manter o primeiro, deletar os outros

      console.log(`  📌 Atendimento #${appointment_id}:`);
      console.log(`     - Total de eventos: ${count}`);
      console.log(`     - Mantendo evento: ${event_ids[0]}`);
      console.log(`     - Deletando eventos: ${idsToDelete.join(', ')}`);

      // Deletar eventos duplicados
      const deleteResult = await db.query(
        `DELETE FROM events WHERE id = ANY($1)`,
        [idsToDelete]
      );

      totalDeleted += idsToDelete.length;
      console.log(`     ✓ Deletados ${idsToDelete.length} eventos\n`);
    }

    console.log(`\n✅ Limpeza concluída!`);
    console.log(`   Total de eventos duplicados removidos: ${totalDeleted}`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro ao limpar eventos duplicados:', err.message);
    process.exit(1);
  }
}

cleanupDuplicateReturns();
