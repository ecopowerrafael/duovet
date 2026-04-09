const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(process.env.USERPROFILE, '.ssh', 'id_ed25519');

if (fs.existsSync(keyPath)) {
  console.log('Key already exists');
} else {
  try {
    execSync(`ssh-keygen -t ed25519 -f "${keyPath}" -N ""`, { stdio: 'inherit' });
    console.log('Key generated successfully');
  } catch (error) {
    console.error('Error generating key:', error.message);
  }
}
