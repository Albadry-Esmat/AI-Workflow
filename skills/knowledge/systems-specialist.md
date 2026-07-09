# Systems Specialist — Knowledge Reference

**Skill ID:** SKL-046  
**Version:** 1.0.0 | **Last updated:** 2026-06-18  
**Mastery Level:** advanced  
**Executable Skill:** [systems-specialist](../../.opencode/skills/systems-specialist/SKILL.md)  
**Primary Sources:** *Making Embedded Systems* — Elecia White (2011); *Real-Time Concepts for Embedded Systems* — Qing Li & Caroline Yao (2003); FreeRTOS Documentation; IEC 62443-4-2; ISO 26262:2018; *Game Engine Architecture* — Jason Gregory (3rd ed., 2018)

---

## Overview

Embedded systems, IoT platforms, and game engines operate under constraints that standard cloud-native pipelines ignore: memory budgets measured in kilobytes, real-time scheduling deadlines measured in microseconds, hardware that cannot be patched over the air without a rollback plan, and safety certification requirements that are legally binding. This knowledge reference covers the canonical patterns for all three domains.

---

## Embedded Architecture Patterns

### EP1 — Superloop (Bare-Metal)

The simplest embedded architecture: an infinite main loop polls all peripherals and runs all application logic sequentially.

```c
int main(void) {
    hardware_init();
    while (1) {
        read_sensors();
        process_inputs();
        update_outputs();
        // No preemption — every task runs to completion before the next
    }
}
```

**When to use:** Extremely resource-constrained MCUs (< 8KB RAM); simple, deterministic I/O with no concurrent processing requirements; no hard real-time deadlines that require sub-millisecond interrupt latency.

**Constraints:**
- Total loop execution time must fit within the tightest timing requirement. If `read_sensors()` blocks for 50ms and a GPIO must be sampled every 10ms, the superloop fails
- Any blocking operation (UART wait, I2C timeout) stalls all other processing

### EP2 — RTOS Task Model

A Real-Time Operating System (FreeRTOS, Zephyr, ThreadX) provides preemptive multitasking, priority-based scheduling, and inter-task communication primitives.

**Task design rules:**
- Each task must have a **bounded worst-case execution time (WCET)**. An unbounded task can starve lower-priority tasks
- Use `vTaskDelay` (relative delay) or `vTaskDelayUntil` (absolute periodic delay) — never use busy-wait loops
- Stack overflow detection must be enabled: `configCHECK_FOR_STACK_OVERFLOW = 2` in FreeRTOS

**Priority assignment (Rate Monotonic Scheduling):**
- Assign higher priority to tasks with shorter periods (Rate Monotonic is optimal for periodic tasks)
- Reserve the highest priority for interrupt service routines and safety-critical monitoring
- Avoid priority inversion: when a low-priority task holds a mutex needed by a high-priority task, use a priority-inheritance mutex

**Inter-task communication:**
| Primitive | Use case |
|-----------|---------|
| Queue | Passing data between tasks (producer/consumer) |
| Semaphore (binary) | Signaling task completion or interrupt event |
| Semaphore (counting) | Resource pool management |
| Mutex | Mutual exclusion for shared resources |
| Event group | Waiting for multiple conditions simultaneously |

### EP3 — Hardware Abstraction Layer (HAL)

The HAL separates application logic from hardware register access. Every hardware operation goes through an HAL function; no application code reads or writes hardware registers directly.

```c
// Correct: through HAL
hal_gpio_write(GPIO_LED_PIN, GPIO_HIGH);

// Incorrect: direct register access in application code
GPIOA->ODR |= (1 << 5);  // Coupling to STM32 specific register — breaks on any other MCU
```

**HAL rules:**
- HAL functions must be mockable for unit testing (via function pointers or C++ virtual functions)
- HAL implementations are the only code that changes between hardware revisions
- HAL must never block indefinitely — all blocking operations take a timeout parameter

### EP4 — Memory Budget Management

Microcontrollers have fixed, non-expandable RAM. Memory must be budgeted before implementation begins.

**Budget allocation process:**
1. Determine total available RAM (e.g., STM32F4: 192 KB)
2. Subtract: stack for each RTOS task (typically 256–2048 bytes per task)
3. Subtract: static data (global variables, BSS segment)
4. Subtract: RTOS kernel overhead (typically 2–10 KB for FreeRTOS)
5. Remaining = available heap for dynamic allocation

