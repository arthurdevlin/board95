import "dotenv/config";
import { Client } from "pg";

// Run once after migrations on PostgreSQL hosts supporting pg_cron (including Supabase).
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS pg_cron");
    const result = await client.query("SELECT cron.schedule($1, $2, $3) AS job_id", [
      "board95-archive-expired-listings", "*/5 * * * *", "SELECT public.board95_archive_expired_listings();",
    ]);
    console.log(`Listing cleanup scheduled every five minutes (job ${result.rows[0].job_id}).`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Could not schedule database cleanup. Use the authenticated HTTP job or application CLI scheduler instead.");
  process.exitCode = 1;
});
