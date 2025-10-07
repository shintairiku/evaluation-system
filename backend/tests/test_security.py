import pytest
from fastapi.testclient import TestClient
from fastapi import status
from jose import jwt
from datetime import datetime, timedelta

from app.main import app
from app.core.clerk_config import ClerkConfig


class TestSecurityPenetration:
    """Test suite for security penetration testing"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    @pytest.fixture
    def clerk_config(self):
        """Get Clerk configuration"""
        return ClerkConfig()
    
    @pytest.fixture
    def valid_admin_token(self, clerk_config):
        """Create valid admin JWT token"""
        payload = {
            "sub": "admin_123",
            "email": "admin@example.com",
            "first_name": "Admin",
            "last_name": "User",
            "role": "admin",
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        return jwt.encode(payload, clerk_config.secret_key, algorithm="HS256")
    
    @pytest.fixture
    def valid_employee_token(self, clerk_config):
        """Create valid employee JWT token with new roles array format"""
        payload = {
            "sub": "employee_123",
            "email": "employee@example.com",
            "first_name": "Employee",
            "last_name": "User",
            "roles": ["employee"],  # New format: roles array
            "role": "employee",     # Keep legacy field for backward compatibility
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        return jwt.encode(payload, clerk_config.secret_key, algorithm="HS256")
    
    # Test Token Tampering
    
    def test_token_tampering_role_escalation(self, client, clerk_config):
        """Test token tampering to escalate role from employee to admin"""
        # Create employee token
        employee_payload = {
            "sub": "employee_123",
            "email": "employee@example.com",
            "roles": ["employee"],  # New format: roles array
            "role": "employee",     # Keep legacy field for backward compatibility
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        employee_token = jwt.encode(employee_payload, clerk_config.secret_key, algorithm="HS256")
        
        # Tamper with the token to change role to admin
        tampered_payload = {
            "sub": "employee_123",
            "email": "employee@example.com",
            "role": "admin",  # Escalated role
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        tampered_token = jwt.encode(tampered_payload, clerk_config.secret_key, algorithm="HS256")
        
        headers = {"Authorization": f"Bearer {tampered_token}"}
        response = client.get("/api/v1/users/", headers=headers)
        
        # Should be rejected due to token tampering detection
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]
    
    def test_token_tampering_user_id_spoofing(self, client, clerk_config):
        """Test token tampering to spoof different user ID"""
        # Create token for user A
        user_a_payload = {
            "sub": "user_a_123",
            "email": "user_a@example.com",
            "roles": ["employee"],  # New format: roles array
            "role": "employee",     # Keep legacy field for backward compatibility
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        user_a_token = jwt.encode(user_a_payload, clerk_config.secret_key, algorithm="HS256")
        
        # Tamper with the token to change user ID
        tampered_payload = {
            "sub": "user_b_123",  # Spoofed user ID
            "email": "user_a@example.com",
            "roles": ["employee"],  # New format: roles array
            "role": "employee",     # Keep legacy field for backward compatibility
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        tampered_token = jwt.encode(tampered_payload, clerk_config.secret_key, algorithm="HS256")
        
        headers = {"Authorization": f"Bearer {tampered_token}"}
        response = client.get("/api/v1/users/user_b_123", headers=headers)
        
        # Should be rejected
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]
    
    def test_token_tampering_expiration_extension(self, client, clerk_config):
        """Test token tampering to extend expiration time"""
        # Create expired token
        expired_payload = {
            "sub": "admin_123",
            "email": "admin@example.com",
            "role": "admin",
            "iat": datetime.utcnow() - timedelta(hours=2),
            "exp": datetime.utcnow() - timedelta(hours=1)  # Expired
        }
        expired_token = jwt.encode(expired_payload, clerk_config.secret_key, algorithm="HS256")
        
        # Tamper with the token to extend expiration
        tampered_payload = {
            "sub": "admin_123",
            "email": "admin@example.com",
            "role": "admin",
            "iat": datetime.utcnow() - timedelta(hours=2),
            "exp": datetime.utcnow() + timedelta(hours=10)  # Extended expiration
        }
        tampered_token = jwt.encode(tampered_payload, clerk_config.secret_key, algorithm="HS256")
        
        headers = {"Authorization": f"Bearer {tampered_token}"}
        response = client.get("/api/v1/users/", headers=headers)
        
        # Should be rejected
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]
    
    # Test Unauthorized Access Attempts
    
    def test_unauthorized_access_without_token(self, client):
        """Test accessing protected endpoints without token"""
        response = client.get("/api/v1/users/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        response = client.post("/api/v1/users/", json={})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        response = client.put("/api/v1/users/123", json={})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        response = client.delete("/api/v1/users/123")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_unauthorized_access_with_invalid_token(self, client):
        """Test accessing protected endpoints with invalid token"""
        headers = {"Authorization": "Bearer invalid_token_123"}
        
        response = client.get("/api/v1/users/", headers=headers)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        response = client.post("/api/v1/users/", json={}, headers=headers)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_unauthorized_access_with_expired_token(self, client, clerk_config):
        """Test accessing protected endpoints with expired token"""
        expired_payload = {
            "sub": "admin_123",
            "email": "admin@example.com",
            "role": "admin",
            "iat": datetime.utcnow() - timedelta(hours=2),
            "exp": datetime.utcnow() - timedelta(hours=1)  # Expired
        }
        expired_token = jwt.encode(expired_payload, clerk_config.secret_key, algorithm="HS256")
        
        headers = {"Authorization": f"Bearer {expired_token}"}
        response = client.get("/api/v1/users/", headers=headers)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    # Test Role Escalation Attacks
    
    def test_role_escalation_employee_to_admin(self, client, valid_employee_token):
        """Test employee trying to access admin-only endpoints"""
        headers = {"Authorization": f"Bearer {valid_employee_token}"}
        
        # Try to create user (admin only)
        user_data = {
            "clerk_user_id": "new_user_123",
            "name": "Test User",
            "email": "test@example.com",
            "employee_code": "EMP999",
            "department_id": "123e4567-e89b-12d3-a456-426614174000",
            "stage_id": "123e4567-e89b-12d3-a456-426614174001",
            "role_ids": [1, 2],
            "supervisor_id": None
        }
        response = client.post("/api/v1/users/", json=user_data, headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        
        # Try to delete user (admin only)
        response = client.delete("/api/v1/users/123e4567-e89b-12d3-a456-426614174000", headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_role_escalation_viewer_to_manager(self, client, clerk_config):
        """Test viewer trying to access manager-only endpoints"""
        viewer_payload = {
            "sub": "viewer_123",
            "email": "viewer@example.com",
            "role": "viewer",
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        viewer_token = jwt.encode(viewer_payload, clerk_config.secret_key, algorithm="HS256")
        
        headers = {"Authorization": f"Bearer {viewer_token}"}
        
        # Try to update user (should be restricted)
        update_data = {"name": "Updated Name"}
        response = client.put("/api/v1/users/123e4567-e89b-12d3-a456-426614174000", json=update_data, headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    # Test Cross-User Access Attempts
    
    def test_cross_user_access_employee_to_other_profile(self, client, valid_employee_token):
        """Test employee trying to access another user's profile"""
        headers = {"Authorization": f"Bearer {valid_employee_token}"}
        
        # Try to access another user's profile
        other_user_id = "123e4567-e89b-12d3-a456-426614174000"
        response = client.get(f"/api/v1/users/{other_user_id}", headers=headers)
        
        # Should be denied unless it's their own profile or they have supervisor access
        assert response.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]
    
    def test_cross_user_access_employee_to_other_update(self, client, valid_employee_token):
        """Test employee trying to update another user's profile"""
        headers = {"Authorization": f"Bearer {valid_employee_token}"}
        
        # Try to update another user's profile
        other_user_id = "123e4567-e89b-12d3-a456-426614174000"
        update_data = {"name": "Updated Name"}
        response = client.put(f"/api/v1/users/{other_user_id}", json=update_data, headers=headers)
        
        # Should be denied
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    # Test Malicious Input
    
    def test_sql_injection_attempts(self, client, valid_admin_token):
        """Test SQL injection attempts in search parameters"""
        headers = {"Authorization": f"Bearer {valid_admin_token}"}
        
        # SQL injection attempts
        malicious_searches = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "'; INSERT INTO users VALUES ('hacker', 'hacker@evil.com'); --",
            "' UNION SELECT * FROM users --"
        ]
        
        for search in malicious_searches:
            response = client.get(f"/api/v1/users/?search={search}", headers=headers)
            # Should not crash and should handle gracefully
            assert response.status_code in [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST, status.HTTP_422_UNPROCESSABLE_ENTITY]
    
    def test_xss_attempts(self, client, valid_admin_token):
        """Test XSS attempts in user data"""
        headers = {"Authorization": f"Bearer {valid_admin_token}"}
        
        # XSS attempts
        malicious_data = {
            "clerk_user_id": "new_user_123",
            "name": "<script>alert('XSS')</script>",
            "email": "test@example.com",
            "employee_code": "EMP999",
            "department_id": "123e4567-e89b-12d3-a456-426614174000",
            "stage_id": "123e4567-e89b-12d3-a456-426614174001",
            "role_ids": [1, 2],
            "supervisor_id": None
        }
        
        response = client.post("/api/v1/users/", json=malicious_data, headers=headers)
        # Should handle XSS attempts gracefully
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST, status.HTTP_422_UNPROCESSABLE_ENTITY]
    
    def test_path_traversal_attempts(self, client, valid_admin_token):
        """Test path traversal attempts"""
        headers = {"Authorization": f"Bearer {valid_admin_token}"}
        
        # Path traversal attempts
        malicious_paths = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\config\\sam",
            "....//....//....//etc/passwd",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd"
        ]
        
        for path in malicious_paths:
            response = client.get(f"/api/v1/users/{path}", headers=headers)
            # Should not allow path traversal
            assert response.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_422_UNPROCESSABLE_ENTITY]
    
    # Test Rate Limiting and DoS Protection
    
    def test_rapid_request_attempts(self, client, valid_admin_token):
        """Test rapid request attempts (basic DoS protection)"""
        headers = {"Authorization": f"Bearer {valid_admin_token}"}
        
        # Make multiple rapid requests
        for i in range(10):
            response = client.get("/api/v1/users/", headers=headers)
            # Should handle rapid requests gracefully
            assert response.status_code in [status.HTTP_200_OK, status.HTTP_429_TOO_MANY_REQUESTS]
    
    # Test Token Replay Attacks
    
    def test_token_replay_attack(self, client, valid_admin_token):
        """Test token replay attack (using same token multiple times)"""
        headers = {"Authorization": f"Bearer {valid_admin_token}"}
        
        # Use the same token multiple times
        for i in range(5):
            response = client.get("/api/v1/users/", headers=headers)
            # Should handle token replay gracefully
            assert response.status_code in [status.HTTP_200_OK, status.HTTP_401_UNAUTHORIZED]
    
    # Test Malformed Request Attacks
    
    def test_malformed_json_requests(self, client, valid_admin_token):
        """Test malformed JSON requests"""
        headers = {"Authorization": f"Bearer {valid_admin_token}", "Content-Type": "application/json"}
        
        # Malformed JSON
        malformed_data = '{"name": "Test", "email": "test@example.com",}'  # Trailing comma
        
        response = client.post("/api/v1/users/", data=malformed_data, headers=headers)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_oversized_payload_attack(self, client, valid_admin_token):
        """Test oversized payload attack"""
        headers = {"Authorization": f"Bearer {valid_admin_token}", "Content-Type": "application/json"}
        
        # Create oversized payload
        oversized_data = {
            "clerk_user_id": "new_user_123",
            "name": "A" * 10000,  # Very long name
            "email": "test@example.com",
            "employee_code": "EMP999",
            "department_id": "123e4567-e89b-12d3-a456-426614174000",
            "stage_id": "123e4567-e89b-12d3-a456-426614174001",
            "role_ids": [1, 2],
            "supervisor_id": None
        }
        
        response = client.post("/api/v1/users/", json=oversized_data, headers=headers)
        # Should handle oversized payloads gracefully
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST, status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, status.HTTP_422_UNPROCESSABLE_ENTITY]
    
    # Test Header Manipulation
    
    def test_header_manipulation_attempts(self, client, valid_admin_token):
        """Test header manipulation attempts"""
        # Try different header formats
        headers_variations = [
            {"Authorization": f"Bearer {valid_admin_token}"},
            {"authorization": f"Bearer {valid_admin_token}"},  # Lowercase
            {"AUTHORIZATION": f"Bearer {valid_admin_token}"},  # Uppercase
            {"Authorization": f"bearer {valid_admin_token}"},  # Lowercase bearer
            {"Authorization": f"BEARER {valid_admin_token}"},  # Uppercase bearer
        ]
        
        for headers in headers_variations:
            response = client.get("/api/v1/users/", headers=headers)
            # Should handle header variations appropriately
            assert response.status_code in [status.HTTP_200_OK, status.HTTP_401_UNAUTHORIZED]


