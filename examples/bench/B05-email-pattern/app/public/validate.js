export function validateEmail(email) {
  return /^[A-Z]+@[A-Z]+$/.test(email);   // BUG: only uppercase addresses are accepted
}
