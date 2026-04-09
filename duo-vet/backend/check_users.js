const db = require('./db');

async function checkUsers() {
  try {
    const res = await db.query('SELECT id, email, name, status, created_at FROM users');
    console.log('--- Users in Database ---');
    console.table(res.rows);
    process.exit(0);
  } catch (err) {
    console.error('Failed to fetch users:', err);
    process.exit(1);
  }
}

checkUsers();
