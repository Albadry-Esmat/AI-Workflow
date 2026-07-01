---
name: mobile-platform-specialist
version: 1.0.0
domain: domain-specialist
description: 'Use when designing, building, or reviewing iOS, Android, React Native, Flutter, or MAUI mobile applications. Triggers on: "mobile app", "iOS", "Android", "React Native", "Flutter", "MAUI", "app store", "push notification", "offline-first", "deep link". Do NOT use for mobile-responsive web apps or PWAs — only use when native or cross-platform mobile runtime is the core system concern.'
author: ASE-OS
---

# Mobile Platform Specialist

**Version:** 1.0.0 | **Last updated:** 2026-06-18

Domain specialist that injects mobile-platform-specific architecture patterns, App Store compliance requirements, offline-first data strategies, performance constraints, and mobile security controls into the pipeline when a native or cross-platform mobile application is being built. Runs at Layer 2c, in parallel with `architecture-design`, and produces `domain_constraints` consumed by downstream pipeline skills.

---

## 1. Skill Header

```yaml
name: mobile-platform-specialist
version: 1.0.0
domain: domain-specialist
description: >
  Use when designing, building, or reviewing iOS, Android, React Native,
  Flutter, or MAUI mobile applications.
  Triggers on: "mobile app", "iOS", "Android", "React Native", "Flutter",
  "MAUI", "app store", "push notification", "offline-first", "deep link".
  Do NOT use for mobile-responsive web apps or PWAs — only use when native
  or cross-platform mobile runtime is the core system concern.
author: ASE-OS
```

---

## 2. Purpose

Mobile applications have fundamentally different architectural constraints, distribution rules, and failure modes compared to web or server-side systems. A standard pipeline without mobile domain expertise will miss:

- **App Store compliance** — Apple App Store Review Guidelines and Google Play Developer Policy are gatekeepers; non-compliance means rejection or delisting
- **Offline-first requirement** — mobile networks are unreliable; data must be accessible without a connection, with conflict resolution on sync
- **Battery and memory constraints** — unbounded background work, memory leaks, and unnecessary polling destroy user retention
- **Background execution limits** — iOS severely restricts background processing; Android WorkManager has strict execution windows
- **Certificate pinning and mobile security** — mobile apps are reverse-engineered at scale; API keys in code, missing certificate pinning, and weak local storage are critical vulnerabilities
- **Device fragmentation** — screen sizes, OS versions, and hardware capabilities vary enormously; testing must cover a defined device matrix
- **Deep links and universal links** — incorrect implementation breaks user flows from notifications, emails, and web links
- **Over-the-air updates** — React Native and Flutter support OTA updates; the boundary between OTA-safe and store-required changes must be enforced
- **In-app purchase architecture** — IAP receipt validation must happen server-side; client-side validation is trivially bypassable
- **Crash reporting and analytics** — mobile apps crash silently from the user's perspective; instrumentation must be built in from day one
- **Accessibility** — VoiceOver (iOS) and TalkBack (Android) compliance is legally required in regulated sectors and increasingly enforced by app stores

`mobile-platform-specialist` enforces the correct architecture patterns, platform distribution rules, and testing strategies for all of these concerns before a single line of code is written.

---

