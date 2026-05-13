
const db = require('./db');

async function checkConnection() {
  try {
    const res = await db.query('SELECT NOW()');
    console.log('Connection successful:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Connection failed:', err);
    process.exit(1);
  }
}

checkConnection();
