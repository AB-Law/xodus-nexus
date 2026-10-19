import { expect, it } from 'vitest';
import { sessionFailureMessage, sessionStages } from './session-errors.js';

const line = (stage: string) => `NEXUS_SESSION_DIAGNOSTIC_V1 ${stage}\n`;
it('distinguishes expired sign-in, transient transport and renewal failures using fixed text', () => {
  expect(sessionFailureMessage(line('session-user-expired'))).toContain('Sign in again');
  expect(sessionFailureMessage(line('session-user-expired'))).toContain('has not been deleted');
  expect(sessionFailureMessage(line('ticket-timeout'))).toContain('timed out');
  expect(sessionFailureMessage(line('ticket-connect'))).toContain('connection');
  expect(sessionFailureMessage(line('session-device-refresh-failed'))).toContain('could not be renewed');
  expect(sessionFailureMessage(line('session-account-changed'))).toContain('account changed');
});
it('never displays arbitrary output, unknown codes, injected lines or incomplete markers', () => {
  for (const raw of ['private@example.test t=SECRET&p=SECRET', line('secret'),
    'prefix ' + line('session-user-expired'), line('ticket-timeout').trimEnd() + ' SECRET\n',
    'NEXUS_SESSION_DIAGNOSTIC_V1', line('ticket-retry'), line('session-device-refresh'),
    'NEXUS_SESSION_DIAGNOSTIC_V1 ' + 'x'.repeat(1000)]) expect(sessionFailureMessage(raw)).toBeUndefined();
  for (const code of sessionStages) expect(sessionFailureMessage(`user@example.test\n${line(code)}raw-secret`) ?? '').not.toMatch(/example\.test|raw-secret/);
});
it('uses the last actionable classification and bounds the inspected output', () => {
  expect(sessionFailureMessage(line('ticket-timeout') + line('ticket-retry') + line('ticket-connect'))).toContain('Could not connect');
  expect(sessionFailureMessage(line('ticket-timeout') + line('ticket-retry') + line('ticket-response-received') + 'entitlements rejected')).toBeUndefined();
  expect(sessionFailureMessage(line('session-user-expired') + 'x'.repeat(70_000))).toBeUndefined();
});