## 3. Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | Yes | Structured requirements from `requirement-analyzer` |
| `architecture` | `object` | No | Partial or draft architecture from `architecture-design` (if available) |
| `domain_context` | `object` | Yes | Domain classification from `prompt-normalizer` (confirms `domain_primary: "mobile"`) |
| `target_platforms` | `array[string]` | No | Target platforms: `ios`, `android`, `both`. Defaults to `["both"]` |
| `technology_stack` | `string` | No | `native_ios`, `native_android`, `react_native`, `flutter`, `maui`, `xamarin`, `unknown` |
| `distribution_channels` | `array[string]` | No | `app_store`, `play_store`, `enterprise`, `testflight`, `firebase_distribution` |
| `offline_requirement` | `boolean` | No | Whether full offline support is required. Defaults to `false` |
| `monetization_model` | `string` | No | `free`, `paid`, `freemium`, `subscription`, `in_app_purchases`, `none` |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["requirements", "domain_context"],
  "properties": {
    "requirements": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "type", "statement", "priority"],
        "properties": {
          "id":        { "type": "string" },
          "type":      { "type": "string", "enum": ["F", "NF", "C"] },
          "statement": { "type": "string" },
          "priority":  { "type": "string" }
        }
      }
    },
    "architecture": { "type": "object" },
    "domain_context": {
      "type": "object",
      "required": ["domain_primary"],
      "properties": {
        "domain_primary": { "type": "string", "enum": ["mobile"] }
      }
    },
    "target_platforms": {
      "type": "array",
      "items": { "type": "string", "enum": ["ios", "android", "both"] },
      "default": ["both"]
    },
    "technology_stack": {
      "type": "string",
      "enum": ["native_ios", "native_android", "react_native", "flutter", "maui", "xamarin", "unknown"],
      "default": "unknown"
    },
    "distribution_channels": {
      "type": "array",
      "items": { "type": "string", "enum": ["app_store", "play_store", "enterprise", "testflight", "firebase_distribution"] }
    },
    "offline_requirement": { "type": "boolean", "default": false },
    "monetization_model": {
      "type": "string",
      "enum": ["free", "paid", "freemium", "subscription", "in_app_purchases", "none"],
      "default": "none"
    }
  }
}
```

---

## 4. Required Context

- `requirements` from `requirement-analyzer` (SKL-001) is mandatory.
- `domain_context.domain_primary` must be `"mobile"` — this guard prevents accidental invocation on non-mobile systems.
- `technology_stack` defaults to `"unknown"` if not provided; the skill infers it from requirements.
- `offline_requirement: true` triggers the full offline-first architecture pattern (sync engine, conflict resolution strategy, local schema migration).
- `monetization_model: "in_app_purchases"` or `"subscription"` mandates server-side receipt validation architecture.

---

## 5. Execution Logic

```
Step 1 — Infer technology stack (if not provided)
  Scan requirements for signals:
    Native iOS signals:          "Swift", "SwiftUI", "UIKit", "Xcode", "Apple", "iPhone", "iPad", iOS-only
    Native Android signals:      "Kotlin", "Jetpack Compose", "Android Studio", Android-only
    React Native signals:        "React Native", "Expo", "JavaScript", "TypeScript", cross-platform JS
    Flutter signals:             "Flutter", "Dart", "Google", cross-platform Dart
    MAUI signals:                "MAUI", ".NET MAUI", "C#", "Xamarin", cross-platform .NET
  If signals are mixed or ambiguous: recommend Flutter or React Native (broader ecosystem)
  Output: inferred_technology_stack

Step 2 — Select architecture pattern for technology stack
  Map inferred_technology_stack to architecture pattern:

  native_ios:
    Pattern: MVVM + Coordinator (SwiftUI) or VIPER (UIKit complex apps)
    Required modules: [AppEntry, Router/Coordinator, FeatureModule(s), DataLayer, NetworkLayer,
                       PersistenceLayer (CoreData/SwiftData), NotificationHandler, AnalyticsModule]
    Key constraints:
      - Background modes: declare only required BGTaskScheduler tasks (Apple rejects overbroad declarations)
      - Keychain API for all sensitive credential storage (never UserDefaults for secrets)
      - App Transport Security: no NSAllowsArbitraryLoads in production Info.plist
      - Memory: avoid retain cycles; use [weak self] in all closures capturing view controllers
      - Minimum iOS version: define based on analytics data (typically iOS 16+ for new apps in 2026)

  native_android:
    Pattern: MVVM + Clean Architecture (Hilt DI, Jetpack Compose)
    Required modules: [MainActivity, NavigationGraph, ViewModel(s), Repository, DataSource(local/remote),
                       Room (database), WorkManager (background), NotificationManager, CrashReporter]
    Key constraints:
      - Declare only required permissions in AndroidManifest (Google Play rejects over-permission)
      - Use EncryptedSharedPreferences for sensitive local data
      - Certificate pinning via OkHttp CertificatePinner or network-security-config.xml
      - Minimum SDK: API 26 (Android 8) for new apps in 2026; target latest stable API
      - ProGuard/R8 obfuscation required in release builds

  react_native:
    Pattern: Feature-based folder structure with Redux Toolkit or Zustand + React Navigation
    Required modules: [NavigationContainer, FeatureSlice(s), APIClient, LocalStorage (MMKV/AsyncStorage),
                       PushNotificationHandler, DeepLinkHandler, CrashReporter (Sentry), NativeModules]
    Key constraints:
      - OTA update boundary: JS bundle only (business logic, UI) — native module changes require store submission
      - Use Hermes JS engine (default in RN 0.70+) — do not disable
      - Avoid synchronous native module calls on UI thread
      - Metro bundler configuration: enable inline requires for startup performance
      - Flipper: disable in production builds

  flutter:
    Pattern: Feature-based Clean Architecture with BLoC or Riverpod
    Required modules: [MaterialApp/CupertinoApp, RouterConfig, Feature(s)/Bloc, Repository,
                       DataSource(remote/local), Hive/Isar (local DB), PlatformChannel(s), AnalyticsObserver]
    Key constraints:
      - Platform channel calls must be async; blocking channel calls crash UI
      - Avoid spawning Dart isolates for tasks < 10ms (overhead exceeds benefit)
      - Use flutter_secure_storage for credentials (wraps Keychain/Keystore)
      - Minimum Flutter stable channel; do not use beta/master in production

  maui:
    Pattern: MVVM + Shell navigation with DI (Microsoft.Extensions.DependencyInjection)
    Required modules: [App, AppShell, Page(s)/ViewModel(s), Repository, HttpClient, SecureStorage,
                       PushNotificationService, EssentialsService]
    Key constraints:
      - Target .NET 9+ (MAUI 9 LTS)
      - Use SecureStorage API (wraps Keychain/Keystore)
      - Background tasks: use platform-specific implementations via DependencyService
      - XAML hot reload in dev; disable in release

  Output: architecture_pattern, required_modules, module_constraints

