import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.opslingolite',
  appName: 'OpsLingo Lite',
  webDir: 'dist',
  android: {
    allowMixedContent: false
  }
};

export default config;
