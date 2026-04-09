import paramiko
import os

VPS_IP = "187.77.43.105"
VPS_USER = "root"
VPS_PASSWORD = "2705#Data2705"

def check_nginx_duovet_config():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD)
        
        print("--- Finding duovet config in nginx -T ---")
        stdin, stdout, stderr = ssh.exec_command("nginx -T")
        full_config = stdout.read().decode()
        
        # Look for the section starting with # configuration file /etc/nginx/sites-enabled/duovet
        start_marker = "# configuration file /etc/nginx/sites-enabled/duovet:"
        if start_marker in full_config:
            config_start = full_config.find(start_marker)
            # Find the end of this configuration block (next marker or end of string)
            next_marker = full_config.find("# configuration file", config_start + len(start_marker))
            if next_marker != -1:
                print(full_config[config_start:next_marker])
            else:
                print(full_config[config_start:])
        else:
            print("duovet config marker NOT found in nginx -T")
            # Maybe it's under a different name or path
            print("--- All configuration file markers ---")
            for line in full_config.splitlines():
                if line.startswith("# configuration file"):
                    print(line)

        ssh.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_nginx_duovet_config()