Step 3 — Define offline architecture (if offline_requirement == true)
  Select offline strategy:
    Simple caching:      HTTP response caching + stale-while-revalidate (suitable if conflicts impossible)
    Optimistic UI:       write locally, sync when online, rollback on conflict (suitable for single-user)
    Full offline-first:  CRDT or last-write-wins with sync engine (required for multi-user collaboration)
  Required modules for offline-first: [SyncEngine, ConflictResolver, LocalSchemaManager, NetworkMonitor, SyncQueue]
  Sync protocol: define sync trigger (network change event, app foreground, background fetch)
  Local schema migrations: required whenever local DB schema changes (CoreData migration, Room migration, Hive adapter versioning)
  Output: offline_architecture

Step 4 — Define push notification architecture
  Tiers (select based on requirements):
    Basic local:    schedule local notifications on-device (no server required)
    Remote push:    APNs (iOS) + FCM (Android) via server-side push service
    Rich push:      images, action buttons, categories (requires Notification Service Extension on iOS)
  Required infrastructure: [PushRegistrationService, DeviceTokenStore, NotificationRouter, DeepLinkHandler]
  APNs/FCM token lifecycle: handle token refresh, deregistration on logout
  iOS-specific: request permission explicitly; never send without user opt-in
  Android 13+: POST_NOTIFICATIONS permission is now runtime (must request like camera/location)
  Output: push_notification_architecture

Step 5 — Define mobile security controls
  Required for all mobile apps:
    - Certificate pinning:          pin server certificate or public key (not root CA)
    - Credential storage:           iOS Keychain / Android Keystore (never SharedPreferences, never NSUserDefaults)
    - Sensitive data in logs:       no PII, tokens, or credentials in log statements (strip in release builds)
    - API key storage:              use server-side proxy; never embed third-party API keys in mobile binary
    - Jailbreak/root detection:     detect and degrade functionality appropriately (required for banking, payments)
    - Screenshot prevention:        FLAG_SECURE (Android), preventScreenCapture (iOS) for sensitive screens
    - App Transport Security:       enforce HTTPS-only; document any exceptions with justification
    - Binary protection:            enable ProGuard/R8 (Android), bitcode disabled (iOS — removed in Xcode 14)
    - Reverse engineering mitigation: code obfuscation; avoid sensitive business logic in client
  Additional controls for in_app_purchases / subscription:
    - Server-side receipt validation (Apple verifyReceipt API / StoreKit 2 / Google Play Developer API)
    - Never trust client-reported purchase status
    - Implement entitlement check on app foreground
  Output: security_controls

