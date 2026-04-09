import paramiko
import sys

# Configuration
VPS_USER = "root"
VPS_IP = "187.77.43.105"
VPS_PASSWORD = "2705#Data2705"

def check_server():
    print(f"Connecting to {VPS_IP}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD)
        print("Connected successfully.")

        commands = [
            "ls -la /etc/nginx/sites-enabled/",
            "cat /etc/nginx/sites-enabled/duovet",
            "ls -la /var/www/duovet/logo.png",
            "curl -v -I http://localhost/logo.png",
            "curl -v -I https://duovet.app/logo.png",
            "tail -n 20 /var/log/nginx/error.log"
        ]

        for cmd in commands:
            print(f"\n--- Executing: {cmd} ---")
            stdin, stdout, stderr = ssh.exec_command(cmd)
            print(stdout.read().decode())
            err = stderr.read().decode()
            if err:
                print(f"ERROR: {err}")

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    check_server()
