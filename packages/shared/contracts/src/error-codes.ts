// Error codes from the `ErrorDetails.code` description in openapi.yaml.
// The spec lists them as text (not an enum) so new codes don't break the contract,
// so this list is kept by hand: when you add a code to the spec, add it here too.
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  TRUST_TOO_LOW: 'TRUST_TOO_LOW',
  NOT_FOUND: 'NOT_FOUND',
  LOCK_MISMATCH: 'LOCK_MISMATCH',
  SET_PARENT_HAS_RESULT: 'SET_PARENT_HAS_RESULT',
  LICENSE_REQUIRED: 'LICENSE_REQUIRED',
  NOT_A_SET: 'NOT_A_SET',
  SET_CHILD_NOT_PUBLISHABLE: 'SET_CHILD_NOT_PUBLISHABLE',
  SET_CHILD_EDIT_VIA_PARENT: 'SET_CHILD_EDIT_VIA_PARENT',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