**Rules:**
- Prefer static allocation over `malloc` / `pvPortMalloc` — heap fragmentation in long-running embedded systems causes non-deterministic failures weeks or months into deployment
- Enable stack canaries and monitor with `uxTaskGetStackHighWaterMark` to detect stack overflow before production
- Set `configSUPPORT_DYNAMIC_ALLOCATION = 0` and `configSUPPORT_STATIC_ALLOCATION = 1` in FreeRTOS for safety-critical systems

---

## IoT Protocols

### IP1 — MQTT

**Profile:** Publish/subscribe; broker-mediated; lightweight (2-byte header); designed for unreliable networks; QoS 0/1/2.

**When to use:** Telemetry from constrained devices to cloud (temperature sensors, energy meters, asset trackers); notification delivery to devices.

| QoS Level | Guarantee | Use case |
|-----------|-----------|---------|
| QoS 0 (at most once) | Fire and forget | High-frequency, loss-tolerant telemetry |
| QoS 1 (at least once) | Delivered at least once; may duplicate | Commands, alarms |
| QoS 2 (exactly once) | Exactly once delivery | Billing events, financial telemetry |

**Security rules:**
- Always use TLS (MQTT over port 8883, not 1883)
- Use per-device client certificates for mutual TLS authentication — shared passwords are a critical vulnerability
- Subscribe topic ACLs: each device must only subscribe to its own topic namespace

### IP2 — CoAP (Constrained Application Protocol)

**Profile:** RESTful; UDP-based; optimized for constrained nodes (< 10 KB RAM); supports observe mode (server-sent events over UDP).

**When to use:** Devices too constrained for MQTT's TCP overhead; RESTful semantics needed; IPv6/6LoWPAN networks.

**Note:** CoAP is significantly less common than MQTT in new designs as of 2024. Prefer MQTT unless hardware constraints make TCP impossible.

### IP3 — BLE (Bluetooth Low Energy)

**Profile:** Short-range (10–100m); ultra-low power; peer-to-peer or star topology; GAP (advertising) + GATT (services/characteristics) model.

**When to use:** Wearables, medical devices, beacons, asset tags, smart locks — any device that pairs directly with a smartphone.

**Architecture rules:**
- Define GATT services and characteristics before implementation; changing them requires firmware update and app update simultaneously
- For high-throughput data (audio, large sensor payloads), use BLE 5.0 data channels, not GATT notifications
- Connection interval negotiation: longer intervals = lower power but higher latency. Define the tradeoff upfront for each use case

### IP4 — LoRaWAN

**Profile:** Long-range (2–15 km rural), very low bandwidth (0.3–50 kbps), star topology, extremely low power; designed for LPWAN (Low-Power Wide-Area Network).

**When to use:** Agricultural sensors, smart city infrastructure, utility metering — any device that needs multi-km range with years of battery life and can tolerate high latency and low throughput.

**Key constraints:**
- Duty cycle limits: LoRa devices are limited to 1% duty cycle in EU (approximately 36 seconds of airtime per hour). Applications that require high-frequency messaging cannot use LoRaWAN
- Maximum payload: 51–242 bytes depending on data rate (DR0–DR5); not suitable for image or audio data

---

## OTA Firmware Updates

### OTA1 — Dual-Bank Flash Architecture

The only safe OTA update architecture for production embedded systems is dual-bank flash:

```
Flash Layout:
┌─────────────────┐
│  Bootloader     │  (read-only, never updated OTA)
├─────────────────┤
│  Bank A (active)│  ← Currently running firmware
├─────────────────┤
│  Bank B (update)│  ← New firmware written here during OTA
├─────────────────┤
│  Metadata       │  Update state, version, checksum
└─────────────────┘
```

**OTA sequence:**
1. Download new firmware image to Bank B while Bank A continues running
2. Verify checksum and firmware signature before rebooting
3. Bootloader boots Bank B on next reset
4. Device runs new firmware; if it fails health check within N minutes → bootloader reverts to Bank A
5. On successful boot: mark Bank B as committed; Bank A becomes the new fallback

### OTA2 — Firmware Signing

All firmware images must be cryptographically signed. An unsigned firmware image must be rejected by the bootloader.

