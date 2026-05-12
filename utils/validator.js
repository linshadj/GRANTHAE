export function validateName(name) {
  const nameRegex = /^[a-zA-Z]+$/;
  return nameRegex.test(name);
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(normalizeEmail(email));
}

export function validatePassword(password) {
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}
