class NotFoundError(LookupError):
    """Raised by services when a requested record doesn't exist. main.py turns it into a 404."""