Step 6 — Define App Store compliance requirements
  Apple App Store (if target_platforms includes ios):
    - Privacy manifest: required (PrivacyInfo.xcprivacy) for all apps using location, contacts, camera, microphone
    - App Privacy declaration: every third-party SDK's data practices must be disclosed
    - Age rating: set correctly; child-directed apps activate COPPA obligations
    - Required device capabilities: declare only capabilities actually used
    - Metadata guidelines: screenshots must be accurate; no placeholder content
    - Review time estimate: 1–3 business days average; rejection requires new submission cycle
  Google Play (if target_platforms includes android):
    - Data safety section: disclose all data collection and sharing
    - Target API level: must target latest - 1 or latest Android API (Google enforces annually)
    - Permissions: document rationale for every declared permission
    - Content rating: complete the rating questionnaire accurately
    - Review time estimate: typically same-day for established publishers; new apps 3–7 days
  Output: app_store_compliance

Step 7 — Define device matrix and testing strategy
  Minimum device matrix:
    iOS:     iPhone SE (smallest), iPhone 15 Pro Max (largest), iPad (if tablet supported)
    Android: low-end device (2GB RAM, API 26), mid-range (4GB RAM, API 31), flagship (API 34+)
  Screen sizes: test all declared size classes (compact, regular, large)
  OS version coverage: current - 2 major versions minimum
  Accessibility testing: VoiceOver (iOS) and TalkBack (Android) must pass basic navigation
  Performance benchmarks:
    - App cold start: < 2s on mid-range device
    - Screen transition: < 300ms
    - List scrolling: 60 fps (or 120 fps if ProMotion display targeted)
    - Memory ceiling: < 150MB baseline RAM usage
  Output: device_matrix, testing_requirements

Step 8 — Produce domain_constraints
  Assemble all outputs from steps 2–7 into a structured domain_constraints object
  consumed by architecture-design, testing-strategy, code-generator, and security-guard.
  Output: domain_constraints
```

---

## 6. Outputs

| Field | Type | Description |
|-------|------|-------------|
| `domain_constraints` | `object` | **Primary output.** All mobile-specific constraints for downstream pipeline skills |
| `architecture_pattern` | `object` | Recommended pattern, required modules, and module-level constraints |
| `offline_architecture` | `object` | Offline strategy, sync engine design, conflict resolution (if applicable) |
| `push_notification_architecture` | `object` | APNs/FCM setup, token lifecycle, permission flow |
| `security_controls` | `object` | Certificate pinning, credential storage, receipt validation requirements |
| `app_store_compliance` | `object` | App Store and Play Store declaration requirements and review checklist |
| `device_matrix` | `object` | Minimum device coverage, OS versions, screen sizes |
| `testing_requirements` | `object` | Platform-specific test frameworks, performance benchmarks, accessibility requirements |
| `mobile_checklist` | `array[string]` | Pre-implementation checklist for the builder agent |
| `metadata` | `object` | Input summary, inferred stack, platforms, version |
| `metrics` | `object` | REQUIRED. Standard execution metrics |
| `feedback` | `array[object]` | REQUIRED. Feedback loop entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["domain_constraints","architecture_pattern","security_controls",
               "app_store_compliance","device_matrix","testing_requirements",
               "mobile_checklist","metadata","metrics","feedback"],
  "properties": {
    "domain_constraints": {
      "type": "object",
      "required": ["domain","technology_stack","target_platforms","required_modules",
                   "module_constraints","security_controls","app_store_requirements"],
      "properties": {
        "domain":                   { "type": "string", "const": "mobile" },
        "technology_stack":         { "type": "string" },
        "target_platforms":         { "type": "array", "items": { "type": "string" } },
        "required_modules":         { "type": "array", "items": { "type": "string" } },
        "module_constraints":       { "type": "array" },
        "security_controls":        { "type": "object" },
        "app_store_requirements":   { "type": "object" },
        "offline_architecture":     { "type": "object" },
        "performance_budgets":      { "type": "object" }
      }
    },
    "architecture_pattern":             { "type": "object" },
    "offline_architecture":             { "type": "object" },
    "push_notification_architecture":   { "type": "object" },
    "security_controls":                { "type": "object" },
    "app_store_compliance":             { "type": "object" },
    "device_matrix":                    { "type": "object" },
    "testing_requirements":             { "type": "object" },
    "mobile_checklist":                 { "type": "array", "items": { "type": "string" } },
    "metadata": {
      "type": "object",
      "required": ["inferred_technology_stack","target_platforms","offline_required","version"],
      "properties": {
        "inferred_technology_stack": { "type": "string" },
        "target_platforms":          { "type": "array" },
        "offline_required":          { "type": "boolean" },
        "monetization_model":        { "type": "string" },
        "version":                   { "type": "string" }
      }
    },
    "metrics":  { "$ref": "#/$defs/metrics" },
    "feedback": { "type": "array", "items": { "$ref": "#/$defs/feedback_entry" } }
  },
  "$defs": {
    "metrics": {
      "type": "object",
      "required": ["tokens_in","tokens_out","duration_ms","items_produced","version"],
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      }
    },
    "feedback_entry": {
      "type": "object",
      "required": ["type","from_skill","reason"],
      "properties": {
        "type":         { "type": "string", "enum": ["backpropagate","info","warning"] },
        "from_skill":   { "type": "string" },
        "target_skill": { "type": "string" },
        "reason":       { "type": "string" },
        "evidence":     { "type": "object" }
      }
    }
  }
}
```

