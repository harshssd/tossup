import posthog from 'posthog-js';

const POSTHOG_API_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = 'https://us.i.posthog.com';

const APP_NAME = 'tossup';

export function initAnalytics(): void {
  if (typeof window === 'undefined') return;
  if (!POSTHOG_API_KEY) return;
  try {
    posthog.init(POSTHOG_API_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
    });
    posthog.register({ app_name: APP_NAME });
  } catch {}
}

export function trackEvent(event: string, properties?: Record<string, string | number | boolean>): void {
  try {
    posthog.capture(event, properties);
  } catch {}
}
