"""
Functional tests for RBAC implementation.
These tests verify the RBAC system functionality without complex mocking.
"""
import pytest
from fastapi.testclient import TestClient
import os


def test_basic_rbac_functionality():
    """Test basic RBAC functionality with real environment configuration."""
    # Set development environment
    os.environ['ENVIRONMENT'] = 'development'
    os.environ['ENGINEER_ACCESS_KEY'] = 'test_functional_key'
    
    # Import app after setting environment
    from app.main import app
    client = TestClient(app)
    
    # Test 1: Health endpoints should be public
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    
    # Test 2: Root endpoint should be public
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    
    # Test 3: Secure docs should require engineer key
    response = client.get("/secure-docs")
    assert response.status_code == 401
    assert "Engineer access key is required" in response.json()["detail"]
    
    # Test 4: Secure docs should work with valid key
    headers = {"X-Engineer-Access-Key": "test_functional_key"}
    response = client.get("/secure-docs", headers=headers)
    assert response.status_code == 200
    
    # Test 5: Secure docs should reject invalid key
    headers = {"X-Engineer-Access-Key": "invalid_key"}
    response = client.get("/secure-docs", headers=headers)
    assert response.status_code == 401
    assert "Invalid engineer access key" in response.json()["detail"]
    
    print("✅ All basic RBAC functionality tests passed!")


def test_production_mode_functionality():
    """Test RBAC functionality in production mode."""
    # Set production environment
    os.environ['ENVIRONMENT'] = 'production'
    # Remove engineer key for production test
    if 'ENGINEER_ACCESS_KEY' in os.environ:
        del os.environ['ENGINEER_ACCESS_KEY']
    
    # Import app after setting environment (need to reload modules)
    import importlib
    import sys
    
    # Clear modules to force reload
    modules_to_reload = [m for m in sys.modules.keys() if m.startswith('app')]
    for module in modules_to_reload:
        if module in sys.modules:
            del sys.modules[module]
    
    from app.main import app
    client = TestClient(app)
    
    # Test 1: Default docs should be disabled
    response = client.get("/docs")
    assert response.status_code == 404
    assert "API documentation is not available" in response.json()["detail"]
    
    # Test 2: Redoc should be disabled
    response = client.get("/redoc")
    assert response.status_code == 404
    assert "API documentation is not available" in response.json()["detail"]
    
    # Test 3: OpenAPI should be disabled
    response = client.get("/openapi.json")
    assert response.status_code == 404
    assert "API documentation is not available" in response.json()["detail"]
    
    # Test 4: Secure docs should not be available even with key
    headers = {"X-Engineer-Access-Key": "any_key"}
    response = client.get("/secure-docs", headers=headers)
    assert response.status_code == 404
    
    print("✅ All production mode functionality tests passed!")


def test_engineer_bypass_functionality():
    """Test engineer bypass functionality."""
    # Set development environment
    os.environ['ENVIRONMENT'] = 'development'
    os.environ['ENGINEER_ACCESS_KEY'] = 'bypass_test_key'
    
    # Clear modules to force reload
    import importlib
    import sys
    modules_to_reload = [m for m in sys.modules.keys() if m.startswith('app')]
    for module in modules_to_reload:
        if module in sys.modules:
            del sys.modules[module]
    
    from app.main import app
    client = TestClient(app)
    
    # Test engineer bypass for admin endpoint
    headers = {
        "Authorization": "Bearer dummy_token",
        "X-Engineer-Access-Key": "bypass_test_key"
    }
    
    # This should not return 401 (unauthorized) because engineer bypass should work
    response = client.get("/api/v1/admin/roles/", headers=headers)
    # We expect either 200 (success) or some other status but not 401
    assert response.status_code != 401, f"Engineer bypass failed: {response.json()}"
    
    print("✅ Engineer bypass functionality test passed!")


if __name__ == "__main__":
    print("Running functional tests for RBAC...")
    
    try:
        test_basic_rbac_functionality()
        test_production_mode_functionality()
        test_engineer_bypass_functionality()
        print("🎉 All functional tests passed!")
    except Exception as e:
        print(f"❌ Test failed: {e}")
        raise 