import paramiko
import os
import sys
import tarfile
import subprocess
import shutil

# Configuration
VPS_USER = "root"
VPS_IP = "187.77.43.105"
VPS_PASSWORD = "2705#Data2705"
REMOTE_DIR = "/var/www/duovet"
REMOTE_TMP = "/tmp"

def compress_folder(source_dir, output_filename, exclude_dirs=None):
    if exclude_dirs is None:
        exclude_dirs = []
    
    print(f"Compressing {source_dir} to {output_filename}...")
    with tarfile.open(output_filename, "w:gz") as tar:
        tar.add(source_dir, arcname=os.path.basename(source_dir), filter=lambda x: None if any(excluded in x.name for excluded in exclude_dirs) else x)

def deploy():
    # 1. Build frontend
    print("Building frontend...")
    try:
        subprocess.run(["npm", "run", "build"], shell=True, check=True)
    except subprocess.CalledProcessError:
        print("Frontend build failed. Aborting.")
        return

    # 2. Compress backend
    if os.path.exists("backend.tar.gz"):
        os.remove("backend.tar.gz")
    
    # Custom filter for backend to exclude node_modules and .env
    print("Compressing backend...")
    with tarfile.open("backend.tar.gz", "w:gz") as tar:
        tar.add("backend", arcname="backend", filter=lambda x: None if "node_modules" in x.name or ".env" in x.name else x)

    # 3. Compress dist
    if os.path.exists("dist.tar.gz"):
        os.remove("dist.tar.gz")
        
    print("Compressing dist...")
    with tarfile.open("dist.tar.gz", "w:gz") as tar:
        tar.add("dist", arcname="dist")

    print(f"Connecting to {VPS_IP}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(
            VPS_IP, 
            username=VPS_USER, 
            password=VPS_PASSWORD, 
            timeout=30, 
            banner_timeout=60,
            look_for_keys=False,
            allow_agent=False
        )
        print("Connected successfully.")

        sftp = ssh.open_sftp()

        # Upload backend.tar.gz
        if os.path.exists("backend.tar.gz"):
            print("Uploading backend.tar.gz...")
            sftp.put("backend.tar.gz", f"{REMOTE_TMP}/backend.tar.gz")
        else:
            print("Error: backend.tar.gz not found locally.")
            return

        # Upload dist.tar.gz
        if os.path.exists("dist.tar.gz"):
            print("Uploading dist.tar.gz...")
            sftp.put("dist.tar.gz", f"{REMOTE_TMP}/dist.tar.gz")
        else:
            print("Error: dist.tar.gz not found locally.")
            return

        sftp.close()
        print("Upload complete.")

        # Execute remote commands
        remote_script = f"""
            mkdir -p {REMOTE_DIR}
            
            # Backup uploads if exists
            if [ -d "{REMOTE_DIR}/backend/uploads" ]; then
                echo "Backing up uploads..."
                rm -rf {REMOTE_TMP}/uploads_backup
                mv {REMOTE_DIR}/backend/uploads {REMOTE_TMP}/uploads_backup
            fi

            # Extract backend
            rm -rf {REMOTE_DIR}/backend
            mkdir -p {REMOTE_DIR}/backend
            tar -xzf {REMOTE_TMP}/backend.tar.gz -C {REMOTE_DIR}/backend --strip-components=1
            
            # Restore uploads
            if [ -d "{REMOTE_TMP}/uploads_backup" ]; then
                echo "Restoring uploads..."
                rm -rf {REMOTE_DIR}/backend/uploads
                mv {REMOTE_TMP}/uploads_backup {REMOTE_DIR}/backend/uploads
            else
                mkdir -p {REMOTE_DIR}/backend/uploads
            fi
            
            # Ensure permissions
            chmod -R 777 {REMOTE_DIR}/backend/uploads

            # SSL Certbot (Auto-configure if not already)
            if ! [ -d "/etc/letsencrypt/live/duovet.app" ]; then
                echo "Requesting SSL certificate for duovet.app..."
                # We use --nginx but need to ensure nginx is running first
                certbot --nginx -d duovet.app -d www.duovet.app --non-interactive --agree-tos --email contato@duovet.app --redirect
            fi

            # Update Nginx config (only if not already SSL-configured)
            if ! grep -q "listen 443 ssl" /etc/nginx/sites-available/duovet; then
                echo "Updating Nginx configuration (Initial/Non-SSL)..."
                cp {REMOTE_DIR}/backend/deploy/duovet.nginx.conf /etc/nginx/sites-available/duovet
                ln -sf /etc/nginx/sites-available/duovet /etc/nginx/sites-enabled/duovet
                nginx -t && systemctl reload nginx
            else
                echo "Nginx already has SSL configured. Skipping config overwrite to prevent breakage."
            fi
            
            # Extract frontend
            # First, clean up old frontend files in the root (if any)
            echo "Cleaning up old frontend files..."
            rm -rf {REMOTE_DIR}/assets
            rm -f {REMOTE_DIR}/index.html
            rm -f {REMOTE_DIR}/manifest.json
            rm -f {REMOTE_DIR}/logo.png
            rm -f {REMOTE_DIR}/logo.png.png
            
            # Extract new dist
            rm -rf {REMOTE_DIR}/dist
            tar -xzf {REMOTE_TMP}/dist.tar.gz -C {REMOTE_DIR}
            
            # Move dist contents to root (assuming Nginx serves from root)
            cp -r {REMOTE_DIR}/dist/* {REMOTE_DIR}/
            rm -rf {REMOTE_DIR}/dist
            
            # Install dependencies and restart
            cd {REMOTE_DIR}/backend
            npm install --production
            
            # Create uploads directory if not exists (in case restore failed or new install)
            mkdir -p {REMOTE_DIR}/backend/uploads
            chmod -R 777 {REMOTE_DIR}/backend/uploads

            # Run schema migration
            echo "Running schema migration..."
            node -e "require('./migrate_db')().then(() => process.exit(0)).catch(err => {{ console.error(err); process.exit(1); }})"

            # Run data cleanup for created_by
            echo "Running data cleanup for created_by..."
            if [ -f "fix_data.js" ]; then
                node fix_data.js
            fi

            # Run VPS check
            echo "Running VPS check..."
            if [ -f "check_vps.js" ]; then
                node check_vps.js
            fi

            # Move ecosystem.config.js to root of backend
            if [ -f "deploy/ecosystem.config.js" ]; then
                cp deploy/ecosystem.config.js .
            fi

            # Restart application
            if command -v pm2 >/dev/null 2>&1; then
                echo "Restarting PM2 processes..."
                pm2 delete all || true
                pm2 start ecosystem.config.js --update-env
                pm2 save
            else
                echo "PM2 not found. Please install PM2 or start manually."
            fi
        """

        print("Executing remote deployment script...")
        stdin, stdout, stderr = ssh.exec_command(remote_script)
        
        # Stream output
        for line in stdout:
            print(f"REMOTE: {line.strip()}")
        
        for line in stderr:
            print(f"REMOTE ERROR: {line.strip()}")

        exit_status = stdout.channel.recv_exit_status()
        if exit_status == 0:
            print("Deployment successful!")
        else:
            print(f"Deployment failed with exit code {exit_status}")

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    deploy()
