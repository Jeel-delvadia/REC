from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, utcnow


class UserProfile(Base):
    """RS-21 (§9.5): one row per signed-in Supabase user, carrying the role/plant this app's
    own permission checks key off. Deliberately separate from Supabase's own auth.users table
    (which this app's Postgres session can't see - it's in Supabase's own schema) rather than
    trying to stash role in a JWT claim, which would require a custom Supabase auth hook to set
    safely. `id` is the Supabase user id (JWT `sub`), not a locally-generated key, so it's a
    1:1 join key back to whichever account actually signed in.
    """

    __tablename__ = "user_profiles"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # Supabase auth `sub`
    email: Mapped[str] = mapped_column(String(255), index=True)
    # registry_admin | regulator | auditor | plant_operator | buyer. Never "public" - that's
    # the unauthenticated default for anyone hitting /verify/:recId, not a row in this table.
    role: Mapped[str] = mapped_column(String(32), default="auditor")
    # Only meaningful for plant_operator - which single plant they're scoped to.
    plant_id: Mapped[str | None] = mapped_column(ForeignKey("plants.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
