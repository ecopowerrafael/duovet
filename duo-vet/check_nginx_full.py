import paramiko
import os

VPS_IP = "187.77.43.105"
VPS_USER = "root"
VPS_PASSWORD = "2705#Data2705"

def check_nginx_full_config():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD)
        
        print("--- Full Nginx Config (nginx -T) ---")
        stdin, stdout, stderr = ssh.exec_command("nginx -T")
        # nginx -T might be long, so we'll only print part or use it to confirm the duovet config is present
        full_config = stdout.read().decode()
        print(full_config[:2000] + "...") # print first 2000 chars

        print("--- Sites Enabled ---")
        stdin, stdout, stderr = ssh.exec_command("ls -la /etc/nginx/sites-enabled/")
        print(stdout.read().decode())

        ssh.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_nginx_full_config()
