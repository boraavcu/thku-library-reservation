export const LOGIN_WINDOW_SECONDS = 15 * 60;
export const LOGIN_MAX_FAILURES = 8;

export const RECORD_LOGIN_FAILURE_SQL = `
INSERT INTO auth_rate_limits (id, bucket, failures, window_start, updated_at)
VALUES ($1::uuid, $2, 1, NOW(), NOW())
ON CONFLICT (bucket) DO UPDATE SET
  failures = CASE
    WHEN auth_rate_limits.window_start <= NOW() - ($3::int * INTERVAL '1 second') THEN 1
    ELSE auth_rate_limits.failures + 1
  END,
  window_start = CASE
    WHEN auth_rate_limits.window_start <= NOW() - ($3::int * INTERVAL '1 second') THEN NOW()
    ELSE auth_rate_limits.window_start
  END,
  updated_at = NOW()
RETURNING failures
`;

export const CLEAR_LOGIN_BUCKET_SQL = `DELETE FROM auth_rate_limits WHERE bucket = $1`;

export async function recordLoginFailure(db, { id, bucket, windowSeconds = LOGIN_WINDOW_SECONDS }) {
  const rows = await db.query(RECORD_LOGIN_FAILURE_SQL, [id, bucket, windowSeconds]);
  const failures = Number(rows[0]?.failures || 0);
  return { failures, limited: failures > LOGIN_MAX_FAILURES };
}
