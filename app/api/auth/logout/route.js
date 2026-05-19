import { AUTH_COOKIE } from '@/app/auth/constants';

export const runtime = 'nodejs';

export async function POST() {
  const cookie = `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie },
  });
}
