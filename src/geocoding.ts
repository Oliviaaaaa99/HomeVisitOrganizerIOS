// Tier 1 geocoding via OpenStreetMap Nominatim — free, no API key.
//
// Production (Tech Design Doc §10.2) switches to Google Places Autocomplete +
// Details. Same shape — `geocode(query)` returns suggestions — so swapping
// providers is a one-file change.
//
// Nominatim policy: must send a User-Agent identifying the app and ≤ 1 req/s.
// Our 500ms debounce in AddPropertyScreen keeps us under that.

export type GeocodingResult = {
  displayName: string;
  lat: number;
  lon: number;
};

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export async function geocode(query: string): Promise<GeocodingResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url = `${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=0`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "HomeVisitOrganizer/Tier1-dev (https://github.com/Oliviaaaaa99/HomeVisitOrganizerIOS)",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`geocode ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;
  return data.map((d) => ({
    displayName: d.display_name,
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
  }));
}
