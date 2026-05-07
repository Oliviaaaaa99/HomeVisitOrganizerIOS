# HomeVisitOrganizerIOS

iOS / Android client for the Apartment Tour Tracker app.

Backend: [Oliviaaaaa99/HomeVisitOrganizerBackend](https://github.com/Oliviaaaaa99/HomeVisitOrganizerBackend)

Design docs:
- [PRD](https://jlarkusm9e05atu1.usttp.larksuite.com/wiki/B861wUBS9iukKNkeGtfuyqOKthb)
- [Production Design Doc](https://jlarkusm9e05atu1.usttp.larksuite.com/wiki/T0zvw6KBbi10qPkc1KPuuVGwtwc)
- [Tech Design Doc](https://jlarkusm9e05atu1.usttp.larksuite.com/wiki/CBeww3AROiSaXCkJDXKuoykct4c)

## Stack

- **Expo** SDK 54 (managed workflow)
- **React Native** 0.81 + **TypeScript**
- **AsyncStorage** for JWT
- No router — three screens, one `useState` state machine. We'll add `expo-router` once we have more screens or deep linking.

## Tier 1 — Walking Skeleton

| Screen | What it does |
|--------|-------------|
| Sign-in | Dev-provider login (any `external_id:email` string → JWT) |
| Home | Lists user's properties, pull-to-refresh, sign out |
| Detail | One property's address + units + notes (no media gallery yet) |

Capture / AI ranking / settings / Apple+Google sign-in / push notifications all ship later.

## Layout

```
.
├── App.tsx                          # state-machine entry, picks screen
├── app.json                         # Expo config
├── src/
│   ├── config.ts                    # backend host (reads EXPO_PUBLIC_API_HOST)
│   ├── api.ts                       # fetch wrapper + types
│   ├── storage.ts                   # AsyncStorage helpers for JWT
│   └── screens/
│       ├── SignInScreen.tsx
│       ├── HomeScreen.tsx
│       └── PropertyDetailScreen.tsx
└── tsconfig.json
```

## Running locally

### 1. Make sure the backend is running

In `~/projects/proj_mie`:

```bash
make up
make migrate          # first time
make run-user &       # :8080
make run-property &   # :8082
make run-media &      # :8083
```

### 2. Point Expo at your Mac's WiFi IP via a local env file

```bash
ipconfig getifaddr en0           # prints something like 192.0.2.10
echo "EXPO_PUBLIC_API_HOST=http://$(ipconfig getifaddr en0)" > .env.local
```

`.env.local` is gitignored, so your LAN IP never lands in the repo. `src/config.ts` reads `EXPO_PUBLIC_API_HOST` automatically and falls back to `http://localhost` if it's not set.

### 3. Start Expo

```bash
npm install                       # first time
npx expo start
```

Press `s` to switch to "Expo Go" mode if needed.

### 4. Open on your phone

- Install **Expo Go** from the App Store
- Make sure your phone is on the **same WiFi** as the Mac
- Scan the QR code from the Expo terminal with the Camera app
- Expo Go opens, downloads the JS bundle, runs the app

### 5. Sign in

Use any `external_id:email` you want. Different ids create different users in the backend `users` table.

## Roadmap

| Tier | Scope | Status |
|------|-------|--------|
| **Tier 1** | Sign-in + list + detail | ✓ |
| Tier 2 | Capture flow (camera → photos → save), media gallery | — |
| Tier 3 | Onboarding, AI ranking, settings, Apple/Google sign-in, TestFlight | — |
