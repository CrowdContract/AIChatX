# Vercel Python serverless entrypoint.
# Vercel looks for a module-level `app` (ASGI) in this file.
from main import app  # noqa: F401
