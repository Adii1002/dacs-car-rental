/**
 * Shared validation for forms. Returns error message or null if valid.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/; // Indian mobile: 10 digits starting with 6-9

export function validateRequired(value, fieldName = 'This field') {
  const v = typeof value === 'string' ? value.trim() : value;
  if (v === '' || v == null) return `${fieldName} is required.`;
  return null;
}

export function validateEmail(value) {
  const err = validateRequired(value, 'Email');
  if (err) return err;
  if (!EMAIL_REGEX.test(value.trim())) return 'Please enter a valid email address.';
  return null;
}

export function validatePhone(value) {
  const err = validateRequired(value, 'Phone number');
  if (err) return err;
  const digits = value.replace(/\D/g, '');
  let num = digits;
  if (digits.length === 11 && digits.startsWith('0')) num = digits.slice(1);
  else if (digits.length === 12 && digits.startsWith('91')) num = digits.slice(2);
  if (num.length !== 10 || !PHONE_REGEX.test(num)) return 'Please enter a valid 10-digit mobile number.';
  return null;
}

export function validateName(value) {
  const err = validateRequired(value, 'Name');
  if (err) return err;
  if (value.trim().length < 2) return 'Name must be at least 2 characters.';
  return null;
}

export function validatePositiveNumber(value, fieldName = 'Value') {
  const n = Number(value);
  if (Number.isNaN(n) || n < 1) return `${fieldName} must be a positive number.`;
  return null;
}

export function validateUrl(value) {
  const err = validateRequired(value, 'Image URL');
  if (err) return err;
  try {
    new URL(value.trim());
    return null;
  } catch {
    return 'Please enter a valid URL.';
  }
}
