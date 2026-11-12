import pg from "pg";

let pool: pg.Pool | null = null;

export function databaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("需要 DATABASE_URL。");
  return url;
}

export function getPool() {
  if (!pool) pool = new pg.Pool({ connectionString: databaseUrl(), max: 10 });
  return pool;
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}
