type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

type PlausibleFn = (eventName: string, options?: { props?: AnalyticsProps }) => void;
type GtagFn = (command: "event", eventName: string, params?: AnalyticsProps) => void;

function toSerializableProps(props?: AnalyticsProps): AnalyticsProps {
  if (!props) return {};
  const safe: AnalyticsProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    safe[key] = value;
  }
  return safe;
}

export function trackEvent(eventName: string, props?: AnalyticsProps) {
  if (typeof window === "undefined") return;

  const safeProps = toSerializableProps(props);

  try {
    window.dispatchEvent(
      new CustomEvent("lokal:analytics", { detail: { eventName, props: safeProps } }),
    );
  } catch {
    // Ignore CustomEvent errors in older browsers.
  }

  try {
    const plausible = (window as Window & { plausible?: PlausibleFn }).plausible;
    if (typeof plausible === "function") plausible(eventName, { props: safeProps });
  } catch {
    // Do not fail UX if analytics call fails.
  }

  try {
    const gtag = (window as Window & { gtag?: GtagFn }).gtag;
    if (typeof gtag === "function") gtag("event", eventName, safeProps);
  } catch {
    // Do not fail UX if analytics call fails.
  }

  if (import.meta.env.DEV) {
    // Keep this visible in dev so funnel instrumentation can be verified quickly.
    console.info("[analytics]", eventName, safeProps);
  }
}

export function trackEventOnce(eventName: string, onceKey: string, props?: AnalyticsProps) {
  if (typeof window === "undefined") return false;
  const storageKey = `lokal:event:${onceKey}`;

  try {
    if (window.localStorage.getItem(storageKey)) return false;
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // If storage is blocked, emit event anyway.
  }

  trackEvent(eventName, props);
  return true;
}
