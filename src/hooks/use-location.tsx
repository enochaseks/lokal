import { useState, useEffect } from "react";

type LocationState = {
  city: string | null;
  loading: boolean;
  error: string | null;
  refreshLocation: () => Promise<GeoResult>;
};

type GeoResult = {
  city: string | null;
  error: string | null;
};

const LOCATION_CITY_KEY = "lokal:geo:city";
const LOCATION_UPDATED_EVENT = "lokal:location-updated";

let cachedCity: string | null = null;
let sharedLookupPromise: Promise<GeoResult> | null = null;

function emitLocationUpdate(result: GeoResult): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GeoResult>(LOCATION_UPDATED_EVENT, { detail: result }));
}

async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { "Accept-Language": "en" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.county ||
      null
    );
  } catch {
    return null;
  }
}

function readStoredCity(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LOCATION_CITY_KEY);
  } catch {
    return null;
  }
}

function writeStoredCity(city: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCATION_CITY_KEY, city);
  } catch {
    // Ignore storage failures; location can still be used in-memory.
  }
}

function getLocationErrorMessage(code?: number): string {
  if (code === 1) return "Location access denied";
  if (code === 2) return "Location unavailable";
  if (code === 3) return "Location request timed out";
  return "Could not get location";
}

function resolveCity(options?: { forceRefresh?: boolean }): Promise<GeoResult> {
  const forceRefresh = options?.forceRefresh ?? false;
  const storedCity = readStoredCity();
  const fallbackCity = cachedCity ?? storedCity;

  if (!forceRefresh) {
    if (cachedCity) {
      return Promise.resolve({ city: cachedCity, error: null });
    }

    if (storedCity) {
      cachedCity = storedCity;
      return Promise.resolve({ city: storedCity, error: null });
    }
  }

  if (sharedLookupPromise) return sharedLookupPromise;

  sharedLookupPromise = new Promise<GeoResult>((resolve) => {
    if (!navigator.geolocation) {
      resolve(
        fallbackCity
          ? { city: fallbackCity, error: null }
          : { city: null, error: "Geolocation not supported" },
      );
      sharedLookupPromise = null;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const name = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        if (name) {
          cachedCity = name;
          writeStoredCity(name);
        }
        resolve({ city: name, error: name ? null : "Location unavailable" });
        sharedLookupPromise = null;
      },
      (err) => {
        resolve(
          fallbackCity
            ? { city: fallbackCity, error: null }
            : { city: null, error: getLocationErrorMessage(err.code) },
        );
        sharedLookupPromise = null;
      },
      { timeout: 8000, maximumAge: 0 },
    );
  });

  return sharedLookupPromise;
}

export function useLocation(): LocationState {
  const [city, setCity] = useState<string | null>(cachedCity ?? readStoredCity());
  const [loading, setLoading] = useState(city === null);
  const [error, setError] = useState<string | null>(null);

  const refreshLocation = async (): Promise<GeoResult> => {
    setLoading(true);
    const result = await resolveCity({ forceRefresh: true });
    setCity(result.city);
    setError(result.error);
    setLoading(false);
    emitLocationUpdate(result);
    return result;
  };

  useEffect(() => {
    let cancelled = false;

    const applyResult = (result: GeoResult) => {
      if (cancelled) return;
      setCity(result.city);
      setError(result.error);
      setLoading(false);
    };

    const refreshLocation = () => {
      void resolveCity({ forceRefresh: true }).then(applyResult);
    };

    refreshLocation();

    const onFocus = () => {
      refreshLocation();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshLocation();
      }
    };

    const onLocationUpdated = (event: Event) => {
      const detail = (event as CustomEvent<GeoResult>).detail;
      if (!detail) return;
      applyResult(detail);
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener(LOCATION_UPDATED_EVENT, onLocationUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener(LOCATION_UPDATED_EVENT, onLocationUpdated);
    };
  }, []);

  return { city, loading, error, refreshLocation };
}
