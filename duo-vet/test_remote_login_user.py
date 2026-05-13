import requests

def test_remote_login_user():
    url = "http://187.77.43.105/api/auth/login"
    data = {
        "email": "ecopower.rafael@gmail.com",
        "password": "password123"
    }
    
    try:
        print(f"Testing POST to {url}...")
        response = requests.post(url, json=data)
        print(f"Status: {response.status_code}")
        print(f"Body: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_remote_login_user()
