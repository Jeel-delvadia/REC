import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// RS-16: both are safe to ship to the browser - the anon key only grants what Supabase's
// Row Level Security policies allow, which for this app is nothing (we don't query Supabase
// tables directly, only use it for auth). Never put the service_role key here.
export const supabaseEnabled = Boolean(url && anonKey);

export const supabase = supabaseEnabled
  ? createClient(url, anonKey)
  : null;

if (!supabaseEnabled) {
  console.warn(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set - auditor login is disabled and ' +
    'every write request falls back to the backend\'s local-dev identity. See RS-16 setup.'
  );
}
