// Tiny fetch wrapper. Auto-attaches the JWT, throws on non-2xx with the
// server's body so you can see real errors in the dev tools.
//
// On 401 we transparently try the refresh token once. If that also fails we
// clear local tokens and notify whoever registered an "auth expired"
// callback (App.tsx routes back to the sign-in screen).
import { API } from "./config";
import { clearTokens, loadAccess, loadRefresh, saveTokens } from "./storage";

// Allows App.tsx to react to permanent auth failure without coupling the
// API layer to the routing layer.
let onAuthExpired: (() => void) | null = null;
export function setOnAuthExpired(cb: () => void) {
  onAuthExpired = cb;
}

export type Property = {
  id: string;
  user_id: string;
  address: string;
  kind: "rental" | "for_sale";
  latitude?: number;
  longitude?: number;
  source_url?: string;
  created_at: string;
  updated_at: string;
};

export type UnitStatus = "toured" | "shortlisted" | "rejected" | "archived";

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
  status: UnitStatus;
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

export type MediaItem = {
  id: string;
  unit_id: string;
  media_type: "photo" | "video_short" | "video_long";
  s3_key: string;
  url: string;
  caption?: string;
  captured_at: string;
  expires_at: string;
};

export type PresignedUpload = {
  s3_key: string;
  url: string;
  expires_at: string;
  media_type: string;
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
  if (!access) {
    if (onAuthExpired) onAuthExpired();
    throw new Error("not signed in");
  }

  const fire = async (token: string) =>
    fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

  let res = await fire(access);

  if (res.status === 401) {
    // Try the refresh token exactly once.
    const refreshTok = await loadRefresh();
    if (refreshTok) {
      try {
        const fresh = await refreshSession(refreshTok);
        await saveTokens(fresh.access_token, fresh.refresh_token, fresh.user_id);
        res = await fire(fresh.access_token);
      } catch {
        await clearTokens();
        if (onAuthExpired) onAuthExpired();
        throw new Error("session expired — please sign in again");
      }
    } else {
      await clearTokens();
      if (onAuthExpired) onAuthExpired();
      throw new Error("session expired — please sign in again");
    }
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${url}: ${text || "(no body)"}`);
  }
  return text ? JSON.parse(text) : ({} as T);
}

async function refreshSession(refreshToken: string): Promise<AuthResponse> {
  return fetchJSON<AuthResponse>(`${API.USER}/v1/auth/refresh`, {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

// --- auth ---

export async function devSignIn(idToken: string): Promise<AuthResponse> {
  return fetchJSON<AuthResponse>(`${API.USER}/v1/auth/exchange`, {
    method: "POST",
    body: JSON.stringify({ provider: "dev", id_token: idToken }),
  });
}

export type Me = {
  id: string;
  provider: string;
  email_hash?: string;
  avatar_url?: string;
  created_at: string;
};

export async function getMe(): Promise<Me> {
  return authed<Me>(`${API.USER}/v1/users/me`);
}

export type AvatarPresign = {
  s3_key: string;
  url: string;
  expires_at: string;
};

export async function presignAvatar(): Promise<AvatarPresign> {
  return authed<AvatarPresign>(`${API.USER}/v1/users/me/avatar:presign`, {
    method: "POST",
  });
}

export async function commitAvatar(
  s3Key: string,
): Promise<{ s3_key: string; avatar_url: string }> {
  return authed<{ s3_key: string; avatar_url: string }>(
    `${API.USER}/v1/users/me/avatar:commit`,
    {
      method: "POST",
      body: JSON.stringify({ s3_key: s3Key }),
    },
  );
}

export async function deleteAvatar(): Promise<void> {
  const access = await loadAccess();
  if (!access) throw new Error("not signed in");
  const res = await fetch(`${API.USER}/v1/users/me/avatar`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!res.ok) {
    throw new Error(`${res.status} delete avatar: ${await res.text()}`);
  }
}

// --- properties ---

export async function listProperties(): Promise<{ items: Property[] }> {
  return authed<{ items: Property[] }>(`${API.PROPERTY}/v1/properties`);
}

export async function getProperty(id: string): Promise<PropertyDetail> {
  return authed<PropertyDetail>(`${API.PROPERTY}/v1/properties/${id}`);
}

export type CreatePropertyInput = {
  address: string;
  kind: "rental" | "for_sale";
  latitude?: number;
  longitude?: number;
  source_url?: string;
};

export async function createProperty(input: CreatePropertyInput): Promise<Property> {
  return authed<Property>(`${API.PROPERTY}/v1/properties`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateUnitStatus(
  unitId: string,
  status: UnitStatus,
): Promise<Unit> {
  return authed<Unit>(`${API.PROPERTY}/v1/units/${unitId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export type UpdatePropertyInput = {
  address?: string;
  kind?: "rental" | "for_sale";
  source_url?: string; // pass "" to clear
  latitude?: number;
  longitude?: number;
};

export async function updateProperty(
  id: string,
  input: UpdatePropertyInput,
): Promise<Property> {
  return authed<Property>(`${API.PROPERTY}/v1/properties/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export type CreateUnitInput = {
  unit_type: string;
  unit_label?: string;
  price_cents?: number;
  sqft?: number;
  beds?: number;
  baths?: number;
  available_from?: string; // YYYY-MM-DD
};

export async function createUnit(
  propertyId: string,
  input: CreateUnitInput,
): Promise<Unit> {
  return authed<Unit>(`${API.PROPERTY}/v1/properties/${propertyId}/units`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type UpdateUnitInput = {
  unit_label?: string; // "" clears
  unit_type?: string;
  price_cents?: number;
  sqft?: number;
  beds?: number;
  baths?: number;
  status?: UnitStatus;
};

export async function updateUnit(
  unitId: string,
  input: UpdateUnitInput,
): Promise<Unit> {
  return authed<Unit>(`${API.PROPERTY}/v1/units/${unitId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteUnit(unitId: string): Promise<void> {
  const access = await loadAccess();
  if (!access) throw new Error("not signed in");
  const res = await fetch(`${API.PROPERTY}/v1/units/${unitId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!res.ok) throw new Error(`${res.status} delete unit: ${await res.text()}`);
}

export async function createNote(
  propertyId: string,
  body: string,
): Promise<Note> {
  return authed<Note>(`${API.PROPERTY}/v1/properties/${propertyId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function updateNote(
  noteId: string,
  body: string,
): Promise<Note> {
  return authed<Note>(`${API.PROPERTY}/v1/notes/${noteId}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
}

// --- media (uploads + listing) ---

export async function listMedia(
  unitId: string,
): Promise<{ items: MediaItem[] }> {
  return authed<{ items: MediaItem[] }>(
    `${API.MEDIA}/v1/units/${unitId}/media`,
  );
}

export async function presignMedia(
  unitId: string,
  count: number,
  mediaType: "photo" | "video_short" | "video_long" = "photo",
): Promise<{ uploads: PresignedUpload[] }> {
  const items = Array.from({ length: count }, () => ({ media_type: mediaType }));
  return authed<{ uploads: PresignedUpload[] }>(
    `${API.MEDIA}/v1/units/${unitId}/media:presign`,
    {
      method: "POST",
      body: JSON.stringify({ items }),
    },
  );
}

export type CommitItem = {
  s3_key: string;
  media_type: "photo" | "video_short" | "video_long";
  caption?: string;
  duration_s?: number;
};

export async function commitMedia(
  unitId: string,
  items: CommitItem[],
): Promise<{ committed: { id: string; s3_key: string }[] }> {
  return authed<{ committed: { id: string; s3_key: string }[] }>(
    `${API.MEDIA}/v1/units/${unitId}/media:commit`,
    {
      method: "POST",
      body: JSON.stringify({ items }),
    },
  );
}

export async function updateMediaCaption(
  mediaId: string,
  caption: string,
): Promise<{ id: string; caption?: string }> {
  return authed<{ id: string; caption?: string }>(
    `${API.MEDIA}/v1/media/${mediaId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ caption }),
    },
  );
}

export async function deleteMedia(mediaId: string): Promise<void> {
  const access = await loadAccess();
  if (!access) throw new Error("not signed in");
  const res = await fetch(`${API.MEDIA}/v1/media/${mediaId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!res.ok)
    throw new Error(`${res.status} delete media: ${await res.text()}`);
}

export async function deleteNote(noteId: string): Promise<void> {
  const access = await loadAccess();
  if (!access) throw new Error("not signed in");
  const res = await fetch(`${API.PROPERTY}/v1/notes/${noteId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!res.ok) throw new Error(`${res.status} delete note: ${await res.text()}`);
}

export async function deleteProperty(id: string): Promise<void> {
  // Hard delete: backend removes property + units + notes + media rows.
  // DELETE returns 204 with no body — bypass authed() so we don't try to JSON-parse empty.
  const access = await loadAccess();
  if (!access) throw new Error("not signed in");
  const res = await fetch(`${API.PROPERTY}/v1/properties/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!res.ok) {
    throw new Error(`${res.status} delete: ${await res.text()}`);
  }
}
