import { describe, expect, it } from 'vitest';
import { assertDemoDatabase, assertDisposableDemoDatabase, DEMO } from '../src/demo/guard';
import { DEMO_BULLETIN, DEMO_IMAGES, DEMO_PROS } from '../src/demo/data';
import { SKU_ROWS } from '../src/db/catalog-data';

describe('demo dataset and database boundary', () => {
  it('accepts only explicit SERVIO local databases or a remote demo database', () => {
    for (const name of ['servio_dev','servio_test','servio_demo']) expect(assertDemoDatabase(`postgres://user@localhost:5432/${name}`, 'development').hostname).toBe('localhost');
    expect(assertDemoDatabase('postgres://user@dedicated.neon.tech/servio_demo', 'demo').pathname).toBe('/servio_demo');
    for (const url of ['postgres://user@localhost.evil.test/servio_dev', 'postgres://user@remote.test/servio_dev?branch=demo', 'postgres://user@localhost/other_project', 'https://localhost/servio_demo']) expect(() => assertDemoDatabase(url,'development')).toThrow();
    for (const environment of ['production','PRODUCTION',' prod ']) expect(() => assertDemoDatabase('postgres://user@localhost/servio_dev', environment)).toThrow('production');
  });
  it('never permits destructive reset/restore against dev/test or production', () => {
    expect(assertDisposableDemoDatabase('postgres://user@localhost/servio_demo','development').pathname).toBe('/servio_demo');
    for (const name of ['servio_dev','servio_test','other_project']) expect(() => assertDisposableDemoDatabase(`postgres://user@localhost/${name}`,'development')).toThrow();
    expect(() => assertDisposableDemoDatabase('postgres://user@localhost/servio_demo','production')).toThrow();
  });
  it('keeps identities separate and every offered/bulletin service in the existing fixed catalog', () => {
    expect(DEMO.customer).not.toBe(DEMO.tutor);
    expect(DEMO_PROS.find((p) => p.id === DEMO.tutor)?.name).toBe('Sofia R.');
    for (const sku of [...DEMO_PROS.flatMap((p) => p.skus), ...DEMO_BULLETIN.map((p) => p.skuId)]) expect(SKU_ROWS.some((s) => s.id === sku)).toBe(true);
    for (const image of DEMO_IMAGES) expect(image.key).toMatch(/^uploads\/(avatar|addon_evidence)\/2026\/10\/de000000-0000-4000-8000-[0-9a-f]{12}\.png$/);
  });
});
