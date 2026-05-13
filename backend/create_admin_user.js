const db = require('./db');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  const email = 'admin@duovet.app';
  const password = '2705#Data';
  const name = 'Administrador';

  try {
    console.log('Connecting to database...');
    
    const hash = await bcrypt.hash(password, 8);
    const createdAt = new Date();
    
    // Check if user exists
    const checkRes = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (checkRes.rows.length > 0) {
      console.log('User already exists. Updating password...');
      await db.query(
        'UPDATE users SET password = $1, name = $2, status = $3 WHERE email = $4',
        [hash, name, 'active', email]
      );
      console.log('User updated successfully.');
    } else {
      console.log('Creating new user...');
      await db.query(
        'INSERT INTO users (email, password, name, created_at, status) VALUES ($1, $2, $3, $4, $5)',
        [email, hash, name, createdAt, 'active']
      );
      console.log('User created successfully.');
    }
  } catch (err) {
    console.error('Error creating admin user:', err);
  } finally {
    await db.pool.end();
  }
}

createAdmin();
