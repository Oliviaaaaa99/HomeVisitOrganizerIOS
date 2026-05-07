// Tiny fetch wrapper. Auto-attaches the JWT, throws on non-2xx with the
// server's body so you can see real errors in the dev tools.
import { API } from "./config";
import { loadAccess } from "./storage";

export type Property = {
  id: string;
  user_id: string;
  address: string;
  kind: "rental" | "for_sale";
  status: "toured" | "shortlisted" | "rejected" | "archived";
  latitude?: number;
  longitude?: number;
  source_url?: string;
  created_at: string;
  updated_at: string;
};

export type Unit = {
  id: string;
  property_id: string;
  unit_label?: string;
  unit_type: string;
  price_cents?: number;
  sqft?: number;
  beds?: number;
  baths?: number;
  available_from?: string;
  created_at: string;
};

export type Note = {
  id: string;
  property_id: string;
  body: string;
  created_at: string;
};

export type PropertyDetail = Property & {
  units: Unit[];
  notes: Note[];
};

export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  refresh_expires_at: string;
  user_id: string;
};

async function fetchJSON<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${url}: ${text || "(no body)"}`);
  }
  return text ? JSON.parse(text) : ({} as T);
}

async function authed<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const access = await loadAccess();
  if (!access) throw new Error("not signed in");
  return fetchJSON<T>(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${access}`,
    },
  });
}

// --- auth ---

export async function devSignIn(idToken: string): Promise<AuthResponse> {
  return fetchJSON<AuthResponse>(`${API.USER}/v1/auth/exchange`, {
    method: "POST",
    body: JSON.stringify({ provider: "dev", id_token: idToken }),
  });
}

// --- properties ---

export async function listProperties(): Promise<{ items: Property[] }> {
  return authed<{ items: Property[] }>(`${API.PROPERTY}/v1/properties`);
}

export async function getProperty(id: string): Promise<PropertyDetail> {
  return authed<PropertyDetail>(`${API.PROPERTY}/v1/properties/${id}`);
}
