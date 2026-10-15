function readCookie(name) {
  const prefix = `${name}=`;
  const cookie = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!cookie) return '';
  try { return decodeURIComponent(cookie.slice(prefix.length)); } catch { return ''; }
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined) headers.set('Content-Type','application/json');
  if (!['GET','HEAD','OPTIONS'].includes((options.method || 'GET').toUpperCase())) {
    const csrf = readCookie('srisah_csrf');
    if (csrf) headers.set('X-CSRF-Token',csrf);
  }
  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: 'include',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 204) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || `Request failed (${response.status}).`);
    error.code = result.error;
    error.status = response.status;
    throw error;
  }
  return result;
}

export function prettyDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',...(options.withTime?{hour:'numeric',minute:'2-digit'}:{})}).format(date);
}

export function prettyTime(value) {
  if (!value) return '';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date);
}
