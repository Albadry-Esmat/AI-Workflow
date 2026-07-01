---
name: realtime-system-architect
version: 1.0.0
domain: architecture
description: >
  Use when designing real-time communication architectures for collaborative, live-update, and
  presence-aware applications. Triggers on: "real-time architecture", "WebSocket design",
  "collaborative editing", "CRDT/OT design", "WebRTC architecture", "presence system",
  "horizontal scaling WebSocket", "Pub/Sub design for real-time". Do NOT use for standard
  request-response APIs, async job queues, or batch data pipelines — use architecture-design
  for those concerns.
author: system
---

## Purpose

Design a production-grade real-time communication architecture that achieves sub-100ms latency, survives horizontal scaling across multiple server instances, and maintains consistency guarantees appropriate to the application's use case. The skill covers the full real-time technology stack: WebSocket server design (Socket.IO ≥4, ws ≥8, uWebSockets.js ≥20 for high-throughput, Phoenix Channels for Elixir), Server-Sent Events (SSE) for unidirectional server-push streams, and WebRTC peer-to-peer communication with SFU/MCU topology selection and media server integration (Mediasoup ≥3, LiveKit, Jitsi).

For collaborative editing and conflict-free shared state, the skill applies operational transformation (OT) via ShareDB/json0 or CRDT algorithms (Yjs ≥13 with awareness protocol for presence, Automerge ≥2 for JSON structures). The choice between OT and CRDT is made explicit: OT requires a central server to serialize operations and is simpler at small scale; CRDTs are server-optional, merge automatically, but carry memory overhead. Both approaches produce concrete binding recommendations for the frontend (yjs-codemirror-6, yjs-quill, y-monaco).

Horizontal scaling is the most common failure mode of naive real-time systems. The skill designs the Redis Pub/Sub fan-out topology (redis.io adapter for Socket.IO, Phoenix.PubSub for Elixir), sticky session trade-offs, and stateless WebSocket design patterns using external state stores. Edge real-time delivery (Cloudflare Durable Objects, Ably, Pusher) is evaluated as a managed alternative that eliminates the scaling complexity entirely for applicable use cases.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `use_case` | `string` | Yes | Primary real-time use case: `chat`, `collaborative_editing`, `live_dashboard`, `video_conferencing`, `gaming`, `presence`, `notifications` |
| `scale` | `object` | Yes | Scale targets: `concurrent_users` (integer), `messages_per_second` (integer) |
| `persistence_required` | `boolean` | No | Whether messages/events must be durably persisted (message history, audit). Default: `false` |
| `p2p_capable` | `boolean` | No | Whether peer-to-peer WebRTC communication is required. Default: `false` |
| `platform` | `string` | No | Backend runtime: `nodejs`, `elixir`, `go`, `java`. Default: `nodejs` |
| `collaboration_scope` | `string` | No | For collaborative_editing: `text`, `structured_data`, `canvas`. Default: `text` |
| `latency_budget_ms` | `integer` | No | Maximum acceptable end-to-end latency in ms. Default: 200 |
| `context` | `object` | No | Upstream context (architecture, deployment_strategy) |

