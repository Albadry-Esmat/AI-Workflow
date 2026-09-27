---
name: systems-specialist
version: 1.0.0
domain: domain-specialist
description: 'Use when designing embedded systems, IoT platforms, real-time systems, or game development projects. Triggers on: "embedded", "IoT", "RTOS", "firmware", "microcontroller", "bare-metal", "real-time", "game engine", "Unity", "Unreal Engine", "game development", "physics engine", "ECS", "game loop". Do NOT use for cloud-native web backends or standard mobile/desktop apps — only use when hardware constraints, real-time scheduling, or game-loop architecture is the core system concern.'
author: ASE-OS
---

# Systems Specialist

**Version:** 1.0.0 | **Last updated:** 2026-06-18

Domain specialist that injects systems-programming-specific architecture patterns, real-time scheduling constraints, hardware abstraction layer design, memory safety requirements, IoT communication protocols, game loop architecture, and Entity-Component-System (ECS) design into the pipeline when an embedded system, IoT platform, or game is being built. Runs at Layer 2c, in parallel with `architecture-design`, and produces `domain_constraints` consumed by downstream pipeline skills.

---

## 1. Skill Header

```yaml
name: systems-specialist
version: 1.0.0
domain: domain-specialist
description: >
  Use when designing embedded systems, IoT platforms, real-time systems, or game
  development projects. Triggers on: "embedded", "IoT", "RTOS", "firmware",
  "microcontroller", "bare-metal", "real-time", "game engine", "Unity",
  "Unreal Engine", "game development", "physics engine", "ECS", "game loop".
  Do NOT use for cloud-native web backends or standard mobile/desktop apps.
author: ASE-OS
```

---

## 2. Purpose

Embedded, IoT, and game systems operate under constraints that standard software pipelines ignore entirely:

**Embedded / IoT concerns:**
- **Memory constraints** — microcontrollers may have 64KB–512KB RAM; heap allocation patterns that are fine on a server will corrupt embedded systems
- **Real-time scheduling** — RTOS task priorities, stack sizes, and execution deadlines are hard constraints, not performance guidelines
- **Hardware Abstraction Layer (HAL)** — firmware must be portable across hardware revisions; coupling to hardware registers without a HAL means every board revision requires a full rewrite
- **Communication protocols** — MQTT, CoAP, LoRaWAN, BLE, Zigbee, CAN bus — each has specific payload size limits, QoS models, and power consumption profiles
- **OTA firmware updates** — partial flash writes, rollback on failure, dual-bank flash architecture — without this, a failed update bricks the device permanently
- **Power management** — battery-powered devices require sleep modes, duty cycling, and wake-on-interrupt design that must be planned at architecture stage
- **Safety-critical requirements** — industrial IoT and automotive systems may require IEC 62443, ISO 26262, or IEC 61508 functional safety levels
- **Hardcoded credentials** — a critical vulnerability unique to IoT; must be flagged as non-bypassable block in security-guard

**Game development concerns:**
- **Game loop architecture** — fixed vs. variable timestep, input polling frequency, and render loop decoupling are foundational decisions
- **Entity-Component-System (ECS)** — data-oriented design for performance; object-oriented game architectures collapse at scale
- **Physics determinism** — multiplayer games require deterministic physics; non-determinism causes desyncs
- **Asset pipeline** — texture compression, LOD generation, audio encoding, and shader compilation are build pipeline steps, not runtime operations
- **Platform submission** — console certification (Sony, Microsoft, Nintendo) has strict technical requirements for memory, input handling, and audio that differ from PC/mobile
- **Memory budgets** — VRAM, system RAM, and audio memory budgets must be defined before asset production begins

`systems-specialist` enforces the correct architecture patterns, hardware constraints, and safety standards for all of these concerns before a single line of code is written.

---

