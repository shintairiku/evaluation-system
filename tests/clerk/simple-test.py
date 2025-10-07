#!/usr/bin/env python3
"""
Simple Clerk Keys Test - No external dependencies
"""

import os

def test_clerk_keys():
    print("🔐 Testing Clerk Keys...")
    print("=" * 40)
    
    # Test environment variables
    pub_key = os.getenv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY')
    secret_key = os.getenv('CLERK_SECRET_KEY')
    
    if not pub_key:
        print("❌ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not set")
        return False
        
    if not secret_key:
        print("❌ CLERK_SECRET_KEY not set")
        return False
        
    if not pub_key.startswith('pk_'):
        print(f"❌ Invalid publishable key format: {pub_key[:20]}...")
        return False
        
    if not secret_key.startswith('sk_'):
        print(f"❌ Invalid secret key format: {secret_key[:20]}...")
        return False
        
    print(f"✅ Publishable key: {pub_key[:20]}...")
    print(f"✅ Secret key: {secret_key[:20]}...")
    
    print("=" * 40)
    print("🎉 KEYS ARE CONFIGURED CORRECTLY!")
    print("")
    print("Next steps:")
    print("- Implement JWT verification in backend/app/api/v1/auth.py")
    print("- Implement webhook handlers in backend/app/api/v1/webhooks.py")
    print("- Enable middleware in frontend/src/middleware.ts")
    
    return True

if __name__ == "__main__":
    # Find .env.local file (try multiple locations)
    env_files = ['.env', '../../.env.local', '../.env.local']
    
    for env_file in env_files:
        if os.path.exists(env_file):
            print(f"Loading environment from {env_file}")
            with open(env_file, 'r') as f:
                for line in f:
                    if '=' in line and not line.strip().startswith('#'):
                        key, value = line.strip().split('=', 1)
                        os.environ[key] = value.strip('"').strip("'")
            break
    else:
        print("No .env.local file found")
    
    test_clerk_keys()