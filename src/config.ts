// Backend service URLs.
//
// Tier 1 dev: hard-coded to the Mac's LAN IP. The iPhone running the Expo Go
// build hits these directly when on the same WiFi. When we move to a deployed
// backend (M3+), swap to the real domain.
//
// To change: update IP here, save the file. Expo's Fast Refresh picks it up
// without restarting.
const HOST = "http://10.0.0.105";

export const API = {
  USER: `${HOST}:8080`,
  PROPERTY: `${HOST}:8082`,
  MEDIA: `${HOST}:8083`,
};