## 3. Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | `array[object]` | Yes | Structured requirements from `requirement-analyzer` |
| `architecture` | `object` | No | Partial or draft architecture from `architecture-design` (if available) |
| `domain_context` | `object` | Yes | Domain classification from `prompt-normalizer` (confirms `domain_primary: "embedded_iot"` or `"game"`) |
| `system_type` | `string` | No | `embedded_bare_metal`, `embedded_rtos`, `iot_edge`, `iot_cloud_connected`, `game_2d`, `game_3d`, `game_multiplayer`, `unknown` |
| `target_hardware` | `object` | No | Hardware descriptor: `{ mcu: string, ram_kb: int, flash_kb: int, os: string }` |
| `real_time_class` | `string` | No | `hard` (missed deadline = system failure), `soft` (missed deadline = degraded), `none` |
| `safety_standard` | `string` | No | Applicable safety standard: `iec_62443`, `iso_26262`, `iec_61508`, `none` |
| `game_engine` | `string` | No | `unity`, `unreal`, `godot`, `custom`, `none` — only for game systems |
| `target_platforms` | `array[string]` | No | For games: `pc`, `playstation`, `xbox`, `nintendo_switch`, `mobile`, `web` |

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
        "domain_primary": { "type": "string", "enum": ["embedded_iot", "game"] }
      }
    },
    "system_type": {
      "type": "string",
      "enum": ["embedded_bare_metal","embedded_rtos","iot_edge","iot_cloud_connected",
               "game_2d","game_3d","game_multiplayer","unknown"],
      "default": "unknown"
    },
    "target_hardware": {
      "type": "object",
      "properties": {
        "mcu":      { "type": "string" },
        "ram_kb":   { "type": "integer" },
        "flash_kb": { "type": "integer" },
        "os":       { "type": "string" }
      }
    },
    "real_time_class": {
      "type": "string",
      "enum": ["hard", "soft", "none"],
      "default": "none"
    },
    "safety_standard": {
      "type": "string",
      "enum": ["iec_62443", "iso_26262", "iec_61508", "none"],
      "default": "none"
    },
    "game_engine": {
      "type": "string",
      "enum": ["unity", "unreal", "godot", "custom", "none"],
      "default": "none"
    },
    "target_platforms": {
      "type": "array",
      "items": { "type": "string", "enum": ["pc", "playstation", "xbox", "nintendo_switch", "mobile", "web"] }
    }
  }
}
```

---

## 4. Required Context

- `requirements` from `requirement-analyzer` (SKL-001) is mandatory.
- `domain_context.domain_primary` must be `"embedded_iot"` or `"game"`.
- `system_type: "unknown"` triggers inference from requirements (Step 1).
- `real_time_class: "hard"` activates strict RTOS scheduling constraints — every task must have a declared worst-case execution time (WCET) and period.
- `safety_standard` must be declared explicitly — safety standard controls cannot be retrofitted.
- For game systems, `game_engine: "none"` is valid only for custom engines — emit a recommendation for established engines if requirements don't justify custom.

---

## 5. Execution Logic

```
Step 1 — Infer system type
  Scan requirements for signals:

  Embedded bare-metal signals:  "no OS", "bare-metal", "direct register access",
                                "startup code", "linker script", "interrupt vector table"
  Embedded RTOS signals:        "RTOS", "FreeRTOS", "Zephyr", "tasks", "semaphore",
                                "mutex", "message queue", "scheduler"
  IoT edge signals:             "edge computing", "local processing", "gateway",
                                "protocol bridge", "MQTT broker local"
  IoT cloud signals:            "cloud connectivity", "MQTT", "AWS IoT", "Azure IoT Hub",
                                "device shadow", "OTA update", "telemetry"
  Game 2D signals:              "2D game", "sprite", "tilemap", "platformer", "top-down"
  Game 3D signals:              "3D game", "mesh", "shader", "PBR", "first-person", "third-person"
  Game multiplayer signals:     "multiplayer", "netcode", "server authoritative",
                                "peer-to-peer", "rollback netcode", "lobby"

  Output: inferred_system_type

