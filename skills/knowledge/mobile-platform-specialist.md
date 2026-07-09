# Mobile Platform Specialist — Knowledge Reference

**Skill ID:** SKL-044  
**Version:** 1.0.0 | **Last updated:** 2026-06-18  
**Mastery Level:** advanced  
**Executable Skill:** [mobile-platform-specialist](../../.opencode/skills/mobile-platform-specialist/SKILL.md)  
**Primary Sources:** Apple App Store Review Guidelines (2024); Google Play Developer Policy (2024); *iOS App Security* — David Thiel (2015); *Android Security Internals* — Nikolay Elenkov (2014)

---

## Overview

Mobile applications operate under platform distribution gatekeepers, hardware resource constraints, unreliable network conditions, and security requirements that do not exist in server-side or web development. This knowledge reference covers the canonical patterns, compliance rules, security controls, and offline architecture strategies for native and cross-platform mobile development.

---

## Technology Stack Patterns

### TS1 — Native iOS (Swift / SwiftUI)

**When to choose:** Maximum platform integration needed (HealthKit, ARKit, CarPlay, App Clips, Live Activities, Widget Kit); highest performance requirements; iOS-only product.

**Architecture pattern:** MVVM + Coordinator, or The Composable Architecture (TCA) for complex state machines.

**Key constraints:**
- Background execution is severely limited. Use `BGTaskScheduler` for deferred background work; `URLSession` background tasks for downloads
- Memory warnings (`didReceiveMemoryWarning`) must be handled — iOS kills apps that do not release memory under pressure
- All App Store submissions require privacy manifests (required API reasons) as of iOS 17

### TS2 — Native Android (Kotlin / Jetpack Compose)

**When to choose:** Maximum integration with Google services (Maps, Pay, Play Billing, Nearby); deepest Android hardware access; Android-only product.

**Architecture pattern:** MVVM + ViewModel + Repository, or MVI (Model-View-Intent) for unidirectional data flow.

**Key constraints:**
- `WorkManager` is the mandatory API for guaranteed background work (replaces `JobScheduler`, `AlarmManager`, `AsyncTask`)
- Target SDK must be within 1 year of latest Android release or the app is hidden from new installs on Google Play
- 64-bit requirement: all APKs must include 64-bit native libraries (if any)

### TS3 — React Native

**When to choose:** Shared JavaScript codebase across iOS and Android; team has strong JS/TS skills; moderate platform integration needs.

**Architecture pattern:** Flux/Redux or Zustand for global state; React Navigation for routing.

**Key constraints:**
- The New Architecture (JSI + Fabric + TurboModules) is required for React Native 0.74+; legacy bridge modules must be migrated
- OTA updates (via CodePush or Expo Updates) are permitted for JavaScript bundle changes only — native code changes require a store submission
- JavaScript thread and native thread must not be blocked simultaneously — use `InteractionManager.runAfterInteractions` for heavy non-UI work

### TS4 — Flutter

**When to choose:** Pixel-perfect custom UI; single codebase for iOS, Android, Web, Desktop; team prefers Dart.

**Architecture pattern:** BLoC (Business Logic Component) or Riverpod for state management.

**Key constraints:**
- Flutter renders its own widget tree — it does not use native UIKit/View components. Platform channel performance cost applies for every native API call
- OTA updates are NOT supported by default on Flutter (Google/Apple policy prohibits replacing compiled code OTA)
- Dart AOT compilation produces significantly different performance characteristics from JavaScript; hot reload is development-only

### TS5 — .NET MAUI

**When to choose:** Enterprise/.NET shop requiring iOS, Android, macOS, and Windows from a single codebase; Blazor Hybrid web integration.

**Architecture pattern:** MVVM with CommunityToolkit.Mvvm.

**Key constraints:**
- MAUI targets .NET 8+; Xamarin.Forms is deprecated and should not be used for new projects
- Native embedding limits: custom native views require binding projects per platform
- Startup performance is historically slower than native — use `MauiProgram` optimization patterns

---

## App Store Compliance

### AS1 — Apple App Store Review Guidelines (Critical Rules)

| Rule | Requirement | Rejection reason if violated |
|------|-------------|------------------------------|
| 2.1 | App must be complete and functional; no placeholder content, debug builds, or crash on launch | Binary rejected |
| 2.3.1 | All metadata (screenshots, description, keywords) must accurately represent the app's actual functionality | Metadata rejection |
| 3.1.1 | In-app purchases for digital goods and services must use Apple's In-App Purchase API | Binary rejected; potential developer account termination |
| 3.2.2 | Apps may not use external payment mechanisms for in-app purchases of digital goods (no linking to websites for payment) | Binary rejected |
| 4.1 | Spam — submitting duplicate apps or apps substantially similar to others from the same developer | Binary rejected |
| 4.3 | Copycat apps — cloning another app with minor changes | Binary rejected |
| 5.1.1 | Privacy policy required for all apps that collect user data | Binary rejected |
| 5.1.2 | Apps must not collect more data than required for the stated purpose | Review rejection; potential removal |
| 5.3.4 | Apps that access health data require a detailed privacy description | Binary rejected |