**Input Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["use_case", "scale"],
  "properties": {
    "use_case": {
      "type": "string",
      "enum": ["chat", "collaborative_editing", "live_dashboard", "video_conferencing",
               "gaming", "presence", "notifications"]
    },
    "scale": {
      "type": "object",
      "required": ["concurrent_users"],
      "properties": {
        "concurrent_users":    { "type": "integer", "minimum": 1 },
        "messages_per_second": { "type": "integer", "minimum": 0 }
      }
    },
    "persistence_required": { "type": "boolean", "default": false },
    "p2p_capable":          { "type": "boolean", "default": false },
    "platform": {
      "type": "string",
      "enum": ["nodejs", "elixir", "go", "java"],
      "default": "nodejs"
    },
    "collaboration_scope": {
      "type": "string",
      "enum": ["text", "structured_data", "canvas"],
      "default": "text"
    },
    "latency_budget_ms": { "type": "integer", "minimum": 10, "default": 200 },
    "context": { "type": "object" }
  }
}
```

## Required Context

- Architecture modules from `architecture-design` (identifies which services produce/consume real-time events).
- Deployment strategy from `deployment-strategy` (node count, load balancer sticky session capability, Redis availability).
- Scale requirements from `requirement-analyzer` (concurrent user counts and throughput targets).

## Execution Logic

```
Step 1 — Protocol selection
  Apply decision matrix based on use_case and requirements:
    WebSocket (bidirectional, stateful):
      → chat, collaborative_editing, gaming, presence, video_signaling
      → concurrent_users > 100 with low-latency bidirectional messages
    SSE (unidirectional server→client, HTTP/2 multiplexed):
      → live_dashboard, notifications (no client→server events needed)
      → Advantage: works over HTTP/2, no upgrade required, simple reconnection (EventSource API)
      → Limit: client cannot send messages; use REST POST for client actions
    WebRTC (peer-to-peer, UDP-based):
      → video_conferencing, voice, screen sharing
      → p2p_capable: true (STUN/TURN required regardless)
    Long-polling (fallback only):
      → legacy environments where WebSocket is blocked by proxy
  Apply latency constraints:
    latency_budget_ms < 50ms → WebSocket required; SSE is insufficient
    latency_budget_ms < 20ms → UDP (WebRTC data channel or custom UDP); WebSocket adds TCP overhead
  Output: protocol_recommendation { primary, rationale, fallback, latency_analysis }

Step 2 — WebSocket server design
  Select library per platform:
    nodejs:
      High throughput (concurrent_users > 50k): uWebSockets.js v20 (2M+ connections/server)
      Standard (< 50k): Socket.IO v4 with ws transport (full-stack, namespace/room support)
      Minimal: ws v8 (raw WebSocket, ~65k connections/server)
    elixir:
      Phoenix Channels v1.7 (native process-per-connection model; 1M+ connections on Elixir)
    go:
      gorilla/websocket v1.5 or nhooyr.io/websocket (goroutine-per-connection; 100k+ per instance)
    java:
      Spring WebSocket (STOMP over WebSocket) or Quarkus WebSocket (reactive, low overhead)
  Connection model:
    Room/Channel abstraction: logical group for broadcasting (one chatroom, one document, one game)
    Namespace (Socket.IO): separate event namespaces per domain (/chat, /dashboard, /collab)
  Connection lifecycle:
    Heartbeat: server ping every 25s; disconnect if pong not received within 5s
    Reconnection: exponential backoff (base=500ms, max=30s, jitter=±20%)
    Auth: JWT verification on connection handshake (query param or first message; NOT cookie)
  Output: server_design { library, connection_model, room_schema, heartbeat_config, auth_strategy }

Step 3 — Channel and room model
  Define logical groupings for message routing:
    Chat:      room_id = conversation_id; users join/leave rooms dynamically
    Collab:    room_id = document_id; all editors of same document in same room
    Dashboard: room_id = dashboard_id or "global" for public metrics
    Gaming:    room_id = game_session_id; spectator room derived from game_id
    Presence:  room_id = "presence:{resource_id}" (track who is viewing what)
  Message routing:
    Unicast:   socket.to(socketId).emit() for private messages
    Broadcast: io.to(roomId).emit() for room-wide events
    Fan-out:   server-side fan-out to all subscribers (chat message to all room members)
  Output: room_channel_model { room_type, join_strategy, message_routing_patterns[] }

