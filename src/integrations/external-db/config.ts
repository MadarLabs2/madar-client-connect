/** Platform Supabase defaults — override via VITE_EXTERNAL_DB_* / env in production. */
export const EXTERNAL_DB_DEFAULT_URL = "https://hijpjiyvnrdqffmszwgr.supabase.co";
export const EXTERNAL_DB_DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpanBqaXl2bnJkcWZmbXN6d2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNDY1NDEsImV4cCI6MjA5NzYyMjU0MX0.xK19p5LTvuJMSaaX3_S5BTf1eG-8PdbF5eGzLPNHsKA";

export function getExternalDbUrl(): string {
  return (
    process.env.EXTERNAL_DB_URL ||
    process.env.SUPABASE_URL ||
    EXTERNAL_DB_DEFAULT_URL
  );
}

export function getExternalDbAnonKey(): string {
  return (
    process.env.EXTERNAL_DB_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    EXTERNAL_DB_DEFAULT_ANON_KEY
  );
}

export function getExternalDbServiceRoleKey(): string | undefined {
  return (
    process.env.EXTERNAL_DB_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    undefined
  );
}