**Minimum requirements:**
- ECDSA-P256 or Ed25519 signature over the complete firmware image
- Public key burned into the bootloader at manufacturing time (immutable)
- Signing key stored in HSM; private key never leaves the HSM
- Version number included in signed metadata; older versions rejected to prevent rollback attacks (unless explicit rollback is required for recovery)

### OTA3 — Rollback Safety

**Automatic rollback triggers:**
- New firmware fails to reach `confirmed` state within a watchdog timeout (typically 5–10 minutes)
- Health check endpoint (`/health`) returns non-OK after boot
- Application calls `ota_abort()` on detected data corruption or failed migration

**Manual rollback:**
- Support a hardware-triggered rollback (e.g., hold a GPIO button during boot) for factory reset
- Remote rollback via cloud command (signed command required; verify before executing)

---

## Game Architecture

### GA1 — Game Loop

The game loop is the core execution model of all real-time games:

```c
while (!quit) {
    process_input();
    update(delta_time);  // Physics, AI, game logic
    render();
}
```

**Fixed vs. variable timestep:**
| Approach | Physics | Rendering | Use case |
|----------|---------|-----------|---------|
| Fixed timestep | Deterministic | Decoupled | Multiplayer, physics-heavy games |
| Variable timestep | Non-deterministic | Matches frame rate | Single-player action games |
| Semi-fixed (Gaffer's model) | Deterministic | Interpolated | Most modern games |

**Gaffer's fixed-timestep model (recommended):**
```c
const float FIXED_DT = 1.0f / 60.0f;  // 60Hz physics
float accumulator = 0;
while (!quit) {
    float frame_time = get_elapsed_time();
    accumulator += frame_time;
    process_input();
    while (accumulator >= FIXED_DT) {
        update_physics(FIXED_DT);
        accumulator -= FIXED_DT;
    }
    render(accumulator / FIXED_DT);  // Interpolated render
}
```

### GA2 — Entity-Component-System (ECS)

ECS is the standard architecture for performance-critical game logic. It separates data (Components) from identity (Entities) from behavior (Systems).

**Why ECS over OOP:**
- Cache efficiency: all `PositionComponent` data is contiguous in memory; iterating all entities with a Position is a sequential memory access, not pointer-chasing
- Composability: behaviors are added/removed by attaching/detaching components at runtime without inheritance hierarchies

**ECS architecture:**
```
Entity: just an ID (e.g., uint32_t entity_id = 42)
Component: plain data struct (no behavior)
  struct Position { float x, y, z; };
  struct Velocity { float dx, dy, dz; };
System: iterates entities that have specific components
  PhysicsSystem.update():
    for entity in entities_with(Position, Velocity, RigidBody):
      entity.Position += entity.Velocity * delta_time
```

**Archetype storage (used by Unity DOTS, Flecs, bevy_ecs):**
Store entities with the same component combination in a contiguous memory block (archetype). Adding/removing a component moves the entity to a different archetype — cheaper than per-entity storage.

### GA3 — Multiplayer Netcode

**Client-side prediction:** The client immediately applies player input locally without waiting for server confirmation. When the server responds, reconcile any difference.

**Rollback netcode (GGPO model):** The game state is rolled back to the last confirmed frame, re-simulated with newly received input, and presented to the player. Required for deterministic fighting games and real-time strategy.

**Determinism requirement for rollback:** Physics must be deterministic — same input + same state = same output, bit-for-bit, across all machines. This requires:
- Fixed-point arithmetic (not floating-point, which varies by CPU/compiler)
- Deterministic random number generators seeded identically across peers
- Physics step rate must match simulation rate (no interpolation in physics engine)

---

## Safety Standards

### SS1 — IEC 62443-4-2 (Industrial IoT Security)

Defines security requirements for IoT components in industrial automation and control systems (IACS).

**Security Level requirements (SL):**
| Level | Requirement |
|-------|-------------|
| SL 1 | Protection against casual/unintentional violation |
| SL 2 | Protection against intentional violation using simple means |
| SL 3 | Protection against sophisticated intentional attack |
| SL 4 | Protection against state-sponsored attacks |

**Key technical controls (SL 2, typical industrial target):**
- Unique per-device identity (X.509 certificate or PSK)
- Encrypted communication (TLS 1.2+)
- Secure boot with firmware signing
- No hardcoded credentials (critical — must be a security-guard `block` finding)
- Minimal attack surface: disable all unused ports and services
- Security update mechanism (OTA with rollback)

### SS2 — ISO 26262 (Automotive Functional Safety)

Covers functional safety for road vehicle E/E systems. Not all automotive software requires ISO 26262 — only systems where a failure can cause injury or death.

**ASIL levels (Automotive Safety Integrity Level):**
| Level | Risk | Example |
|-------|------|---------|
| ASIL A | Lowest | Entertainment system |
| ASIL B | Low-medium | HVAC control |
| ASIL C | Medium-high | Anti-lock braking (ABS) |
| ASIL D | Highest | Electronic steering, airbags |

**Key technical requirements (ASIL C/D):**
- Formal requirements traceability (each requirement → design element → test case)
- MISRA-C compliance for C code (no undefined behavior, no implicit type conversions)
- Static analysis mandatory (Polyspace, LDRA, Parasoft)
- Fault injection testing
- Hardware/software interface (HSI) documentation for all HAL interfaces

### SS3 — Hardcoded Credentials (Critical IoT Vulnerability)

**This is a non-bypassable security-guard BLOCK finding for all IoT/embedded systems.**

Hardcoded default credentials (usernames, passwords, API keys, certificates) are the most common IoT vulnerability class. They were the root cause of the Mirai botnet (which compromised 600,000 devices by credential-stuffing factory defaults).

**Required controls:**
- Each device must have a **unique** credential provisioned at manufacturing time (not a shared default)
- Credentials must be stored in secure storage (e.g., ARM TrustZone, hardware secure element)
- First-boot credential change must be enforced for any consumer-facing device
- CI must scan firmware binaries for embedded strings matching credential patterns

---

## Anti-patterns

| Anti-pattern | Risk | Correct approach |
|-------------|------|-----------------|
| Direct register access in application code | Breaks on hardware revision; untestable | All hardware access through HAL |
| Heap allocation in interrupt service routines | Heap is not re-entrant; causes corruption | Static allocation in ISRs; use message queues |
| Busy-wait loops in RTOS tasks | Starves other tasks; burns CPU | `vTaskDelay` / `vTaskDelayUntil` |
| Unsigned OTA firmware | Allows arbitrary code execution via MITM | Firmware signing mandatory (ECDSA/Ed25519) |
| Single-bank OTA | Failed update = bricked device | Dual-bank flash with automatic rollback |
| Hardcoded credentials in firmware | Mass device compromise (Mirai) | Per-device unique credentials provisioned at manufacturing |
| Floating-point physics in multiplayer | Non-deterministic desyncs across clients | Fixed-point arithmetic for deterministic simulations |

---

## Related Skills

| Skill | ID | Relationship |
|-------|----|-------------|
| Architecture Design | SKL-002 | Embedded/game architecture is a specialization of system architecture |
| Security Review | SKL-006 | Hardcoded credentials and unsigned firmware are critical security findings |
| Testing Strategy | SKL-007 | Hardware-in-the-loop (HIL) testing and fault injection are systems-specific testing strategies |
| Deployment Strategy | SKL-009 | OTA firmware update strategy is a deployment concern |

---

## Source References

| Source | Section | Linked Content |
|--------|---------|----------------|
| *Making Embedded Systems* — Elecia White | Chapter 3: Outputs; Chapter 5: Interrupts | EP1, EP2, EP3 |
| *Real-Time Concepts for Embedded Systems* — Qing Li & Caroline Yao | Chapter 4: RTOS Fundamentals | EP2 |
| FreeRTOS Documentation | Tasks, Queues, Semaphores | EP2 |
| IEC 62443-4-2:2019 | Security Levels, Technical Controls | SS1 |
| ISO 26262:2018 | ASIL levels, Technical Safety Requirements | SS2 |
| MQTT Specification v5.0 | QoS Levels | IP1 |
| *Game Engine Architecture* — Jason Gregory (3rd ed.) | Chapter 8: The Game Loop; Chapter 16: Runtime Gameplay Foundation | GA1, GA2 |
| GDC: Gaffer on Games — "Fix Your Timestep!" | Fixed timestep loop | GA1 |
| GGPO Network Library — Glenn Fiedler | Rollback netcode | GA3 |