**Privacy Manifest (required as of May 2024):**
- All apps must include `PrivacyInfo.xcprivacy` declaring required reason APIs used
- Third-party SDKs that use required-reason APIs must include their own privacy manifests

### AS2 — Google Play Developer Policy (Critical Rules)

| Rule | Requirement |
|------|-------------|
| Impersonation | App name, icon, and description must not imply affiliation with other apps or brands |
| Malware | No code that downloads, installs, or executes code outside the APK signing boundary |
| Dangerous permissions | Permissions must be justified; SMS/call log/accessibility permissions require approval |
| Target API level | Must target SDK ≥ (latest release - 1 year) for new apps; older target SDKs are hidden from search |
| Billing policy | Digital goods must use Google Play Billing (Billing Library 6+) |
| Data safety form | Must accurately declare all data collected, shared, and whether encrypted in transit and at rest |

### AS3 — In-App Purchase Architecture

**Critical rule: IAP receipt validation must be server-side.**

Client-side IAP validation is trivially bypassed by runtime manipulation tools (e.g., Freedom, Lucky Patcher). All IAP receipt validation must happen on a trusted server:

```
Client → [purchase] → App Store / Play Store
App Store / Play Store → [receipt] → Client
Client → [receipt] → Your backend server
Your backend server → [validate] → App Store / Play Store server API
App Store / Play Store server API → [valid/invalid] → Your backend
Your backend → [unlock feature] → Client
```

**Never** unlock a feature based solely on a client-side receipt check.

---

## Mobile Security Controls

### MS1 — Certificate Pinning

Pin the app to your server's TLS certificate or public key to prevent MITM attacks via proxy tools (Burp Suite, Charles, mitmproxy).

**Implementation:**
- **iOS:** Use `URLSession` with a custom `URLSessionDelegate` that validates `serverTrust` against pinned certificates/public keys; or use TrustKit (third-party library)
- **Android:** Use Network Security Config (`res/xml/network_security_config.xml`) to declare pinned certificates; do not use OkHttp's `CertificatePinner` as the sole control (bypassed by proxy tools that install CA at OS level)

**Bypass mitigations:** Certificate pinning will be bypassed by rooted/jailbroken devices. Accept this as a risk boundary: pinning protects against mass interception on legitimate devices, not against targeted forensic analysis of jailbroken devices.

### MS2 — Secure Local Storage

| Data type | iOS storage | Android storage |
|-----------|------------|-----------------|
| Secrets (API tokens, passwords) | `Keychain Services` | `Android Keystore` |
| Sensitive user data | Encrypted files with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` | `EncryptedSharedPreferences` (Jetpack Security) |
| Session tokens | `Keychain` with `.afterFirstUnlock` accessibility | `Android Keystore`-backed `EncryptedSharedPreferences` |
| Never use | `NSUserDefaults`, `UserDefaults`, plist files | `SharedPreferences` (plaintext), SQLite without SQLCipher |

### MS3 — Jailbreak / Root Detection

Jailbroken iOS and rooted Android devices bypass OS-level sandboxing. Detect and respond appropriately:

**Detection signals (iOS):** presence of `cydia://`, `/bin/bash`, `/usr/sbin/sshd`, abnormal process list, successful write to `/private/jailbreak-test`

**Detection signals (Android):** `su` binary presence, `ro.build.tags` = `test-keys`, `BUILD.TAGS` contains `release-keys` is absent, Superuser.apk installed

**Response policy:** For high-risk apps (financial, health), refuse to operate on jailbroken/rooted devices. For medium-risk apps, log and flag for security review without blocking. Never block based solely on one signal — use a scoring approach.

### MS4 — Sensitive Data in Logs

Mobile apps frequently log sensitive data accidentally in debug builds. Enforce:
- Strip all `NSLog` / `print` / `Log.d` calls from release builds via `#if DEBUG` guards (iOS) or ProGuard/R8 rules (Android)
- Scan for API keys, tokens, PII patterns in log output as part of CI
- Never log `URLRequest` bodies or `URLResponse` bodies in production

### MS5 — Deep Link Validation

