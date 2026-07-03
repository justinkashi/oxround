# OxRound Member App (Expo) — placeholder

Not scaffolded yet by design: the demo slice is CRM-first, and the Expo scaffold
should be generated with the current SDK when mobile work starts (Stage 2, week 4+):

```bash
cd apps
npx create-expo-app@latest mobile --template tabs
```

Then per ARCHITECTURE.md §2.2 / §9 and BUILD_PLAN.md:

- NativeWind v4, Expo Router, expo-secure-store for JWT
- Auth: **email OTP** (D-08), not magic link
- QR scanning: `expo-camera` with `onBarcodeScanned` — NOT the deprecated `expo-barcode-scanner`
- Screens: home (feed + next class), schedule, my-QR, profile, announcements, kiosk.tsx
- Kiosk auth: gym-scoped JWT with `kiosk: true` claim (D-01) — never the service role key
- Splash: owner-photo "doors opening" animation (logs.md — Justin's human-touch concept)
