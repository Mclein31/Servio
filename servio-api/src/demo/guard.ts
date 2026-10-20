export function assertDemoDatabase(raw: string | undefined, environment?: string): URL {
  if (['production', 'prod'].includes(environment?.trim().toLowerCase() ?? '')) throw new Error('Demo tools are disabled in production.');
  if (!raw) throw new Error('Set the SERVIO database URL before running demo tools.');
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Demo tools require Postgres.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!local && !['servio_demo', 'demo'].includes(name)) throw new Error('Use localhost or a database named servio_demo/demo.');
  if (local && !/^servio_(dev|test|demo)$/.test(name) && name !== 'demo') throw new Error('Local demo tools only access SERVIO databases.');
  return url;
}

export const demoId = (n: number) => `de000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
export const DEMO = { customer: demoId(1), daniel: demoId(2), chris: demoId(3), ava: demoId(4), kevin: demoId(5), tutor: demoId(6), admin: demoId(7), active: demoId(100) } as const;

export function assertDisposableDemoDatabase(raw: string | undefined, environment?: string): URL {
  const url=assertDemoDatabase(raw,environment);
  if (!['servio_demo','demo'].includes(decodeURIComponent(url.pathname.slice(1)))) throw new Error('Destructive tools require a dedicated servio_demo/demo database; dev/test are preserved.');
  return url;
}
