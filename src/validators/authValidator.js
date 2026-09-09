const usernamePattern = /^[a-z0-9_.]{3,32}$/;

const validateSignup = (body) => {
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!firstName || !lastName) {
    return { error: 'First name and last name are required' };
  }
  if (!usernamePattern.test(username)) {
    return { error: 'Username must be 3-32 characters using lowercase letters, numbers, underscore, or period' };
  }
  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }
  return { value: { firstName, lastName, username, password } };
};

const validateLogin = (body) => {
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!username || !password) {
    return { error: 'Username and password are required' };
  }
  return { value: { username, password } };
};

const validateProfileUpdate = (body) => {
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  if (!firstName || !lastName) {
    return { error: 'First name and last name are required' };
  }
  return { value: { firstName, lastName } };
};

const validatePasswordReset = (body) => {
  const token = String(body.token || '');
  const password = String(body.password || '');
  if (!token || password.length < 6) {
    return { error: 'A reset token and password of at least 6 characters are required' };
  }
  return { value: { token, password } };
};

module.exports = { validateSignup, validateLogin, validateProfileUpdate, validatePasswordReset };