Step 2 — Apply embedded / IoT architecture pattern (if domain is embedded_iot)

  embedded_bare_metal:
    Pattern: Superloop with interrupt-driven I/O
    Required modules: [StartupCode, HAL, PeripheralDrivers, MainLoop, ISRHandlers, ErrorHandler]
    Key constraints:
      - No dynamic memory allocation after init (heap forbidden in production code)
      - All buffers statically allocated with compile-time size assertions
      - ISR execution time: < 1ms (no blocking operations in ISR)
      - Watchdog timer: required; must be fed only from known-good state
      - Stack overflow detection: MPU stack guard required if MCU has MPU
      - MISRA-C or CERT-C coding standard required for safety-critical systems

  embedded_rtos:
    Pattern: Task-based architecture with RTOS scheduler (FreeRTOS, Zephyr, ThreadX)
    Required modules: [HAL, OSAbstractionLayer, TaskScheduler, InterTaskComm (queues/semaphores),
                       TimerService, PowerManager, ErrorRecovery, Watchdog]
    Key constraints:
      - Each task: declared priority, stack size, and worst-case execution time (WCET)
      - Priority inversion mitigation: use priority inheritance mutexes (not standard mutexes)
      - Stack sizes: minimum 2× maximum estimated stack depth; validated with stack watermark
      - No task-level heap allocation; use memory pools (pvPortMalloc from fixed-size pool)
      - Tick rate: define based on shortest task period (typically 1ms tick = 1kHz)
      - Real-time class "hard": missed deadlines must trigger controlled safe state transition

  iot_edge:
    Pattern: Edge gateway with local processing and cloud synchronization
    Required modules: [ProtocolBridge, LocalMessageBroker, EdgeRuleEngine, DataBuffer,
                       CloudConnector, DeviceRegistry, OTAManager, SecurityModule]
    Key constraints:
      - Edge processing first (latency), cloud sync second (reliability)
      - Data buffering: store-and-forward during cloud disconnection (configurable buffer depth)
      - Protocol translation: document input protocols → output format mapping
      - Local broker: MQTT v5 preferred; retain messages for device state recovery

  iot_cloud_connected:
    Pattern: Device → Cloud with device shadow and OTA
    Required modules: [DeviceSDK, ConnectionManager, TelemetryPublisher, CommandSubscriber,
                       DeviceShadow, OTAClient, ProvisioningService, SecurityBootstrap]
    Key constraints:
      - Unique device identity: X.509 certificate per device (never shared credentials)
      - Certificate rotation: automated renewal before expiry
      - OTA: dual-bank flash required; rollback on CRC failure; never brick device
      - Telemetry batching: aggregate readings before publish (reduce connection cost)
      - Connection management: exponential backoff with jitter for reconnection
      - MQTT QoS: use QoS 1 (at-least-once) for critical data; QoS 0 for high-freq telemetry

  Output: embedded_architecture, hardware_constraints

Step 3 — Apply game architecture pattern (if domain is game)

  game_2d:
    Pattern: Game loop with scene graph and 2D physics (Box2D/Rapier)
    Required modules: [GameLoop, SceneManager, Renderer2D, PhysicsEngine, InputSystem,
                       AudioEngine, AssetLoader, UISystem, SaveSystem]
    Key constraints:
      - Fixed timestep physics (50Hz or 60Hz); variable render rate (decouple render from logic)
      - Input polling: every frame; input buffering for network games
      - Sprite batching: group by texture atlas to minimize draw calls (< 100 draw calls target)

  game_3d:
    Pattern: ECS (Entity-Component-System) with forward/deferred rendering pipeline
    Required modules: [ECSCore, RenderPipeline, PhysicsEngine, AnimationSystem, InputSystem,
                       AudioEngine, AssetPipeline, UISystem, SaveSystem, ProfilerOverlay]
    Key constraints:
      - ECS data-oriented layout: components in contiguous arrays (SoA, not AoS)
      - Render budget: 60fps @ target hardware; profiler overlay mandatory in dev build
      - Draw call budget: < 1000 per frame on minimum-spec hardware
      - VRAM budget: define before asset production (typically 4GB for PC, 8GB for console)
      - LOD system: 3 LOD levels minimum for all complex meshes
      - Shader permutation explosion: use ubershader with variants, not shader per material

  game_multiplayer:
    Pattern: Server-authoritative netcode with client-side prediction and rollback
    Required modules: [GameServer, NetworkManager, StateReplication, ClientPrediction,
                       RollbackSystem, LobbyService, MatchmakingService, AntiCheat]
    Key constraints:
      - Server-authoritative: client sends inputs, server simulates, client predicts
      - Rollback netcode (GGPO-style): for fighting games and fast-action games
      - Snapshot interpolation: for slower-paced games (MMO, RTS)
      - Tick rate: define per genre (competitive FPS: 64–128Hz; casual: 20–30Hz)
      - Determinism: physics must be bit-exact deterministic across all client platforms
      - Anti-cheat: server validates all state changes; never trust client position reports
      - Max latency tolerance: define per genre (FPS: < 100ms; turn-based: 500ms)

  Output: game_architecture, game_constraints

