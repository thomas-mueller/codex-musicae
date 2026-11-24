import type { CapacitorConfig } from '@capacitor/cli';
import { appIdFor, editionOf } from './src/config/app-id';
import { TUNABLES } from './src/config/tunables';

const config: CapacitorConfig = {
  // GEN-011: CAP_EDITION=paid selects the paid app's ID; everything else is the free app (scripts/apply-edition.mjs does the same for Android and iOS).
  appId: appIdFor(editionOf(process.env['CAP_EDITION'])),
  appName: TUNABLES.identity.appName,
  webDir: 'dist/codexmusicae/browser',
  server: {
    androidScheme: 'https',
  },
};

export default config;
