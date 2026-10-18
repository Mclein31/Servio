# SERVIO demo — Monday, October 19, 2026

Customer: iPhone 14 Plus. Pro: Android phone. Backups: iPhone simulator, second Android, Mac/Windows browsers. All payments, refunds, tips and cashouts are simulated; no actual charge is made. Keep both apps open in the foreground for GPS and dispatch. Push/FCM is not needed.

## Prepare the Mac and data

1. Use branch `feature/app-and-backend`, Node 26 (`nvm use 26`), local Postgres, and a dedicated `servio_demo` database. Follow [DEMO_DATA.md](DEMO_DATA.md) to select it in the ignored API environment. Do not reset `servio_dev`: it may contain ordinary accounts. Keep development and test URLs separate.
2. In `servio-api`, run `npm ci`, `npm run db:migrate`, then `npm run db:demo-reset`. Check the guarded reset output. Set a private six-digit `DEMO_LOGIN_CODE` locally; it works only for existing seeded demo accounts outside production. Do not put the code on slides, in source or in this document. A full reset clears sessions, so sign in again afterward.
3. Optional before changing the scene: `npm run db:backup`. Restore only a dedicated demo database as described in the data guide; reseed the baseline R2 photos when needed.
4. Start the API: `npm run dev -- --ip 0.0.0.0`. The Mac must stay awake. Leave the terminal open; do not expose its code logs to the audience.
5. Connect phones and Mac to the same trusted Wi-Fi without client isolation/VPN interference. Find the current Mac address with `ipconfig getifaddr en0` (or the active adapter). From each phone browser, open `http://<MAC_IP>:8787/api/v1/health` and confirm the health response. Permit the Mac firewall's incoming connection if needed. `localhost` on a physical phone means the phone itself.
6. For a browser on the LAN, set ignored `servio-api/.env` `ALLOWED_ORIGINS` to `capacitor://localhost,http://localhost,https://localhost,http://<MAC_IP>:4200` plus any actual Windows browser origin you use. Restart the API after changing environment settings. Native bundled apps use the localhost/Capacitor origins, regardless of API IP. Do not use `*`.
7. Browser backup: in `servio-app`, run `npm ci`, then `npm start -- --host 0.0.0.0`. Open `http://<MAC_IP>:4200`. A second browser profile/origin keeps Customer and Pro sessions separate.

If Wi-Fi fails, use the Mac's simulator/browser plus Android emulator as fallback. Cloud deployment requires owner approval and separate SERVIO Workers/Neon/R2 resources; it is not silently enabled.

## Build and install

From `servio-app`, `npm run native:demo` builds an optimized API-connected demo and syncs both native platforms. Run this after app changes, before building either native package. Sign-in's **Demo connection** opens the API address setting; choose **Use API**. Offline demo is an explicitly separate fallback and does not synchronize phones.

- **Physical phones:** `http://<MAC_IP>:8787/api/v1`.
- **iPhone simulator:** `http://localhost:8787/api/v1`.
- **Android emulator:** `http://10.0.2.2:8787/api/v1`.

### Android Pro

1. Install Android Studio/SDK 36 and select **JDK 21** for Gradle. On this Mac, use `JAVA_HOME="$(/usr/libexec/java_home -v 21)" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew assembleDebug` inside `servio-app/android`.
2. Connect the phone with USB debugging enabled, then install `android/app/build/outputs/apk/debug/app-debug.apk` using Android Studio Run or `adb install -r <apk>`. Keep the second Android ready with the same debug APK.
3. Open SERVIO, finish onboarding, configure the API URL and sign in as `demo.pro@servio.test`. Allow precise location while using the app. Camera/photo permission is requested when attaching evidence. Notification permission is declared for future local alerts; no push setup is required.
4. Debug's `network_security_config` permits HTTP to changing LAN IPs. Release's configuration denies cleartext. No background location permission is requested; location stops when the app leaves the foreground.

### iPhone customer (free Apple ID)

1. Run `npx cap open ios`. In Xcode select the **App** target, **Signing & Capabilities**, your Apple ID's **Personal Team**, and the plugged-in iPhone 14 Plus. Use automatic signing and the Debug configuration. If the bundle ID is unavailable, select a unique SERVIO-only ID consistently for that personal install; no paid account/TestFlight is needed.
2. Enable Developer Mode on the iPhone if prompted, trust the developer profile when required, and press Run. A free Personal Team install expires after seven days: rebuild close to demo day.
3. Debug uses `Info-Demo.plist` with local-network usage text and `NSAllowsLocalNetworking`. Allow local-network access so it can reach the Mac. Release uses `Info.plist` without the LAN exception. Location permission is needed only for **Use my current location**; manual map pin selection works without it.
4. Configure the Mac's LAN URL, sign in as `demo.customer@servio.test`, and keep the iPhone simulator ready as backup. Do not alter SMTP settings on either phone.