Step 4 — Define memory budget and allocation strategy
  Embedded:
    - Static analysis: calculate worst-case stack depth for every task/ISR
    - Memory map: define regions (code, data, BSS, heap if used, stack per task)
    - Stack overflow: MPU guard pages or RTOS stack watermark checking in dev builds
    - No fragmentation: prohibit malloc/free in task code; use fixed-size memory pools
  Game:
    - RAM budget: system RAM breakdown by subsystem (render, physics, audio, AI, game logic)
    - VRAM budget: textures, meshes, render targets, shader constants
    - Audio budget: streaming vs. in-memory sounds (streaming for music, in-memory for SFX)
    - Peak memory: define absolute ceiling; build system should fail if exceeded
  Output: memory_budget

Step 5 — Define communication and protocol architecture (embedded_iot)
  Protocol selection by use case:
    High-frequency telemetry (< 100ms):  MQTT QoS 0 or CoAP non-confirmable
    Command & control:                   MQTT QoS 1 + correlation ID
    Long-range, low-power:               LoRaWAN (limited to 51-222 bytes payload per regional spec)
    Short-range, low-power:              BLE (GATT profile; MTU negotiation required)
    Industrial field bus:                CAN bus (arbitration priority design critical)
    Device-to-cloud:                     AWS IoT Core, Azure IoT Hub, Google Cloud IoT (select by existing cloud)
  Payload design:
    - Binary encoding preferred over JSON for bandwidth-constrained protocols (CBOR, Protobuf, MessagePack)
    - Maximum payload sizes enforced: LoRaWAN region-specific, BLE ATT MTU, CAN 8-byte frame
  Output: protocol_architecture

Step 6 — Define OTA update architecture (iot)
  Required for all production IoT deployments:
    Flash layout:  dual-bank (Bank A = active, Bank B = pending) — never single-bank OTA
    Update flow:   download → CRC verify → write Bank B → verify Bank B → reboot → confirm
    Rollback:      automatic rollback to Bank A if: boot failure, CRC mismatch, watchdog reset during boot
    Delta updates: binary diff (bsdiff/VCDIFF) for bandwidth-constrained channels
    Security:      signed firmware (RSA-2048 or ECDSA-256); reject unsigned updates
    Staged rollout: deploy to 1% → 10% → 100% of fleet with health metric gate
  Output: ota_architecture

Step 7 — Apply safety standard controls (if safety_standard != "none")

  iec_62443 (Industrial IoT cybersecurity):
    Security levels: SL1 (basic) to SL4 (state-actor resistance) — define required level
    Zone and conduit model: segment network into security zones; define conduit rules
    Patch management: firmware update process must be documented and auditable
    Incident response: defined process for reporting security incidents

  iso_26262 (Automotive functional safety):
    ASIL level: A (lowest) to D (highest) — derive from hazard analysis
    ASIL decomposition: split safety requirements between independent subsystems
    Diagnostic coverage: hardware self-tests, plausibility checks, redundancy
    Development process: safety plan, hazard analysis, software safety requirements, verification report

  iec_61508 (General functional safety):
    SIL level: SIL 1–4 — derive from risk assessment
    Safe failure fraction: hardware metric for random hardware failures
    Systematic capability: process requirements (coding standards, testing, review)

  Output: safety_controls

