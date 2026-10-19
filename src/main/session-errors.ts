/** Fixed codes only. Never return an arbitrary backend/provider message. */
export const sessionStages = new Set([
  'session-user-unavailable', 'session-user-expired', 'session-user-invalid',
  'session-device-unavailable', 'session-device-invalid', 'session-device-refresh',
  'session-device-refresh-failed', 'session-account-changed',
  'ticket-timeout', 'ticket-connect', 'ticket-network', 'ticket-response', 'ticket-retry', 'ticket-response-received',
]);

export function sessionFailureMessage(output: string): string | undefined {
  let last: string | undefined;
  for (const line of output.slice(-64_000).split(/\r?\n/)) {
    const match = /^NEXUS_SESSION_DIAGNOSTIC_V1 ([a-z-]{1,60})$/.exec(line);
    if (match?.[1] === 'ticket-response-received') last = undefined;
    else if (match && sessionStages.has(match[1]) && !['ticket-retry', 'session-device-refresh'].includes(match[1])) last = match[1];
  }
  if (last === 'session-user-unavailable') return 'Stored Microsoft sign-in could not be read. Unlock the system keyring and try Refresh again; if it persists, sign in again in Settings.';
  if (last === 'session-user-expired' || last === 'session-user-invalid') return 'Your Microsoft sign-in has expired or is invalid. Sign in again in Settings. Your saved account has not been deleted.';
  if (last === 'session-device-unavailable' || last === 'session-device-invalid') return 'Microsoft device credentials are unavailable. Check that the system keyring is unlocked, then sign in again in Settings.';
  if (last === 'session-device-refresh-failed') return 'Microsoft device sign-in could not be renewed. Check your connection and try Refresh again. Your saved account has not been deleted.';
  if (last === 'session-account-changed') return 'The Microsoft account changed during this request. Refresh the library again.';
  if (last === 'ticket-timeout') return 'Microsoft Store sign-in timed out. Check your connection and try Refresh again.';
  if (last === 'ticket-connect' || last === 'ticket-network') return 'Could not connect to Microsoft Store sign-in. Check your connection and try Refresh again.';
  if (last === 'ticket-response') return 'Microsoft Store sign-in returned an unusable response. Try Refresh again; if it persists, share the backend diagnostic log.';
}
