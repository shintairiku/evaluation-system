from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.get("/dev-keys")
async def get_dev_keys():
    """
    Get development API keys for testing different roles.
    """
    return {
        "dev_keys": {
            "admin": {
                "key": "dev-admin-key",
                "role": "admin",
                "description": "Full access to all endpoints including admin operations"
            },
            "manager": {
                "key": "dev-manager-key", 
                "role": "manager",
                "description": "Access to management operations and team oversight"
            },
            "supervisor": {
                "key": "dev-supervisor-key",
                "role": "supervisor", 
                "description": "Access to supervisor operations and direct reports"
            },
            "employee": {
                "key": "dev-employee-key",
                "role": "employee",
                "description": "Basic employee access to own data and evaluations"
            }
        },
        "instructions": [
            "1. Go to http://localhost:8000/docs",
            "2. Click 'Authorize' button", 
            "3. Enter one of the keys above based on the role you want to test",
            "4. Click 'Authorize'",
            "5. Test endpoints - access will be restricted based on the role"
        ]
    }


@router.post("/logout") 
async def logout():
    """
    Logout endpoint - Clerk handles session management client-side.
    """
    return {
        "success": True,
        "message": "Logout successful. Please clear your client-side session."
    }