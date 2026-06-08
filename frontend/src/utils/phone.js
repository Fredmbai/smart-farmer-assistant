/**
 * Normalises a Kenyan phone number to E164 (+254XXXXXXXXX).
 * The Django backend stores numbers in E164 format (via the phonenumbers
 * library), so every API call that accepts a phone number must send E164.
 *
 * Handles:
 *   "0712345678"       → "+254712345678"
 *   "0712 345 678"     → "+254712345678"
 *   "+254712345678"    → "+254712345678"  (no-op)
 *   "254712345678"     → "+254712345678"
 */
export const normalizeKEPhone = (phone) => {
  const p = phone.trim().replace(/[\s\-()]/g, '');
  if (p.startsWith('0'))                          return '+254' + p.slice(1);
  if (p.startsWith('254') && !p.startsWith('+')) return '+' + p;
  return p; // already +254... or unknown — send as-is, backend validates
};