Step 4 — Horizontal scaling strategy
  Problem: WebSocket connections are stateful; two users in the same room may be on different servers.
  Solutions by scale:
    concurrent_users < 1000: single server, no scaling needed; Redis optional
    concurrent_users 1000-100k: Redis Pub/Sub adapter
      Socket.IO: @socket.io/redis-adapter v8 (publishes room events to Redis, all servers fan-out)
      ws: custom Redis pub/sub subscriber per server
      Phoenix: Phoenix.PubSub :redis_pubsub adapter
      Message flow: Server A → Redis PUBLISH room:{id} → Server B subscribes → forwards to local sockets
    concurrent_users > 100k: Redis Cluster Pub/Sub + consistent hash routing
      OR: Managed real-time (Ably, Pusher Channels, Cloudflare Durable Objects)
    Sticky sessions: NLB (AWS NLB, not ALB) with source IP affinity as fallback
      Risk: uneven load distribution; only use as supplement to Redis adapter, not replacement
  Load balancer config: TCP passthrough (not HTTP); WebSocket upgrade must not be terminated at LB.
  Output: scaling_strategy { model, redis_adapter, connection_distribution, lb_config }

Step 5 — Collaborative editing design (if use_case: collaborative_editing)
  Choose between OT and CRDT:
    OT (Operational Transformation):
      + Simpler server logic; server serializes operations
      + Smaller client bundle; json0 OT type is mature
      - Requires central server to be single source of truth
      - Harder to implement correctly (complex transform functions)
      Libraries: ShareDB (json0 OT) for structured data; CodeMirror 6 with collab extension for text
    CRDT (Conflict-free Replicated Data Type):
      + No central coordination required; offline-first capable
      + Automatic merge; no server-side operation transformation
      - Higher memory footprint (grows with edit history unless GC applied)
      - More complex awareness (who is editing where)
      Libraries by scope:
        text:             Yjs v13 + y-codemirror.next | y-monaco | y-quill
        structured_data:  Yjs Y.Map/Y.Array | Automerge v2 (better JS interop)
        canvas:           Yjs Y.Map with custom CRDT types
  Recommendation matrix:
    Real-time text editor → Yjs + awareness protocol (cursor positions, user names)
    JSON document collab  → Automerge v2 (immutable snapshots, git-like merge)
    Server exists always  → ShareDB (OT) is simpler and battle-tested
  Persistence: Yjs leveldb-persistence or Automerge repo with custom storage adapter.
  Output: conflict_resolution { algorithm: OT|CRDT, library, binding, persistence_adapter, rationale }

Step 6 — Presence system design
  Presence = who is online, where, and what they are doing.
  Architecture:
    Redis sorted set: ZADD presence:{resource_id} {timestamp} {user_id}
      Heartbeat: client sends ping every 15s → server ZADD with current timestamp
      Cleanup: ZREMRANGEBYSCORE (timestamp < now-30s) removes stale presence entries
      Read: ZRANGE presence:{resource_id} 0 -1 WITHSCORES for current viewers
    Yjs awareness (if collaborative_editing): awareness.setLocalStateField('user', { name, color, cursor })
      Awareness is ephemeral (not persisted); auto-cleaned on disconnect
  Presence events:
    user_joined: { user_id, resource_id, metadata, timestamp }
    user_left:   { user_id, resource_id, timestamp }
    user_activity: { user_id, activity_type: 'typing'|'viewing'|'editing', timestamp }
  Typing indicator: debounce typing events (200ms); send user_activity on keypress; clear after 3s idle.
  Output: presence_system { storage: redis|awareness, heartbeat_interval_s, events[], typing_strategy }

