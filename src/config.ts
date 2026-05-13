// Backend service URLs.
//
// Default: production (Fly.io). Override for local development by setting
// EXPO_PUBLIC_LAN_HOST to your Mac's LAN IP — every service URL will switch
// to that host, with the matching docker-compose port.
//
//   # talk to local docker-compose backend
//   EXPO_PUBLIC_LAN_HOST=http://10.0.0.105 npx expo start
//
//   # talk to the deployed backend (default — no env var needed)
//   npx expo start
//
// Expo bundles EXPO_PUBLIC_* vars into the JS at start time, so the value
// is read once on app boot. Changing it requires re-starting `expo start`.
const LAN = process.env.EXPO_PUBLIC_LAN_HOST;

export const API = LAN
  ? {
      USER: `${LAN}:8080`,
      PROPERTY: `${LAN}:8082`,
      MEDIA: `${LAN}:8083`,
      RANKING: `${LAN}:8084`,
    }
  : {
      USER: "https://hvo-user-svc-olivia.fly.dev",
      PROPERTY: "https://hvo-property-svc-olivia.fly.dev",
      MEDIA: "https://hvo-media-svc-olivia.fly.dev",
      RANKING: "https://hvo-ranking-svc-olivia.fly.dev",
    };
