import type { CapacitorConfig } from '@capacitor/cli';
import { TUNABLES } from './src/config/tunables';

const config: CapacitorConfig = {
  appId: TUNABLES.identity.appId,
  appName: TUNABLES.identity.appName,
  webDir: 'dist/codexmusicae/browser',
  server: {
    androidScheme: 'https',
  },
};

export default config;
