import { connect } from 'cloudflare:sockets';
import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMessage, dotStuff, sendMail } from '../src/lib/mailer';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.mocked(connect).mockReset(); });

const mail = { to: 'recipient@servio.test', subject: 'SERVIO code', text: 'Your code is 654321.' };
const configured = () => ({ ...env, SMTP_USER: 'sender@servio.test', SMTP_PASSWORD: 'test-only-password' });

function socketFixture(replies?: string) {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const writes: string[] = [];
  const readable = new ReadableStream<Uint8Array>({ start(c) {
    controller = c;
    if (replies) c.enqueue(new TextEncoder().encode(replies));
  } });
  const close = vi.fn(async () => { controller.close(); });
  const writable = new WritableStream<Uint8Array>({ write(chunk) { writes.push(new TextDecoder().decode(chunk)); } });
  vi.mocked(connect).mockReturnValue({ readable, writable, close } as unknown as ReturnType<typeof connect>);
  return { close, writes };
}

describe('sign-in email delivery', () => {
  it('delivers over TLS and clears the timeout after SMTP accepts the message', async () => {
    vi.useFakeTimers();
    const fixture = socketFixture('220 Ready\r\n250-server\r\n250 AUTH PLAIN\r\n235 Authenticated\r\n250 Sender\r\n250 Recipient\r\n354 Data\r\n250 Queued\r\n');
    expect(await sendMail(configured(), mail, 'test')).toBe('sent');
    expect(connect).toHaveBeenCalledWith({ hostname: 'smtp.gmail.com', port: 465 }, { secureTransport: 'on', allowHalfOpen: false });
    expect(fixture.writes.join('')).toContain('RCPT TO:<recipient@servio.test>');
    expect(fixture.writes.at(-1)).toBe('QUIT\r\n');
    expect(fixture.close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('closes a stalled SMTP connection when the delivery timeout expires', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fixture = socketFixture();
    const pending = expect(sendMail(configured(), mail, 'test')).rejects.toMatchObject({ status: 502, code: 'EMAIL_FAILED' });
    await vi.advanceTimersByTimeAsync(15_000);
    await pending;
    expect(fixture.close).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps log-only codes in development and refuses missing production credentials', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await sendMail({ ...env, ENVIRONMENT: 'development', SMTP_USER: '', SMTP_PASSWORD: '' }, mail, 'test')).toBe('logged');
    expect(log).toHaveBeenCalledTimes(1);
    await expect(sendMail({ ...env, ENVIRONMENT: 'production', SMTP_USER: '', SMTP_PASSWORD: '' }, mail, 'test'))
      .rejects.toMatchObject({ status: 503, code: 'EMAIL_UNAVAILABLE' });
    expect(log).toHaveBeenCalledTimes(1);
    expect(connect).not.toHaveBeenCalled();
  });

  it('blocks header injection and encodes message content safely', () => {
    expect(() => buildMessage({ from: 'sender@servio.test', fromName: 'SERVIO', ...mail, subject: 'Code\r\nBcc: intruder@servio.test' })).toThrow('Header injection blocked');
    expect(buildMessage({ from: 'sender@servio.test', fromName: 'SERVIO', ...mail })).toContain('Content-Transfer-Encoding: base64');
    expect(dotStuff('.first\r\n.second')).toBe('..first\r\n..second');
  });
});
