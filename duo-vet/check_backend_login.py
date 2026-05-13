import paramiko
import os

VPS_IP = "187.77.43.105"
VPS_USER = "root"
VPS_PASSWORD = "2705#Data2705"

def check_backend_login_vps():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD)
        
        print("--- Testing /api/auth/login on localhost:4000 ---")
        # We'll send a POST with some dummy data to see if it responds with 401/200/404
        stdin, stdout, stderr = ssh.exec_command('curl -i -X POST -H "Content-Type: application/json" -d \'{"email":"admin@duovet.app","password":"test"}\' http://localhost:4000/api/auth/login')
        print(stdout.read().decode())
        
        ssh.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_backend_login_vps()
