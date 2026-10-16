// Client-side mirror of backend/src/validators/auth.validator.js (the server stays the source of truth).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function validateRegister({ name, username, email, password }) {
  const e = {};
  if (!name.trim()) e.name = 'Name is required';
  else if (name.trim().length > 50) e.name = 'Name must be at most 50 characters';

  if (!USERNAME_RE.test(username.trim().toLowerCase())) e.username = 'Username must be 3-20 characters: letters, numbers, underscore';
  if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address';

  if (password.length < 8) e.password = 'Password must be at least 8 characters';
  else if (!/[A-Za-z]/.test(password)) e.password = 'Password must contain a letter';
  else if (!/\d/.test(password)) e.password = 'Password must contain a number';
  return e;
}

export function validateLogin({ identifier, password }) {
  const e = {};
  if (!identifier.trim()) e.identifier = 'Email or username is required';
  if (!password) e.password = 'Password is required';
  return e;
}

// Turns the API's { details: [{field, message}] } into { field: message }
export function fieldErrorsFromApi(error) {
  const out = {};
  for (const d of error?.details || []) if (d.field && !out[d.field]) out[d.field] = d.message;
  return out;
}