---

## 7. Rules & Constraints

- `domain_context.domain_primary` MUST be `"mobile"` — any other value causes skill rejection with an error feedback.
- This skill is **advisory only** — it does not write code, architecture, or tests. It produces constraints consumed by skills that do.
- `technology_stack: "unknown"` is never acceptable in output — always infer from requirements before producing output.
- Server-side receipt validation is **mandatory** when `monetization_model` is `"in_app_purchases"` or `"subscription"` — never trust client-side purchase status.
- Certificate pinning constraints are **non-negotiable** — downstream code-generator must implement them. No exceptions without documented security review.
- OTA update boundary is a hard rule for React Native and Flutter: JS/Dart bundle changes only. Native module additions always require a store submission. The `module_constraints` output encodes which modules are OTA-safe.
- Do not recommend `xamarin` for new projects — it is end-of-life (Microsoft end-of-support: May 2024). Recommend MAUI instead.
- Background execution limits must be respected: iOS maximum BGProcessingTask runtime is 1–10 minutes, not configurable by the app.

---

## 8. Security Considerations

- **API keys in mobile binaries are a critical vulnerability** — all third-party API keys must go through a server-side proxy. This is enforced in `security_controls.api_key_proxy: required`.
- Certificate pinning bypasses are a common attack vector — the `security-guard` (SKL-041) will flag any network configuration without pinning as a high-severity issue.
- For apps targeting children (age rating ≤ 12): COPPA (US), GDPR-K (EU), and CARU guidelines apply — analytics SDKs that collect device identifiers are prohibited.
- Keychain items with `kSecAttrAccessibleAlways` accessibility are accessible even when the device is locked — use `kSecAttrAccessibleWhenUnlocked` or stricter.
- In-app purchase server-side validation: Apple's `verifyReceipt` endpoint (legacy) is deprecated — use StoreKit 2 App Store Server API for new apps.
- Jailbreak/root detection must not be the sole security control — a determined attacker will bypass it. Use it to degrade non-security-critical features, not as a gate.

---

## 9. Token Optimization

- Load only `requirements.statement` and `requirements.type` fields for stack inference (Step 1) — skip metadata fields.
- Architecture patterns are pre-templated per stack — only module selection and constraint values are LLM-inferred.
- App Store compliance requirements are a fixed checklist filtered by `target_platforms` — no LLM generation.
- Security controls are pre-defined by category — LLM selects applicable controls based on `monetization_model` and `target_platforms`, not generate them from scratch.
- Device matrix is pre-defined — LLM filters to declared platforms only.

---

## 10. Quality Checklist

- [ ] `domain_context.domain_primary == "mobile"` verified before proceeding
- [ ] `technology_stack` resolved — never `"unknown"` in output
- [ ] Architecture pattern selected with all required modules listed
- [ ] Background execution limits documented in `module_constraints`
- [ ] Keychain/Keystore usage specified for all credential storage (never UserDefaults/SharedPreferences)
- [ ] Certificate pinning included in `security_controls`
- [ ] App Store compliance requirements populated for each `target_platform`
- [ ] If `offline_requirement: true`: sync engine, conflict resolution, and schema migration strategy defined
- [ ] If `monetization_model` is `in_app_purchases` or `subscription`: server-side receipt validation architecture present
- [ ] Device matrix covers minimum OS versions (current - 2 major)
- [ ] Performance budgets defined (cold start < 2s, 60fps scrolling)
- [ ] `mobile_checklist` is non-empty (minimum 15 items)
- [ ] Output is valid JSON

