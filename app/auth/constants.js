// Auth constants. NOTE: hardcoded password is intentional for this single-user app —
// not a best practice for production; treat the repo as private.
export const APP_PASSWORD = 'Rudransh@2024';
// Demo credential so the app can be shown without handing over the real password.
// It grants the SAME 7-day session as the real one — pull it before this repo
// ever goes public.
export const DEMO_PASSWORD = 'demo1234';
export const AUTH_COOKIE = 'aish_auth';
export const AUTH_COOKIE_VALUE = 'ok';
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days
