// Backend service URLs.
//
// Tier 1 dev: the iPhone (running Expo Go) and the Mac (running the backend)
// must share a WiFi, and the iPhone reaches the Mac via the Mac's LAN IP.
// Set this in a local `.env` (gitignored) so the IP never lands in git:
//
//   EXPO_PUBLIC_API_HOST=http://192.0.2.10
//
// `npx expo start` automatically picks up `.env` / `.env.local`. When we move
// to a deployed backend (M3+), swap the env var to the real domain.
const HOST = process.env.EXPO_PUBLIC_API_HOST ?? "http://localhost";

export const API = {
  USER: `${HOST}:8080`,
  PROPERTY: `${HOST}:8082`,
  MEDIA: `${HOST}:8083`,
};
