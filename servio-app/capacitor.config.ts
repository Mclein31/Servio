import type { CapacitorConfig } from '@capacitor/cli';

const demo = process.env['SERVIO_BUILD'] === 'demo';

const config: CapacitorConfig = {
  appId: 'ph.servio.app',
  appName: 'SERVIO',
  webDir: 'www',
  server: { androidScheme: demo ? 'http' : 'https', cleartext: demo },
  android: { allowMixedContent: demo }
};

export default config;
