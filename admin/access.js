export async function requireAdminSession() {
  let authenticated = false;
  let staticHost = false;
  try {
    const response = await fetch('/api/admin-auth', { credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
    staticHost = response.status === 404;
    authenticated = response.ok && (await response.json()).authenticated === true;
  } catch { /* Fail closed when session status cannot be verified. */ }
  if (!authenticated) {
    location.replace(staticHost ? '/admin/login.html' : '/admin/');
    throw new Error('Admin sign-in required.');
  }
}
