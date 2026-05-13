const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const sshDir = path.join(os.homedir(), '.ssh');
if (!fs.existsSync(sshDir)) {
    fs.mkdirSync(sshDir, { recursive: true });
}

const keyPath = path.join(sshDir, 'id_ed25519');

try {
    if (fs.existsSync(keyPath)) {
        console.log('Key already exists');
    } else {
        console.log(`Generating key at ${keyPath}`);
        // Use simpler command without quotes inside quotes if possible
        execSync(`ssh-keygen -t ed25519 -f "${keyPath}" -N ""`, { stdio: 'inherit' });
        console.log('Key generated successfully');
    }
} catch (error) {
    console.error('Error:', error.message);
}