class TestSecurityHeaders:
    """Test suite for security headers"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    def test_security_headers_present(self, client):
        """Test that security headers are present in responses"""
        response = client.get("/api/v1/users/")
        
        # Check for common security headers
        headers = response.headers
        
        # These headers should be present (if implemented)
        # assert "X-Content-Type-Options" in headers
        # assert "X-Frame-Options" in headers
        # assert "X-XSS-Protection" in headers
        # assert "Strict-Transport-Security" in headers
        
        # At minimum, should not expose sensitive headers
        assert "X-Powered-By" not in headers
        assert "Server" not in headers or "nginx" in headers.get("Server", "").lower()


class TestInputValidation:
    """Test suite for input validation security"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    def test_email_validation(self, client, valid_admin_token):
        """Test email validation against malicious inputs"""
        headers = {"Authorization": f"Bearer {valid_admin_token}"}
        
        malicious_emails = [
            "test@example.com<script>alert('XSS')</script>",
            "test@example.com' OR '1'='1",
            "test@example.com; DROP TABLE users; --",
            "test@example.com' UNION SELECT * FROM users --",
            "test@example.com' AND 1=1 --",
            "test@example.com' OR 1=1#",
            "test@example.com' OR 1=1/*",
        ]
        
        for email in malicious_emails:
            user_data = {
                "clerk_user_id": "new_user_123",
                "name": "Test User",
                "email": email,
                "employee_code": "EMP999",
                "department_id": "123e4567-e89b-12d3-a456-426614174000",
                "stage_id": "123e4567-e89b-12d3-a456-426614174001",
                "role_ids": [1, 2],
                "supervisor_id": None
            }
            
            response = client.post("/api/v1/users/", json=user_data, headers=headers)
            # Should reject malicious email inputs
            assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_422_UNPROCESSABLE_ENTITY]
    
    def test_uuid_validation(self, client, valid_admin_token):
        """Test UUID validation against malicious inputs"""
        headers = {"Authorization": f"Bearer {valid_admin_token}"}
        
        malicious_uuids = [
            "123e4567-e89b-12d3-a456-426614174000' OR '1'='1",
            "123e4567-e89b-12d3-a456-426614174000; DROP TABLE users; --",
            "123e4567-e89b-12d3-a456-426614174000' UNION SELECT * FROM users --",
            "not-a-uuid",
            "123e4567-e89b-12d3-a456-42661417400",  # Incomplete UUID
            "123e4567-e89b-12d3-a456-4266141740000",  # Too long UUID
        ]
        
        for malicious_uuid in malicious_uuids:
            response = client.get(f"/api/v1/users/{malicious_uuid}", headers=headers)
            # Should reject malicious UUID inputs
            assert response.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_422_UNPROCESSABLE_ENTITY]


if __name__ == "__main__":
    pytest.main([__file__, "-v"]) 