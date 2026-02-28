export { UserAgentRotator, userAgentRotator } from './UserAgentRotator.js';
export { ViewportManager, viewportManager } from './ViewportManager.js';

// Locale and timezone configuration for Italian users
export const localeConfig = {
  locale: 'it-IT',
  timezone: 'Europe/Rome',
  languages: ['it-IT', 'it', 'en-US', 'en'],
  acceptLanguage: 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
};

// Geolocation for Italy (Rome center)
export const geoConfig = {
  latitude: 41.9028,
  longitude: 12.4964,
  accuracy: 100,
};

/**
 * Get complete browser context options for stealth
 */
export function getStealthContextOptions() {
  const { userAgentRotator } = require('./UserAgentRotator.js');
  const { viewportManager } = require('./ViewportManager.js');

  const ua = userAgentRotator.getRandomUserAgent();
  const viewport = viewportManager.getRandomizedViewport();

  return {
    userAgent: ua.ua,
    viewport,
    locale: localeConfig.locale,
    timezoneId: localeConfig.timezone,
    geolocation: geoConfig,
    permissions: ['geolocation'],
    extraHTTPHeaders: {
      'Accept-Language': localeConfig.acceptLanguage,
    },
    // Disable webdriver flag
    javaScriptEnabled: true,
    bypassCSP: false,
    ignoreHTTPSErrors: false,
  };
}
