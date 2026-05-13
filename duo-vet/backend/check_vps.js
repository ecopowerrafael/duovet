
const fs = require('fs');
const path = require('path');
const db = require('./db');

async function check() {
  console.log('Starting VPS check...');
  const results = {
    uploads: false,
    settings: false,
    events: false,
    files: []
  };

  // 1. Check uploads folder
  const uploadDir = path.join(__dirname, 'uploads');
  try {
    if (!fs.existsSync(uploadDir)) {
      console.log('Uploads folder missing. Creating...');
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    // Check write permissions (try to write a file)
    const testFile = path.join(uploadDir, 'test.txt');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('Uploads folder exists and is writable.');
    results.uploads = true;
  } catch (err) {
    console.error('Uploads folder error:', err.message);
  }

  // 2. Check settings table
  try {
    const res = await db.query("SELECT to_regclass('public.settings')");
    if (res.rows[0].to_regclass) {
      console.log('Settings table exists.');
      results.settings = true;
      
      // Check constraints
      const constraints = await db.query(`
        SELECT conname, pg_get_constraintdef(c.oid)
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE conrelid = 'public.settings'::regclass
      `);
      console.log('Settings constraints:', constraints.rows);

      // Try dummy insert (if users table has at least one user, or insert a dummy user)
      // Actually, we can check if user_id column is nullable. It is REFERENCES users(id).
      // If we don't have a valid user_id, we can't test INSERT properly without violating FK.
      // But we can check if the column exists.
      const columns = await db.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'settings'
      `);
      console.log('Settings columns:', columns.rows.map(c => `${c.column_name} (${c.data_type})`));

    } else {
      console.log('Settings table MISSING!');
    }
  } catch (err) {
    console.error('Settings table check error:', err.message);
  }

  // 3. Check events table
  try {
    const res = await db.query("SELECT to_regclass('public.events')");
    if (res.rows[0].to_regclass) {
      console.log('Events table exists.');
      results.events = true;
    } else {
      console.log('Events table MISSING!');
    }
  } catch (err) {
    console.error('Events table check error:', err.message);
  }

  // 4. List files
  try {
    const files = fs.readdirSync(__dirname);
    console.log('Files in backend:', files.filter(f => f.endsWith('.js')));
    if (files.includes('events.js')) {
        console.log('events.js found.');
    } else {
        console.log('events.js NOT FOUND!');
    }
  } catch (err) {
    console.error('File list error:', err.message);
  }

  console.log('Check complete.');

  // 5. Test Routes (locally)
  console.log('Testing events route locally...');
  try {
      const eventsRouter = require('./events');
      console.log('Events router loaded successfully.');
      console.log('Router stack length:', eventsRouter.stack.length);
      
      const indexContent = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
      if (indexContent.includes("app.use('/api/events', eventsRouter)")) {
          console.log("Route registration found in index.js");
      } else {
          console.log("Route registration MISSING in index.js");
      }

  } catch (err) {
      console.error('Error loading events router:', err);
  }

  // 6. Test HTTP Requests
  const http = require('http');
  
  function testUrl(path) {
      return new Promise((resolve) => {
          http.get({
              hostname: 'localhost',
              port: 4000,
              path: path,
              agent: false
          }, (res) => {
              console.log(`GET ${path} -> Status: ${res.statusCode}`);
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => {
                  console.log(`Response: ${data}`); // Print full response
                  resolve();
              });
          }).on('error', (err) => {
              console.log(`GET ${path} -> Error: ${err.message}`);
              resolve();
          });
      });
  }

  console.log('Waiting for server to start...');
  await new Promise(r => setTimeout(r, 5000)); // Wait 5s for PM2 restart

  console.log('Testing HTTP endpoints...');
  await testUrl('/api/test-events');
  await testUrl('/api/events');

  process.exit(0);
}

check();
