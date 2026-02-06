export function validateName(name) {
  const nameRegex = /^[a-zA-Z]+$/;
  return nameRegex.test(name);
}


export function validateEmail(email) {
  const emailRegex = /^[^/s@]+@[^/s@]+\.[^/s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password) {
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}
