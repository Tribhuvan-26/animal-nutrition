import { APP_PASSWORD, AUTH_COOKIE, AUTH_COOKIE_VALUE, SESSION_DURATION_SECONDS } from '@/app/auth/constants';

export const runtime = 'nodejs';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }

  if (!body?.password || body.password !== APP_PASSWORD) {
    return Response.json({ ok: false, error: 'Incorrect password' }, { status: 401 });
  }

  const cookie = `${AUTH_COOKIE}=${AUTH_COOKIE_VALUE}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION_SECONDS}`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie },
  });
}