Step 7 — WebRTC design (if p2p_capable: true)
  Topology selection:
    Mesh (< 4 peers):     each peer connects directly to every other peer (O(n²) connections)
    SFU (4-50 peers):     Selective Forwarding Unit — each peer sends once; SFU forwards selectively
      Media servers: Mediasoup v3 (Node.js native WebRTC, low overhead), LiveKit (Go, cloud-native)
    MCU (> 50 peers, recording): Media Composition Unit — server mixes all streams into one
      Jitsi Videobridge (SFU) + Jitsi Jicofo (focus component) for scalable conferencing
  STUN/TURN infrastructure:
    STUN: coturn with Google STUN as fallback (stun:stun.l.google.com:19302)
    TURN: mandatory for enterprise networks with strict NAT; coturn relay
    TURN credentials: time-limited HMAC-SHA1 credentials (NOT static username/password)
    Bandwidth: TURN relay adds 20-50% overhead; allocate 0.5 Mbps per TURN relay session
  Signaling: WebSocket server as signaling channel for SDP offer/answer and ICE candidate exchange
    SDP exchange flow: caller → offer → server → answer ← callee; trickle ICE for faster connection
  Output: webrtc_design { topology, media_server, stun_config, turn_config, signaling_protocol }

Step 8 — Connection state management and reliability
  Client-side reconnection:
    EventEmitter pattern: emit 'disconnect' → start reconnection timer → exponential backoff
    State machine: CONNECTED → DISCONNECTING → DISCONNECTED → RECONNECTING → CONNECTED
    Message queue: buffer outbound messages during RECONNECTING; replay on CONNECTED
    Maximum buffer: 100 messages or 30s of messages (whichever smaller) before dropping
  Server-side connection tracking:
    Connection registry: Redis HSET connections:{server_id} {socket_id} {user_id} with TTL
    Clean up on disconnect: HDEL connections:{server_id} {socket_id}
  Message ordering:
    Sequence numbers: server assigns monotonic sequence_id per room; clients detect gaps
    Gap recovery: client sends reconnect with last_sequence_id; server replays missed events
  Output: connection_state_mgmt { reconnection_policy, message_queue, ordering_strategy, registry }

Step 9 — Message persistence design (if persistence_required: true)
  Message store: Redis Streams (XADD) for hot/recent messages; PostgreSQL or MongoDB for cold storage
    Redis Streams: XADD messages:{room_id} * {fields} → XRANGE for history reads
    Archival: stream consumer group reads from Redis → writes to PostgreSQL (batch every 60s)
    Message schema: { id: stream_entry_id, room_id, user_id, content, type, created_at, metadata }
  Read history API: paginated GET /rooms/{id}/messages?before={timestamp}&limit=50
  Delivery acknowledgment: XACK when client confirms receipt (at-least-once delivery)
  Output: persistence_design { hot_store, cold_store, archival_strategy, history_api, ack_protocol }

Step 10 — Latency budget allocation
  Define per-hop latency targets:
    Client → CDN/LB:           20ms (network RTT, regional)
    LB → WebSocket server:      5ms (internal network)
    Server processing:         10ms (message parsing, auth check, room routing)
    Server → Redis Pub/Sub:    5ms (Redis command round-trip, same AZ)
    Redis → peer server fan-out:5ms (Redis subscription delivery)
    Peer server → client:       5ms (internal → client)
    Total (same region):      ~50ms (well within 200ms default budget)
  P2P (WebRTC, same region):   20-40ms (direct UDP path after ICE)
  P2P (cross-continent):       100-200ms (TURN relay + geographic distance)
  Output: latency_budget { per_hop[], total_budget_ms, p99_target_ms, degraded_mode_ms }

Step 11 — Assemble architecture document
  Combine all step outputs into structured real-time architecture spec.
  Produce Mermaid sequence diagram for primary message flow.
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `architecture_design` | `object` | Full topology: components, protocols, data flow diagram |
| `protocol_recommendation` | `object` | Primary protocol (WebSocket/SSE/WebRTC), rationale, fallback |
| `server_design` | `object` | Library, connection model, room schema, heartbeat, auth strategy |
| `scaling_strategy` | `object` | Horizontal scaling model, Redis adapter, LB config |
| `conflict_resolution` | `object` | OT or CRDT algorithm, library, persistence adapter (null if not collab) |
| `presence_system` | `object` | Storage approach, heartbeat interval, presence events |
| `webrtc_design` | `object` | Topology, media server, STUN/TURN config, signaling (null if not p2p) |
| `connection_state_mgmt` | `object` | Reconnection policy, message queue, ordering strategy |
| `persistence_design` | `object` | Message store, archival strategy, history API (null if not requested) |
| `latency_budget` | `object` | Per-hop targets, total budget, P99 target |
| `metrics` | `object` | `tokens_in`, `tokens_out`, `duration_ms`, `items_produced`, `version` |
| `feedback` | `array[object]` | Backpropagate entries for upstream skills |