---

## 11. Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `domain_context.domain_primary != "mobile"` | Reject with error feedback; do not produce domain_constraints |
| `technology_stack` cannot be inferred | Default to `"flutter"` (broadest platform coverage); emit warning |
| `target_platforms` not specified | Default to `["both"]` (ios + android); emit info |
| `monetization_model: "in_app_purchases"` declared but no IAP requirements found | Emit warning: "IAP monetization declared but no purchase flow requirements found — verify scope" |
| `offline_requirement: true` but no data model in requirements | Emit warning: "Offline-first requires a defined local data model — backpropagate to requirement-analyzer"; emit feedback backpropagate |
| Unknown distribution channel | Accept; emit warning that custom enterprise distribution may require MDM configuration |

---

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Technology stack confirmation | `inferred_technology_stack` differs from any mentioned stack in requirements | 3600s | Present inferred stack with evidence; confirm before architecture-design second pass |
| IAP architecture approval | `monetization_model: "in_app_purchases"` or `"subscription"` | 3600s | Present server-side validation architecture; stakeholder must confirm before code-generator runs |
| Child-directed content confirmation | Requirements mention "children", "kids", age < 13 | 3600s | Surface COPPA/GDPR-K implications; analytics SDK list for review |

---

## 13. Skill Composition

`mobile-platform-specialist` runs in **phase-2c** (domain specialist layer), in parallel with `architecture-design` completing its second pass. It consumes requirements and produces `domain_constraints` fed into downstream skills:

```yaml
name: phase-2c-domain-specialist
composes:
  - skill: mobile-platform-specialist
    version: "^1.0.0"
    condition: "domain_context.domain_primary == 'mobile'"
    input_map:
      requirements:          "requirement_analyzer_output.requirements"
      architecture:          "architecture_design_output"
      domain_context:        "domain_context"
      target_platforms:      "session_context.target_platforms"
      technology_stack:      "session_context.technology_stack"
      offline_requirement:   "session_context.offline_requirement"
      monetization_model:    "session_context.monetization_model"
    output_map:
      domain_constraints:    "mobile_domain_constraints"
```

`domain_constraints` is passed to:
- `architecture-design` (SKL-002) → informs module design, offline strategy, background execution patterns
- `testing-strategy` (SKL-005) → activates device matrix, platform-specific test frameworks, performance benchmarks
- `code-generator` (SKL-026) → enforces Keychain/Keystore usage, certificate pinning implementation, IAP server validation
- `security-guard` (SKL-041) → flags missing certificate pinning and API keys in binary as high-severity blocks

### Implementation Checklist (emitted in `mobile_checklist`)

```
Mobile App Implementation Checklist:
[ ] All credentials stored in Keychain (iOS) or Keystore (Android) — never UserDefaults/SharedPreferences
[ ] Certificate pinning implemented for all API endpoints
[ ] No third-party API keys embedded in mobile binary — use server proxy
[ ] Background execution tasks declared explicitly; no catch-all background modes
[ ] Push notification permission requested at contextually appropriate moment (not on first launch)
[ ] Deep links / universal links verified with associated-domains / assetlinks.json
[ ] App Store / Play Store privacy manifest and data safety section completed
[ ] ProGuard/R8 enabled in Android release builds
[ ] In-app purchase receipts validated server-side — client trust explicitly blocked
[ ] Screenshot prevention on sensitive screens (FLAG_SECURE / preventScreenCapture)
[ ] Jailbreak/root detection implemented for financial/payment flows
[ ] Cold start < 2s measured on minimum-spec device
[ ] List scrolling performance ≥ 60fps (no main-thread work in cell rendering)
[ ] VoiceOver (iOS) and TalkBack (Android) navigation tested on core user flows
[ ] Crash reporter (e.g., Sentry, Firebase Crashlytics) initialized before first frame render
[ ] Analytics SDK does not collect device identifiers if app is child-directed
[ ] Local database schema migration strategy defined before first release
[ ] App version and build number automated via CI — no manual version bumps
```

### Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-06-18 | Initial release — 8-step domain specialist covering technology stack selection, offline-first architecture, push notifications, mobile security controls, App Store compliance, device matrix, and testing strategy |
