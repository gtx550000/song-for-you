import { randomBytes } from 'node:crypto';
import { isSharePayload, type SharePayload } from './sharePayload';

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured');
  }

  return {
    endpoint: `${url.replace(/\/+$/, '')}/rest/v1/shared_links`,
    serviceRoleKey,
  };
}

function getHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
}

export async function createSharedLink(payload: SharePayload): Promise<string> {
  const { endpoint, serviceRoleKey } = getSupabaseConfig();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomBytes(6).toString('base64url');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...getHeaders(serviceRoleKey),
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ code, payload }),
      cache: 'no-store',
    });

    if (response.ok) return code;
    if (response.status === 409) continue;

    throw new Error(`Supabase could not create shared link (HTTP ${response.status})`);
  }

  throw new Error('Could not allocate a unique shared-link code after 5 attempts');
}

export async function getSharedLink(code: string): Promise<SharePayload | null> {
  const { endpoint, serviceRoleKey } = getSupabaseConfig();
  const query = new URLSearchParams({
    select: 'payload',
    code: `eq.${code}`,
    limit: '1',
  });
  const response = await fetch(`${endpoint}?${query}`, {
    headers: getHeaders(serviceRoleKey),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Supabase could not read shared link (HTTP ${response.status})`);
  }

  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row: unknown = rows[0];
  if (typeof row !== 'object' || row === null || !('payload' in row) || !isSharePayload(row.payload)) {
    throw new Error('Supabase returned an invalid shared-link payload');
  }

  return row.payload;
}