Step 8 — Produce domain_constraints
  Assemble all outputs from steps 2–7 into a structured domain_constraints object
  consumed by architecture-design, testing-strategy, code-generator, and security-guard.
  Output: domain_constraints
```

---

## 6. Outputs

| Field | Type | Description |
|-------|------|-------------|
| `domain_constraints` | `object` | **Primary output.** All systems-specific constraints for downstream pipeline skills |
| `system_architecture` | `object` | Architecture pattern, required modules, module-level constraints |
| `memory_budget` | `object` | Static/dynamic memory allocations, per-subsystem budgets, overflow strategy |
| `protocol_architecture` | `object` | Communication protocols, payload specs, QoS design (IoT/embedded only) |
| `ota_architecture` | `object` | OTA update design, flash layout, rollback, staged rollout (IoT only) |
| `safety_controls` | `object` | Safety standard controls and verification requirements (if applicable) |
| `game_constraints` | `object` | Game loop, ECS design, performance budgets, netcode architecture (game only) |
| `systems_checklist` | `array[string]` | Pre-implementation checklist for the builder agent |
| `metadata` | `object` | Input summary, inferred system type, real_time_class, safety_standard, version |
| `metrics` | `object` | REQUIRED. Standard execution metrics |
| `feedback` | `array[object]` | REQUIRED. Feedback loop entries |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["domain_constraints","system_architecture","memory_budget",
               "systems_checklist","metadata","metrics","feedback"],
  "properties": {
    "domain_constraints": {
      "type": "object",
      "required": ["domain","system_type","required_modules","module_constraints","memory_constraints"],
      "properties": {
        "domain":              { "type": "string", "enum": ["embedded_iot","game"] },
        "system_type":         { "type": "string" },
        "required_modules":    { "type": "array", "items": { "type": "string" } },
        "module_constraints":  { "type": "array" },
        "memory_constraints":  { "type": "object" },
        "safety_controls":     { "type": "object" },
        "protocol_constraints":{ "type": "object" },
        "ota_requirements":    { "type": "object" },
        "game_constraints":    { "type": "object" }
      }
    },
    "system_architecture":  { "type": "object" },
    "memory_budget":        { "type": "object" },
    "protocol_architecture":{ "type": "object" },
    "ota_architecture":     { "type": "object" },
    "safety_controls":      { "type": "object" },
    "game_constraints":     { "type": "object" },
    "systems_checklist":    { "type": "array", "items": { "type": "string" } },
    "metadata": {
      "type": "object",
      "required": ["inferred_system_type","real_time_class","safety_standard","version"],
      "properties": {
        "inferred_system_type": { "type": "string" },
        "real_time_class":      { "type": "string" },
        "safety_standard":      { "type": "string" },
        "game_engine":          { "type": "string" },
        "target_platforms":     { "type": "array" },
        "version":              { "type": "string" }
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

- `domain_context.domain_primary` MUST be `"embedded_iot"` or `"game"` — any other value causes rejection.
- `system_type` MUST be resolved — never `"unknown"` in output.
- **Hardcoded credentials are a NON-BYPASSABLE block** for `embedded_iot` domain — `security-guard` (SKL-041) is pre-configured with this rule. No API key, password, or certificate private key may appear as a string literal in source code.
- **No dynamic memory allocation after init** is a hard constraint for `embedded_bare_metal` systems — code-generator is instructed to reject any `malloc`/`free` usage outside of the init phase.
- For `real_time_class: "hard"`: every task and ISR must have a declared WCET. Code-generator must not introduce non-deterministic execution paths (dynamic dispatch, unbounded loops, heap allocation) in real-time tasks.
- For game systems: **server-authoritative netcode is mandatory** for `game_multiplayer` — no client-authoritative position/state accepted. Anti-cheat is not optional.
- `safety_standard` is never inferred — must be declared explicitly in input. Emit a warning if requirements contain industrial, automotive, or safety signals with no standard declared.
- `game_engine: "custom"` requires explicit justification in the ADR — the standard recommendation is an established engine unless requirements clearly justify custom.

---

## 8. Security Considerations

- **Hardcoded credentials** (device passwords, API keys, certificate private keys in source) are the single highest-severity vulnerability in IoT — `security-guard` blocks any code containing `[A-Z0-9]{20,}` adjacent to credential-indicating keywords (same rule as ci-pipeline-generator secret scan).
- Certificate pinning for IoT cloud connections: devices must pin the server certificate or CA; MQTT over TLS with pinning, not just TLS with system trust store.
- Firmware signing: unsigned firmware updates are a critical attack vector — the `security-guard` flags any OTA architecture without signature verification as a block.
- For game multiplayer: **server must validate all state** — client position, inventory, score. Never trust client-reported game state. Anti-cheat is a security control, not a quality-of-life feature.
- For safety-critical systems (iso_26262, iec_61508): the security review must include fault injection testing — deliberate single-point failures must result in safe state transition, not uncontrolled behavior.
- CAN bus security: CAN has no built-in authentication; all safety-critical automotive systems must use MAC-authenticated CAN frames (AUTOSAR SecOC or equivalent).

---

## 9. Token Optimization

- Architecture patterns are fully pre-templated per system_type — only module selection requires LLM reasoning.
- Memory budget calculations use deterministic formulas from hardware parameters (ram_kb, task count) — not LLM-generated.
- Protocol selection is a decision table — LLM filters based on declared requirements, not free-form generation.
- Safety standard controls are pre-defined checklists — selection is filtering, not generation.
- Game constraints (ECS patterns, tick rates, draw call budgets) are pre-defined — LLM applies them, not invents them.

---

## 10. Quality Checklist

- [ ] `domain_context.domain_primary` is `"embedded_iot"` or `"game"`
- [ ] `system_type` resolved — never `"unknown"` in output
- [ ] Architecture pattern selected with all required modules listed
- [ ] Memory budget defined — includes per-task stack sizes for RTOS, VRAM+RAM budgets for games
- [ ] For embedded: no dynamic memory allocation in task code (heap forbidden post-init)
- [ ] For RTOS: every task has declared priority, stack size, and WCET
- [ ] For `real_time_class: "hard"`: all hard deadlines documented with safe-state fallback
- [ ] For IoT: OTA dual-bank flash, CRC verification, and rollback strategy defined
- [ ] For IoT: hardcoded credentials constraint marked as non-bypassable security-guard rule
- [ ] For IoT: unique per-device identity (X.509 cert) documented
- [ ] For game multiplayer: server-authoritative netcode and anti-cheat declared
- [ ] For game: ECS architecture with SoA memory layout specified
- [ ] If `safety_standard != "none"`: safety level derived and controls listed
- [ ] `systems_checklist` is non-empty (minimum 15 items)
- [ ] Output is valid JSON

---

## 11. Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `domain_context.domain_primary` not `"embedded_iot"` or `"game"` | Reject with error feedback |
| `system_type` cannot be inferred | Emit warning; default to `"embedded_rtos"` for IoT, `"game_3d"` for game — request confirmation |
| `target_hardware` not provided for embedded | Emit info: "Hardware parameters not provided — using conservative memory estimates; provide MCU spec for accurate budgets" |
| `real_time_class: "hard"` declared but no deadlines in requirements | Backpropagate to requirement-analyzer: "Hard real-time declared but no timing requirements found — timing requirements are mandatory for hard RT systems" |
| `safety_standard` not declared but requirements contain safety signals ("fail-safe", "SIL", "ASIL", "functional safety") | Emit warning: "Safety signals detected but no standard declared — verify safety certification scope before proceeding" |
| `game_engine: "custom"` without justification in requirements | Emit warning: "Custom game engine has very high implementation cost — confirm this is intentional; recommend Unity/Unreal/Godot unless requirements clearly justify custom" |

---

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| System type confirmation | `inferred_system_type` is ambiguous (multiple matching signals) | 3600s | Present candidates with evidence; confirm before architecture-design second pass |
| Safety standard declaration | Requirements contain safety/reliability signals but `safety_standard == "none"` | 3600s | Force explicit declaration or explicit waiver — "none" must be a conscious choice |
| Hard RT deadline confirmation | `real_time_class: "hard"` but timing deadlines not in requirements | 3600s | Block until timing requirements are defined — cannot proceed without them |
| Custom engine justification | `game_engine: "custom"` declared | 3600s | Present cost/complexity analysis; stakeholder must confirm |

---

## 13. Skill Composition

`systems-specialist` runs in **phase-2c** (domain specialist layer), in parallel with `architecture-design` completing its second pass. It produces `domain_constraints` fed into downstream skills:

```yaml
name: phase-2c-domain-specialist
composes:
  - skill: systems-specialist
    version: "^1.0.0"
    condition: "domain_context.domain_primary == 'embedded_iot' OR domain_context.domain_primary == 'game'"
    input_map:
      requirements:    "requirement_analyzer_output.requirements"
      architecture:    "architecture_design_output"
      domain_context:  "domain_context"
      system_type:     "session_context.system_type"
      target_hardware: "session_context.target_hardware"
      real_time_class: "session_context.real_time_class"
      safety_standard: "session_context.safety_standard"
      game_engine:     "session_context.game_engine"
      target_platforms:"session_context.target_platforms"
    output_map:
      domain_constraints: "systems_domain_constraints"
