import paramiko
import os

VPS_IP = "187.77.43.105"
VPS_USER = "root"
VPS_PASSWORD = "2705#Data2705"

def check_backend_vps():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD)
        
        print("--- PM2 Status ---")
        stdin, stdout, stderr = ssh.exec_command("pm2 list")
        print(stdout.read().decode())
        
        print("--- Checking Port 4000 ---")
        stdin, stdout, stderr = ssh.exec_command("netstat -tuln | grep :4000")
        print(stdout.read().decode())
        
        print("--- Local Curl to Backend ---")
        stdin, stdout, stderr = ssh.exec_command("curl -i http://localhost:4000/api/health")
        print(stdout.read().decode())
        
        print("--- Nginx Config Test ---")
        stdin, stdout, stderr = ssh.exec_command("nginx -t")
        print(stdout.read().decode())
        print(stderr.read().decode())

        print("--- Active Nginx Sites ---")
        stdin, stdout, stderr = ssh.exec_command("ls -l /etc/nginx/sites-enabled/")
        print(stdout.read().decode())

        ssh.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_backend_vps()
