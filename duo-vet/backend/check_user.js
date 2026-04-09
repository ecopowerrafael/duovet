const db = require('./db');

async function check() {
  try {
    console.log('Connecting to DB...');
    const res = await db.query('SELECT * FROM users WHERE email = $1', ['admin@duovet.app']);
    console.log('User found:', res.rows.length > 0);
    if (res.rows.length > 0) {
        console.log('User details:', { ...res.rows[0], password: '[HIDDEN]' });
    }
  } catch (err) {
    console.error('Error connecting/querying:', err);
  } finally {
    await db.pool.end();
  }
}

check();
