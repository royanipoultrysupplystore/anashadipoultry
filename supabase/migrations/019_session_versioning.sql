-- Migration 019: session versioning for app_users.
-- Bumping session_version on the server invalidates every currently-open client
-- session for that user (the client re-checks it on an interval / focus and logs
-- out on mismatch). UI-level protection, not real token invalidation.
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION bump_session_version(p_id UUID)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE app_users
  SET session_version = session_version + 1
  WHERE id = p_id
  RETURNING session_version;
$$;

-- WHERE id IS NOT NULL is a no-op filter that satisfies Supabase's
-- pg-safeupdate extension (which blocks WHERE-less UPDATEs even inside
-- SECURITY DEFINER functions).
CREATE OR REPLACE FUNCTION bump_all_session_versions()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE app_users SET session_version = session_version + 1 WHERE id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION bump_session_version(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION bump_all_session_versions() TO anon, authenticated;