**Output Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["architecture_design", "protocol_recommendation", "server_design",
               "scaling_strategy", "presence_system", "connection_state_mgmt",
               "latency_budget", "metrics", "feedback"],
  "properties": {
    "architecture_design": {
      "type": "object",
      "required": ["topology", "components", "protocols"],
      "properties": {
        "topology":         { "type": "string" },
        "components":       { "type": "array" },
        "protocols":        { "type": "array" },
        "sequence_diagram": { "type": "string" }
      }
    },
    "protocol_recommendation": {
      "type": "object",
      "required": ["primary", "rationale"],
      "properties": {
        "primary":   { "type": "string", "enum": ["websocket", "sse", "webrtc", "long_polling"] },
        "rationale": { "type": "string" },
        "fallback":  { "type": "string" },
        "latency_analysis": { "type": "string" }
      }
    },
    "server_design": {
      "type": "object",
      "required": ["library", "connection_model"],
      "properties": {
        "library":          { "type": "string" },
        "version":          { "type": "string" },
        "connection_model": { "type": "string" },
        "room_schema":      { "type": "object" },
        "heartbeat_config": { "type": "object" },
        "auth_strategy":    { "type": "string" }
      }
    },
    "scaling_strategy": {
      "type": "object",
      "properties": {
        "model":                  { "type": "string" },
        "redis_adapter":          { "type": "string" },
        "connection_distribution":{ "type": "string" },
        "lb_config":              { "type": "object" }
      }
    },
    "conflict_resolution": { "type": ["object", "null"] },
    "presence_system": {
      "type": "object",
      "properties": {
        "storage":             { "type": "string" },
        "heartbeat_interval_s":{ "type": "integer" },
        "events":              { "type": "array" },
        "typing_strategy":     { "type": "string" }
      }
    },
    "webrtc_design": { "type": ["object", "null"] },
    "connection_state_mgmt": { "type": "object" },
    "persistence_design": { "type": ["object", "null"] },
    "latency_budget": {
      "type": "object",
      "properties": {
        "per_hop":       { "type": "array" },
        "total_budget_ms":{ "type": "integer" },
        "p99_target_ms": { "type": "integer" },
        "degraded_mode_ms":{ "type": "integer" }
      }
    },
    "metrics": {
      "type": "object",
      "required": ["tokens_in", "tokens_out", "duration_ms", "items_produced", "version"],
      "properties": {
        "tokens_in": { "type": "integer" }, "tokens_out": { "type": "integer" },
        "duration_ms": { "type": "integer" }, "items_produced": { "type": "integer" },
        "version": { "type": "string" }
      }
    },
    "feedback": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "from_skill", "reason"],
        "properties": {
          "type": { "type": "string", "enum": ["backpropagate", "info", "warning"] },
          "from_skill": { "type": "string" }, "target_skill": { "type": "string" },
          "reason": { "type": "string" }, "evidence": { "type": "object" }
        }
      }
    }
  }
}
```

## Rules & Constraints

- WebSocket JWT authentication MUST be performed on the initial handshake — connections without valid auth MUST be rejected immediately (not after first message).
- Redis Pub/Sub adapter is REQUIRED when `concurrent_users > 1000` and multi-node deployment is intended — single-server WebSocket without adapter is a blocking risk.
- Static TURN credentials (fixed username/password) MUST NOT be recommended — always use HMAC-SHA1 time-limited credentials.
- `conflict_resolution` MUST be produced when `use_case: collaborative_editing` — null is a blocking error.
- `webrtc_design` MUST be produced when `p2p_capable: true` — null is a blocking error.
- Mesh WebRTC topology MUST NOT be recommended for > 4 participants — flag and force SFU selection.
- Latency budget per-hop sum MUST be ≤ `latency_budget_ms` input or flag as infeasible.

## Security Considerations

- WebSocket connections MUST be authenticated via signed JWT on handshake — anonymous connections are permitted only for explicit public use cases (public dashboards) with explicit justification.
- TURN server credentials MUST be time-limited (TTL ≤ 3600s) using HMAC-SHA1 shared secret to prevent credential theft enabling relay abuse.
- Room access MUST be authorized: joining a room requires server-side verification that the user has read/write rights to that resource — never trust client-provided room IDs alone.
- Message content is not sanitized at the real-time layer — downstream consumers MUST validate and sanitize all WebSocket message payloads before processing or broadcasting.
- Presence data (who is viewing what) is PII-adjacent — apply the same data minimization and retention policies as user profile data.

## Token Optimization

- Skip `conflict_resolution` generation when `use_case` is not `collaborative_editing`.
- Skip `webrtc_design` generation when `p2p_capable: false`.
- Skip `persistence_design` generation when `persistence_required: false`.
- Compress `scale` analysis: derive Redis vs. managed real-time decision from concurrent_users thresholds without full comparative analysis when threshold is clearly one-sided.

## Quality Checklist

- [ ] Protocol selection matches `use_case` and `latency_budget_ms` constraints
- [ ] Redis adapter recommended when `concurrent_users > 1000`
- [ ] JWT auth on WebSocket handshake (not post-connection message)
- [ ] `conflict_resolution` present for `collaborative_editing` use case
- [ ] `webrtc_design` present when `p2p_capable: true` with TURN credential security note
- [ ] Latency budget per-hop totals ≤ `latency_budget_ms`
- [ ] Reconnection policy includes exponential backoff with jitter
- [ ] `scaling_strategy` sequence diagram (Mermaid) renders without errors

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| `concurrent_users > 1M` | Recommend managed real-time platform (Ably, Pusher, Cloudflare DO); emit `feedback.warning` |
| `latency_budget_ms < 20` and WebSocket selected | Flag as infeasible for standard WebSocket; recommend WebRTC data channels or QUIC-based transport |
| `platform: java` and `concurrent_users > 500k` | Recommend Quarkus reactive WebSocket + Vert.x event loop; flag thread-per-connection Tomcat as anti-pattern |
| `p2p_capable: true` and `use_case: gaming` simultaneously | Recommend WebRTC data channels for state; flag high-latency risk for real-time gaming; suggest dedicated game server protocol |
| `persistence_required: true` but no database in architecture context | Emit `feedback.backpropagate` to `database-architect` requesting message store schema design |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Architecture approval | `concurrent_users > 100k` or `p2p_capable: true` | 7200s | Present topology diagram, scaling model, and TURN infrastructure cost estimate for engineering + ops review |
| CRDT vs OT decision | `use_case: collaborative_editing` | 3600s | Present OT vs CRDT trade-off table; require explicit sign-off before code-generator scaffolds conflict resolution layer |

## 13. Skill Composition

```yaml
composes:
  - skill: realtime-system-architect
    version: "^1.0.0"
    input_map:
      use_case:            "session.realtime_use_case"
      scale:               "session.scale_targets"
      persistence_required:"session.message_persistence"
      p2p_capable:         "session.webrtc_required"
      platform:            "session.backend_platform"
      context:             "system_architecture"
    output_map:
      architecture_design:     "state.realtime_architecture"
      protocol_recommendation: "state.realtime_protocol"
      scaling_strategy:        "state.realtime_scaling"
      conflict_resolution:     "state.crdt_ot_design"
```
