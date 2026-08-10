/**
 * Deployment configuration.
 *
 * Loaded as a classic script so it runs before the page's inline script — that
 * matters because window.apiFetch has to exist by the time the page makes its
 * first call.
 *
 * Only public values belong here. The Supabase publishable key is designed to
 * be shipped to browsers: every table has row level security enabled with no
 * policies, so this key by itself can read nothing. The service-role key lives
 * on the Render backend and must never appear in this file.
 */
window.APP_CONFIG = {
  // Direct to Render. An analysis runs for minutes, and a Vercel rewrite is a
  // gateway that gives up long before the pipeline finishes, so /api must not
  // be proxied. This makes the call cross-origin: CORS_ORIGINS on the backend
  // has to list this site's origin.
  API_BASE: 'https://aleweb-api-fra.onrender.com',
  SUPABASE_URL: 'https://bqhabywuwkolhaddnyns.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_Ptjp7Le0zQRxqlkBBLI6lA_ZVi_LinM',
};

// Local development against a backend on this machine.
if (['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.APP_CONFIG.API_BASE = 'http://localhost:8080';
}

/** Current Supabase access token; app-auth.js keeps this up to date. */
window.__authToken = null;

/**
 * fetch() against the API, carrying the signed-in user's token when there is
 * one. Public endpoints work without it; everything else answers 401.
 */
window.apiFetch = function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (window.__authToken) headers.set('authorization', `Bearer ${window.__authToken}`);
  return fetch(window.APP_CONFIG.API_BASE + path, { ...options, headers });
};