Deep links (universal links on iOS, app links on Android) and custom URL schemes are injection vectors if not validated:
- **iOS:** Use Universal Links (HTTPS-backed, verified by Apple's CDN) instead of custom URL schemes for external links. Validate all parameters before acting on them
- **Android:** Use Android App Links (verified via `.well-known/assetlinks.json`) for external links. Never trust `ACTION_VIEW` intent data without schema and parameter validation
- **Both:** Deep link parameters must be treated as untrusted input — sanitize before use

---

## Offline Architecture

### OA1 — Offline-First Data Model

Design the app to work fully offline, then sync when connectivity is available. This requires:

1. **Local-first persistence** — all user-visible data must be readable from local storage without a network call
2. **Optimistic UI** — apply user actions immediately to local state; sync to server in the background; roll back on server rejection
3. **Sync queue** — a persistent queue of pending operations that survive app restart and network outages
4. **Conflict resolution strategy** — define the resolution strategy before implementation:
   - Last-write-wins (by timestamp): simple but loses concurrent edits
   - Server-wins: simpler conflict resolution at the cost of user edit loss
   - CRDT (Conflict-free Replicated Data Types): complex but lossless for concurrent text and list operations

### OA2 — Network State Management

```swift
// iOS: use Network framework
let monitor = NWPathMonitor()
monitor.pathUpdateHandler = { path in
    if path.status == .satisfied {
        // Resume sync queue
    } else {
        // Pause sync queue, show offline indicator
    }
}
```

**Rules:**
- Never assume a network request will succeed — always handle timeout, connection error, and server error explicitly
- Cache all read responses with ETags or Last-Modified headers for conditional requests
- Use exponential backoff with jitter for retry logic on sync operations

### OA3 — Background Sync

| Platform | API | Use case |
|----------|-----|---------|
| iOS | `BGProcessingTaskRequest` | Large sync operations (> 30s) |
| iOS | `BGAppRefreshTaskRequest` | Periodic lightweight sync (< 30s) |
| Android | `WorkManager` (periodic) | Any background sync |
| Android | `WorkManager` (one-time with `Constraints`) | Sync when connected to network/charging |

**Critical iOS constraint:** Background tasks execute at OS discretion, not on a fixed schedule. Apps that drain battery in the background are penalized with reduced background execution frequency or removed from the background execution queue entirely.

### OA4 — Conflict Resolution for Offline Edits

For apps where multiple devices can edit the same record offline:

| Strategy | When to use | Implementation |
|----------|------------|----------------|
| Last-write-wins | Simple non-collaborative data (settings, preferences) | Compare `updated_at` timestamps; server or latest wins |
| Merge (field-level) | Structured records where fields change independently | Merge non-conflicting field changes; flag field conflicts for user review |
| CRDT | Collaborative text editing, shared lists | Use Yjs, Automerge, or a CRDT-native backend (Liveblocks, PartyKit) |
| Operational Transform | Real-time collaborative editing (Google Docs model) | Requires a central server; more complex than CRDT |

---

## Anti-patterns

| Anti-pattern | Risk | Correct approach |
|-------------|------|-----------------|
| Client-side IAP validation | Trivially bypassed; revenue loss | Server-side validation only (see MS3) |
| Storing credentials in `UserDefaults` / `SharedPreferences` | Extractable from unencrypted device backup | iOS Keychain / Android Keystore |
| Blocking the main thread with network calls | ANR (Android) or watchdog kill (iOS) | Always use async/await or callbacks for I/O |
| Ignoring memory warnings | App killed by OS under memory pressure | Implement `didReceiveMemoryWarning` / `onTrimMemory` |
| Deep links without parameter validation | Injection attacks via crafted links | Validate all deep link parameters before use |
| Missing offline error states | Users see blank screens on network loss | Design every screen for offline / loading / error states explicitly |

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Architecture Design | SKL-002 | Mobile architecture decisions constrain the module design |
| Security Review | SKL-006 | Certificate pinning and IAP validation are security findings |
| Testing Strategy | SKL-007 | Device matrix and offline scenario coverage are mobile testing specializations |
| Frontend UX Architect | SKL-005 | Platform-specific UX constraints (safe areas, gesture navigation, notch) |

---

## Source References

| Source | Section | Linked Content |
|--------|---------|----------------|
| Apple App Store Review Guidelines (2024) | §2, §3.1, §5.1 | AS1 |
| Google Play Developer Policy (2024) | Billing, Target API, Data Safety | AS2 |
| Apple Developer Documentation | Keychain Services, BGTaskScheduler | MS2, OA3 |
| Android Developer Documentation | WorkManager, Android Keystore, EncryptedSharedPreferences | TS2, MS2, OA3 |
| *iOS App Security* — David Thiel | Chapter 4: Data Storage | MS2 |
| *Android Security Internals* — Nikolay Elenkov | Chapter 6: Network Security | MS1 |
