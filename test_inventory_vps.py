import requests

def test_inventory_api():
    login_url = "http://187.77.43.105/api/auth/login"
    inventory_url = "http://187.77.43.105/api/inventory/products?created_by=admin@duovet.app"
    
    login_data = {
        "email": "admin@duovet.app",
        "password": "2705#Data"
    }
    
    try:
        print(f"Logging in to get token...")
        login_res = requests.post(login_url, json=login_data)
        if login_res.status_code != 200:
            print("Login failed")
            return
            
        token = login_res.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}
        
        print(f"Testing GET to {inventory_url}...")
        inventory_res = requests.get(inventory_url, headers=headers)
        print(f"Status: {inventory_res.status_code}")
        print(f"Body: {inventory_res.text}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_inventory_api()
