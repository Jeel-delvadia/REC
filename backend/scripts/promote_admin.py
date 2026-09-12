"""RS-21 (§9.5) bootstrap: grants a role directly against the database, for the one problem
RBAC can't solve on its own - nobody can be registry_admin until someone already is.

The target user must have signed in at least once already (that's what creates their
UserProfile row, defaulted to "auditor" - see app/core/auth.py's _resolve_profile). Run this
after they've logged in for the first time, not before.

Usage, from backend/ with the venv active:
    python -m scripts.promote_admin --email you@example.com
    python -m scripts.promote_admin --email ops@example.com --role plant_operator --plant-id PLT-003
"""
import argparse
import sys

from sqlalchemy import select

from app.core.auth import ROLES
from app.core.database import SessionLocal
from app.models import UserProfile


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", required=True, help="Email of the already-signed-in account to promote.")
    parser.add_argument("--role", default="registry_admin", choices=ROLES)
    parser.add_argument("--plant-id", default=None, help="Required when --role is plant_operator.")
    args = parser.parse_args()

    if args.role == "plant_operator" and not args.plant_id:
        parser.error("--plant-id is required when --role plant_operator")

    db = SessionLocal()
    try:
        profile = db.scalars(select(UserProfile).where(UserProfile.email == args.email)).first()
        if profile is None:
            print(
                f"No user profile found for '{args.email}'. They need to sign in at least once first - "
                f"UserProfile rows are created automatically on a user's first authenticated request.",
                file=sys.stderr,
            )
            return 1

        old_role = profile.role
        profile.role = args.role
        profile.plant_id = args.plant_id if args.role == "plant_operator" else None
        db.commit()
        print(f"{args.email}: {old_role} -> {profile.role}" + (f" (plant {profile.plant_id})" if profile.plant_id else ""))
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
