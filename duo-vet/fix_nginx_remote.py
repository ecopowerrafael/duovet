import paramiko

VPS_USER = "root"
VPS_IP = "187.77.43.105"
VPS_PASSWORD = "2705#Data2705"

def fix_nginx_vps():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD)
        sftp = ssh.open_sftp()
        
        print("Uploading updated Nginx config...")
        sftp.put("backend/deploy/duovet.nginx.conf", "/etc/nginx/sites-available/duovet")
        sftp.close()

        print("--- Reloading Nginx on VPS ---")
        # Ensure default is removed and duovet is enabled
        stdin, stdout, stderr = ssh.exec_command("rm -f /etc/nginx/sites-enabled/default && ln -sf /etc/nginx/sites-available/duovet /etc/nginx/sites-enabled/duovet && nginx -t && systemctl reload nginx")
        print(stdout.read().decode())
        print(stderr.read().decode())

    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    fix_nginx_vps()
