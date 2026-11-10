import { ApiError } from '../../../shared/api/http'

/** Czech text for an auth error. Codes are the API's (openapi.yaml); anything else shows the server's detail. */
export function authErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Něco se pokazilo. Zkuste to prosím znovu.'
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'Nesprávný e-mail nebo heslo.'
    case 'ACCOUNT_BLOCKED':
      return 'Váš účet byl zablokován moderací.'
    case 'EMAIL_TAKEN':
      return 'Účet s tímto e-mailem už existuje.'
    case 'USERNAME_TAKEN':
      return 'Toto uživatelské jméno je obsazené.'
    case 'CSRF_CHECK_FAILED':
      return 'Požadavek byl odmítnut (chybí bezpečnostní hlavička). Načtěte stránku znovu.'
    default:
      return error.status === 0 ? error.message : error.message || 'Požadavek selhal.'
  }
}
