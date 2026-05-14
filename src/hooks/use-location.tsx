import { useState, useEffect } from "react";

type LocationState = {
  city: string | null;
  loading: boolean;
  error: string | null;
};

type GeoResult = {
  city: string | null;
  error: string | null;
};

const LOCATION_CITY_KEY = "lokal:geo:city";

let cachedCity: string | null = null;
let sharedLookupPromise: Promise<GeoResult> | null = null;

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

function resolveCityOnce(): Promise<GeoResult> {
  if (cachedCity) {
    return Promise.resolve({ city: cachedCity, error: null });
  }

  const storedCity = readStoredCity();
  if (storedCity) {
    cachedCity = storedCity;
    return Promise.resolve({ city: storedCity, error: null });
  }

  if (sharedLookupPromise) return sharedLookupPromise;

  sharedLookupPromise = new Promise<GeoResult>((resolve) => {
    if (!navigator.geolocation) {
      resolve({ city: null, error: "Geolocation not supported" });
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
        resolve({ city: null, error: getLocationErrorMessage(err.code) });
        sharedLookupPromise = null;
      },
      { timeout: 8000 },
    );
  });

  return sharedLookupPromise;
}

export function useLocation(): LocationState {
  const [city, setCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void resolveCityOnce().then((result) => {
      if (cancelled) return;
      setCity(result.city);
      setError(result.error);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { city, loading, error };
}
