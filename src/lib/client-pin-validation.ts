export type ClientPinValidationResult =
  | { ok: true }
  | { ok: false; error: string };

const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 6;
const PIN_DIGITS_ONLY = /^\d+$/;

/**
 * Validates a client PIN and its confirmation before hashing.
 * Keeps the rule in one pure function so it can be unit-tested
 * and reused by any form that sets or rotates a PIN.
 */
export function validateClientPin(
  pin: string,
  confirmPin: string
): ClientPinValidationResult {
  const trimmed = pin.trim();

  if (trimmed.length < PIN_MIN_LENGTH || trimmed.length > PIN_MAX_LENGTH) {
    return { ok: false, error: "El PIN debe tener entre 4 y 6 dígitos." };
  }

  if (!PIN_DIGITS_ONLY.test(trimmed)) {
    return { ok: false, error: "El PIN solo puede contener números." };
  }

  if (trimmed !== confirmPin.trim()) {
    return { ok: false, error: "Los PINs no coinciden." };
  }

  return { ok: true };
}
