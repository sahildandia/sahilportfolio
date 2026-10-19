const form = document.querySelector('#admin-login');
const button = document.querySelector('#login-button');
const status = document.querySelector('#login-status');
let configured = false;
function message(text, error = false) { status.textContent = text; status.dataset.error = String(error); }
try {
  const response = await fetch('/api/admin-auth', { credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
  if (!response.ok) throw new Error();
  const state = await response.json();
  if (state.authenticated) location.replace('/admin/');
  else if (!state.configured) message('Sign-in is not configured correctly. Redeploy the latest code on Vercel, or start the local site with npm run dev.', true);
  else { configured = true; button.disabled = false; message('Enter your private admin credentials.'); }
} catch { message('Sign-in could not reach the server. Serve this site through Vercel or the Node development server and try again.', true); }
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!configured || !form.reportValidity()) return;
  button.disabled = true;
  message('Signing in…');
  const id = form.elements.id.value.trim();
  let password = form.elements.password.value;
  form.elements.password.value = '';
  try {
    const response = await fetch('/api/admin-auth', { method: 'POST', credentials: 'same-origin', redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', id, password }) });
    password = '';
    const result = await response.json();
    if (!response.ok || !result.authenticated) throw new Error(result.error || 'Sign-in failed. Please try again.');
    message('Signed in. Opening your editor…');
    location.replace('/admin/');
  } catch (error) { message(error.message || 'Sign-in failed. Please try again.', true); button.disabled = false; }
  finally { password = ''; }
});
