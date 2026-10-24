import type { CapacitorConfig } from '@capacitor/cli'

const allowHttpForLanDevelopment = process.env.CAPACITOR_ALLOW_HTTP === '1'

const config: CapacitorConfig = {
  appId: 'com.civicvision.ai',
  appName: 'CivicVision AI',
  webDir: 'out',
  android: {
    allowMixedContent: allowHttpForLanDevelopment,
  },
  server: allowHttpForLanDevelopment ? { cleartext: true } : undefined,
}

export default config