```

`domain_constraints` is passed to:
- `architecture-design` (SKL-002) → HAL design, RTOS task model, ECS structure, memory map
- `testing-strategy` (SKL-005) → WCET testing, hardware-in-the-loop (HIL), game profiling, determinism testing
- `code-generator` (SKL-026) → MISRA-C enforcement, static allocation, ECS patterns, game loop implementation
- `security-guard` (SKL-041) → hardcoded credential block (non-bypassable for IoT), firmware signing check

### Implementation Checklist (emitted in `systems_checklist`)

```
Systems / Embedded / Game Implementation Checklist:

--- Embedded / IoT ---
[ ] No malloc/free in task or ISR code after initialization
[ ] All buffers statically allocated with compile-time size assertions
[ ] Every RTOS task has declared priority, stack size, and WCET
[ ] Priority inheritance mutexes used (not standard mutexes)
[ ] Stack watermark/MPU guard active in dev builds
[ ] ISR execution time < 1ms; no blocking operations in ISR
[ ] Watchdog timer enabled and fed only from confirmed good state
[ ] Hardcoded credentials: NONE — all secrets provisioned via secure bootstrap
[ ] Per-device unique identity (X.509 certificate provisioned at manufacturing)
[ ] OTA uses dual-bank flash; CRC verified; automatic rollback on failure
[ ] Firmware signed; unsigned images rejected at bootloader
[ ] Telemetry batched before publish; exponential backoff for reconnection
[ ] MQTT TLS with certificate pinning (not system trust store)
[ ] Power sleep modes implemented (duty cycling for battery devices)
[ ] Staged OTA rollout: 1% → 10% → 100% with health metric gate

--- Game Development ---
[ ] Fixed-timestep physics loop decoupled from variable render rate
[ ] ECS components stored in SoA (struct-of-arrays) layout
[ ] Draw call budget defined and enforced by profiler in dev build
[ ] VRAM, RAM, and audio memory budgets defined before asset production
[ ] LOD system implemented (minimum 3 LOD levels for complex meshes)
[ ] Shader variants managed via ubershader (no per-material shader explosion)
[ ] Asset pipeline: textures compressed, audio encoded, shaders pre-compiled at build time
[ ] Save system validated: corruption recovery, version migration
[ ] For multiplayer: server-authoritative; client sends inputs only
[ ] Anti-cheat: server validates all state changes; client position never trusted
[ ] Physics determinism validated across all target platforms
[ ] Console certification requirements reviewed (Sony, Microsoft, Nintendo) if applicable
```

### Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-06-18 | Initial release — 8-step domain specialist covering embedded bare-metal and RTOS architecture, IoT communication protocols and OTA design, game loop and ECS architecture, multiplayer netcode, memory budgets, safety standard controls (IEC 62443, ISO 26262, IEC 61508), and hardcoded credential enforcement |