For a future production package use `npm run native:production` before Release. Configure an HTTPS SERVIO API URL and a licensed map/routing provider first. Demo builds, placeholder legal details and mock payments do not constitute a public production release.

## Reset → sign in → full flow

- [ ] Full dedicated demo reset completed; health reachable from both phones; local sample images load.
- [ ] Customer Sophia M. and Pro Daniel K. sign in with the private configured demo code. Tutor account is separate: Sofia R., `demo.tutor@servio.test`.
- [ ] Customer Profile → Edit: name/contact/photo persists after reopening. Saved Addresses → Add: tap/drag the Tuguegarao map pin, enter an entrance and barangay, confirm and save. Checkout displays that address; existing bookings retain their original pin.
- [ ] To show new dispatch, Customer chooses a fixed catalog service and saved address, then slides to authorize the mock hold. Pro is online with the matching offered service and a fresh location (no fixed distance cutoff). Pro receives the in-app offer and accepts within 60 seconds. For the planned AC repair scene, open existing **SRV-8821** instead.
- [ ] Pro taps En Route if using a new booking. Customer's Tracking shows the actual booking pin. Walk the Android outdoors and confirm the rider moves on the iPhone. For the seeded indoor scene, Pro enables **Demo: simulate route**; Customer sees **Simulated route** even with its own simulation toggle off. Reload returns to live GPS.
- [ ] Customer and Pro exchange chat messages; each appears on the other device. Attach a test photo. Reopen chat and confirm messages persist.
- [ ] Pro marks Arrived → Start Work, uploads a drain-hose evidence photo, chooses the fixed ₱350 add-on and sends it. Customer receives the in-app alert and approves; hold becomes ₱1,500 (₱1,100 labor + ₱350 add-on + ₱50 fee).
- [ ] Customer displays their four-digit completion PIN after inspection; Pro enters it. Booking completes once and escrow releases. Pro service share is ₱1,232.50 (85% of ₱1,450); platform share ₱217.50 plus ₱50 trust fee. Replay cannot release twice.
- [ ] Pro Wallet reflects the released credit. Customer submits a rating and optional mock tip; the tip goes 100% to the Pro. A mock cashout respects the ₱500 minimum and ₱15 fee.
- [ ] Before presenting again, Customer Tracking → **Reset demo order** restores the active scene using compensating ledger rows. It keeps audit/chat history. If already withdrawn funds prevent reversal, use the full dedicated reset, then sign in again. Never erase ordinary-user data to reset the demo.
- [ ] Leave the planned screen ready, charge all phones, disable sleep, keep API running and keep the fallback source ready.

## Real-account sign-in rehearsal

Follow [EMAIL_SETUP.md](EMAIL_SETUP.md): configure Gmail credentials locally, restart the API, use an inbox you own, request the six-digit code, finish the new profile, add a real map-pinned address, sign out and sign back in. Until SMTP is configured, ordinary codes appear only in the private development log; the app shows that distinction. Demo accounts still work without email.

## Verification record

Verified locally on October 16:

| Check | Result |
| --- | --- |
| API types and tests | Passed, 165 tests |
| Worker packaging | Dry-run passed; nothing deployed |
| App build, lint and tests | Passed with zero warnings, 50 tests |
| App dependency audit | Zero vulnerabilities |
| Profile and address browser rehearsal | Profile persisted; map pin saved/reopened and displayed at checkout |
| iPhone 14 Plus simulator | Native build, API sign-in, map loading and incoming Pro simulated-source label verified |
| Android debug APK | Build passed; installer failed with package-service broken pipe; cold emulator stayed offline |
| Native Release network boundary | Demo config rejected by Android Release guard; production merged manifest denies cleartext; iOS Debug plist has only local-network ATS exception |
| Actual Gmail delivery | Pending owner-configured credentials and inbox check |
| Physical iPhone/Android | Signing, same-Wi-Fi operation, GPS and camera/photo permissions not yet verified |

Detailed results are recorded in `.brain/CHANGELOG.md`. Physical Personal Team signing, phone-to-phone Wi-Fi/GPS, native camera/photo access and actual Gmail inbox delivery require the owner/device rehearsal. Do not mark those checks complete based on build success or simulated GPS.


## Regenerate native branding

Use the existing `assets/logo/servio_app_icon_orange.png` from the repo. From `servio-app`, copy it to `.angular/native-assets/logo.png`, then run `npx --yes @capacitor/assets@3.0.5 generate --assetPath .angular/native-assets --ios --android --iconBackgroundColor '#FF6B00' --iconBackgroundColorDark '#FF6B00' --splashBackgroundColor '#FFFFFF' --splashBackgroundColorDark '#FFFFFF'`. This uses the [official Capacitor asset generator](https://github.com/ionic-team/capacitor-assets); it does not change the onboarding illustrations. Review generated resources before committing.
