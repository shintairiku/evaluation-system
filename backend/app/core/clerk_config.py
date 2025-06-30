import os
from clerk_sdk.client import ClerkClient


CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY")

clerk_client = ClerkClient(secret_key=CLERK_SECRET_KEY)
