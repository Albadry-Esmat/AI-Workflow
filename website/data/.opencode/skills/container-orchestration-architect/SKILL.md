---
name: container-orchestration-architect
version: 1.0.0
domain: cloud
description: >
  Use when designing Kubernetes cluster architectures, defining workload manifests, planning autoscaling strategies, or configuring GitOps pipelines. Triggers on: "Kubernetes design", "K8s architecture", "cluster topology", "Helm chart design", "GitOps setup", "KEDA autoscaling", "multi-cluster federation". Do NOT use for serverless or VM-based workloads — use serverless-architect or deployment-strategy for those.
author: system
---

## Purpose

Design complete Kubernetes and container orchestration architectures that are production-grade, cost-optimized, and operationally mature. This skill covers the full K8s design surface: cluster topology selection (single-cluster multi-namespace vs multi-cluster federation), node pool design (general-purpose, compute-optimized, GPU, spot/preemptible pools, dedicated node pools with taints and tolerations), namespace strategy (environment-based, team-based, or domain-based), and RBAC model (ClusterRole, Role, ServiceAccount binding patterns with principle of least privilege mapped to team ownership boundaries).

Workload design is a core output: the skill applies selection criteria for Deployment (stateless, rolling updates), StatefulSet (ordered pods, stable network identities, PVC-per-pod: databases, Kafka brokers, ZooKeeper), DaemonSet (per-node agents: Fluentd, Prometheus Node Exporter, CNI plugins, security agents), Job/CronJob (batch processing, data migrations, scheduled reports), and HorizontalPodAutoscaler (HPA) vs VerticalPodAutoscaler (VPA) vs KEDA (event-driven: SQS queue depth, Kafka consumer lag, Prometheus metrics, Azure Service Bus). Resource management covers requests/limits tuning, LimitRange defaults, ResourceQuota per namespace, and PodDisruptionBudget to preserve availability during node drain operations.

The skill designs the full networking stack: CNI selection (Cilium for eBPF-based policy enforcement and observability, Calico for BGP/policy-rich environments, Flannel for simplicity), Ingress controller selection (NGINX, Traefik, AWS ALB Ingress Controller, GKE Ingress), Network Policy rules (default-deny-all baseline, explicit allow rules per port and label selector), and optional service mesh integration (Istio with mTLS, Envoy sidecars, traffic management; Linkerd for lightweight mutual TLS). GitOps pipeline design covers Argo CD (Application, ApplicationSet, App-of-Apps pattern) and Flux (GitRepository, Kustomization, HelmRelease CRDs), multi-cluster federation approaches (Argo CD multi-cluster with external Secrets, Cluster API for cluster lifecycle management), and cost optimization strategies (Karpenter node autoprovisioning, Cluster Autoscaler, spot instance node pools with mixed instance types and on-demand fallback).

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `workloads` | `array` | Yes | Workload definitions: name, type, replicas, resource profile, storage needs |
| `cluster_purpose` | `string` | No | Cluster tier: `production`, `staging`, `dev`, or `ml`. Defaults to `production` |
| `cloud_provider` | `string` | No | Managed K8s provider: `aws_eks`, `gcp_gke`, `azure_aks`, `on_prem` |
| `gitops` | `boolean` | No | Enable GitOps pipeline design (Argo CD or Flux). Defaults to `true` |
| `service_mesh` | `boolean` | No | Design service mesh integration (Istio or Linkerd). Defaults to `false` |
| `multi_cluster` | `boolean` | No | Design multi-cluster federation topology. Defaults to `false` |
| `context` | `object` | No | Additional context: team structure, compliance needs, existing tooling |

**Input Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "workloads": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "properties": {
          "name":              { "type": "string" },
          "type":              { "type": "string", "enum": ["web","api","worker","database","cache","ml_inference","batch","cron"] },
          "replicas":          { "type": "integer", "minimum": 1 },
          "cpu_request_m":     { "type": "integer", "description": "CPU request in millicores" },
          "memory_request_mi": { "type": "integer", "description": "Memory request in MiB" },
          "storage_gi":        { "type": "integer", "description": "Persistent storage in GiB; 0 for stateless" },
          "gpu":               { "type": "boolean", "default": false }
        },
        "required": ["name", "type"]
      }
    },
    "cluster_purpose": { "type": "string", "enum": ["production","staging","dev","ml"] },
    "cloud_provider": { "type": "string", "enum": ["aws_eks","gcp_gke","azure_aks","on_prem"] },
    "gitops": { "type": "boolean", "default": true },
    "service_mesh": { "type": "boolean", "default": false },
    "multi_cluster": { "type": "boolean", "default": false },
    "context": {
      "type": "object",
      "properties": {
        "team_namespaces": { "type": "array", "items": { "type": "string" } },
        "compliance":      { "type": "array", "items": { "type": "string" } },
        "node_budget":     { "type": "object" }
      }
    }
  },
  "required": ["workloads"]
}
```

## Required Context

- Workload list with type classification and resource profile estimates (mandatory)
- Cloud provider for managed K8s add-on availability (EKS Managed Node Groups, GKE Autopilot, AKS System/User node pools)
- Team structure from `context.team_namespaces` for RBAC model design
- Compliance requirements (PCI DSS, HIPAA, CIS Benchmark for K8s) for Pod Security Standards and NetworkPolicy hardening
- Existing GitOps tooling if extending an existing cluster (avoid recommending both Argo CD and Flux simultaneously)

## Execution Logic

```
Step 1 — Classify workloads and select K8s primitive types
  For each workload, map type to K8s primitive:
    web/api:        Deployment (stateless, rolling update strategy, readiness probe required)
    worker:         Deployment (stateless) or StatefulSet (if ordered processing needed)
    database/cache: StatefulSet (stable network identity, PVC-per-pod, headless service)
    ml_inference:   Deployment with GPU tolerations and node affinity (nvidia.com/gpu resource)
    batch:          Job (completions, parallelism, backoffLimit) or CronJob (schedule expression)
    cron:           CronJob (suspend: false, concurrencyPolicy: Forbid for exclusive runs)
  Flag: any database workload without storage_gi > 0 as a configuration error.
  Output: workload_classifications[]

Step 2 — Design cluster topology
  Single cluster (default): namespace-based isolation with NetworkPolicy enforcement.
  Multi-cluster (if multi_cluster: true): hub-and-spoke (Argo CD hub cluster + workload clusters),
    Cluster API for cluster lifecycle, external-secrets for cross-cluster secret sharing.
  Node pool design:
    System pool: 3 nodes, m5.large/n2-standard-4/Standard_D4s_v3, NoSchedule taint for user workloads.
    General pool: min 2 / max 20, m5.xlarge equivalent, on-demand.
    Spot pool: min 0 / max 50, mixed instance types (3+ families), on-demand fallback.
    GPU pool (if any GPU workload): p3.xlarge/a100-equivalent, taint nvidia.com/gpu=true:NoSchedule.
    ML pool (if ml_inference workloads): high-memory instances, Karpenter NodePool with consolidation.
  Namespace strategy: per-environment (dev/staging/prod) × per-team prefixed (team-payments, team-search).
  Output: cluster_design { node_pools[], namespaces[], networking_summary }

Step 3 — Define resource requests and limits
  For each workload:
    requests.cpu = estimated_steady_state_cpu_m (use input or heuristic: 100m per replica).
    requests.memory = estimated_steady_state_mem_mi.
    limits.cpu = requests.cpu × 4 (allow burst; avoid CPU throttling on Java GC).
    limits.memory = requests.memory × 1.5 (OOM kill threshold; tighter for JVM workloads).
  Namespace LimitRange: default request and limit for containers without explicit values.
  Namespace ResourceQuota: total CPU, memory, PVC count, and pod count caps per namespace.
  PodDisruptionBudget: minAvailable = max(1, replicas - 1) for all Deployments with replicas >= 2.
  Output: resource_configs[]

Step 4 — Design autoscaling policies
  HPA: for web/api/worker workloads — CPU targetAverageUtilization: 70%, memory: 80%.
  VPA: for workloads with unpredictable resource needs — mode: Off (recommendation only) initially.
  KEDA: for queue-driven or event-driven workers:
    SQS ScaledObject: queueURL, targetQueueLength (default: 10 messages per replica).
    Kafka ScaledObject: bootstrapServers, consumerGroup, lagThreshold (default: 100).
    Prometheus ScaledObject: serverAddress, query (PromQL), threshold.
  Cluster Autoscaler (CA): node group min/max, scale-down-unneeded-time: 10m.
  Karpenter (AWS EKS): NodePool with Disruption budget, consolidationPolicy: WhenUnderutilized.
  Output: autoscaling_config[]

Step 5 — Design storage patterns
  For each StatefulSet workload:
    PVC template: storageClassName, accessModes (ReadWriteOnce for block, ReadWriteMany for NFS/EFS).
    Storage class selection: gp3 (AWS EBS), pd-ssd (GCP), Premium_LRS (Azure) for databases.
    Backup strategy: Velero schedule for PVC snapshots, CSI snapshot class configuration.
  Distributed storage (if multi-replica stateful workloads): Rook/Ceph or provider-native
    (EFS CSI driver, Filestore CSI, Azure Files CSI) for ReadWriteMany workloads.
  Output: storage_designs[]

Step 6 — Design networking and security policies
  CNI selection: Cilium (eBPF, recommended for policy + observability), Calico (BGP environments).
  Ingress controller: NGINX Ingress (general purpose), AWS ALB Ingress Controller (EKS + AWS ALB),
    GKE Ingress (GCE backend services), Azure Application Gateway Ingress (AGIC).
  Network Policy baseline: default-deny-all ingress and egress per namespace.
  Allow rules: namespace-scoped, port-scoped; use podSelector + namespaceSelector.
  Service mesh (if service_mesh: true): Istio with PeerAuthentication (STRICT mTLS),
    VirtualService for traffic routing, DestinationRule for circuit breaking,
    AuthorizationPolicy for workload-to-workload access control.
  TLS: cert-manager with Let's Encrypt ClusterIssuer (ACME DNS-01 challenge) or
       internal CA for private clusters.
  Output: network_policies[]

Step 7 — Design Helm chart structure
  Chart structure: Chart.yaml, values.yaml, templates/{deployment,service,ingress,hpa,pdb,configmap}.yaml.
  values.yaml: replicaCount, image.repository/tag, resources, autoscaling.enabled, ingress.enabled.
  Subcharts (dependencies): postgresql (Bitnami), redis (Bitnami), rabbitmq (Bitnami) via requirements.yaml.
  Helm release naming: <team>-<service>-<environment> convention.
  Output: helm_chart_structure { chart_yaml, values_yaml_template, template_list[] }

Step 8 — Design GitOps configuration
  If gitops: false — skip this step.
  Argo CD (default): App-of-Apps pattern for environment promotion.
    Application CRD: repoURL, targetRevision, path, destination (cluster + namespace).
    ApplicationSet: generators (Git directory generator for env-based promotion, cluster generator).
    Sync policy: automated: {prune: true, selfHeal: true}; syncOptions: [CreateNamespace=true].
    RBAC: argocd-rbac-cm with role:readonly for developers, role:admin for platform team.
  Flux (alternative if context.existing_gitops == "flux"):
    GitRepository source, Kustomization for overlay promotion, HelmRelease for chart releases.
  Secrets management: external-secrets-operator with SecretStore pointing to
    AWS Secrets Manager / GCP Secret Manager / Azure Key Vault (never store secrets in Git).
  Output: gitops_config { tool, app_of_apps_structure, rbac_config, secrets_config }

Step 9 — Design RBAC model
  ClusterRole: view, edit, admin (use built-in K8s roles as base).
  Custom roles: namespace-scoped Role for CI/CD service accounts (apply, get, list on owned resources).
  ServiceAccount per workload: no default ServiceAccount sharing; disable automountServiceAccountToken.
  Pod Security Standards: production clusters enforce `restricted` profile via namespace label.
  Audit policy: log RequestResponse for sensitive resource types (secrets, configmaps, serviceaccounts).
  Output: rbac_design { cluster_roles[], namespace_roles[], service_accounts[], pss_config }

Step 10 — Compile cost optimization notes
  Spot instance savings: estimate 60-80% cost reduction vs on-demand for spot-eligible workloads.
  Bin packing: Karpenter consolidation vs CA bin packing efficiency comparison.
  Right-sizing: identify over-provisioned workloads (limits >> requests; p95 CPU < 30% of request).
  Namespace ResourceQuota enforcement: prevents accidental over-provisioning.
  Recommendations: node pool scheduling strategy, Topology Spread Constraints for HA + cost balance.
  Output: cost_optimization_notes[]
```

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `cluster_design` | `object` | Node pools, namespace layout, networking summary, CNI/Ingress selection |
| `workload_specs` | `array` | K8s manifest templates per workload (Deployment/StatefulSet/Job YAML skeletons) |
| `helm_chart_structure` | `object` | Chart.yaml, values.yaml template, template file list |
| `autoscaling_config` | `array` | HPA/VPA/KEDA rules per workload with target metrics |
| `gitops_config` | `object` | Argo CD/Flux setup: app-of-apps, ApplicationSet, RBAC, secrets config |
| `rbac_design` | `object` | ClusterRoles, namespace Roles, ServiceAccounts, Pod Security Standards |
| `network_policies` | `array` | NetworkPolicy YAML specs per namespace with default-deny baseline |
| `cost_optimization_notes` | `array` | Spot usage estimates, bin-packing notes, right-sizing recommendations |
| `metrics` | `object` | Execution metrics: tokens_in, tokens_out, duration_ms, items_produced, version |
| `feedback` | `array` | Backpropagation and informational feedback entries |

**Output Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "cluster_design": {
      "type": "object",
      "properties": {
        "node_pools":        { "type": "array" },
        "namespaces":        { "type": "array" },
        "networking_summary":{ "type": "object" }
      },
      "required": ["node_pools","namespaces"]
    },
    "workload_specs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "workload_name": { "type": "string" },
          "kind":          { "type": "string", "enum": ["Deployment","StatefulSet","DaemonSet","Job","CronJob"] },
          "manifest_yaml": { "type": "string" }
        },
        "required": ["workload_name","kind","manifest_yaml"]
      }
    },
    "helm_chart_structure": {
      "type": "object",
      "properties": {
        "chart_yaml":           { "type": "string" },
        "values_yaml_template": { "type": "string" },
        "template_list":        { "type": "array", "items": { "type": "string" } }
      },
      "required": ["chart_yaml","values_yaml_template","template_list"]
    },
    "autoscaling_config": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "workload":    { "type": "string" },
          "type":        { "type": "string", "enum": ["HPA","VPA","KEDA","Karpenter"] },
          "config_yaml": { "type": "string" }
        },
        "required": ["workload","type"]
      }
    },
    "gitops_config": {
      "type": "object",
      "properties": {
        "tool":               { "type": "string", "enum": ["argocd","flux","none"] },
        "structure":          { "type": "object" },
        "rbac_config":        { "type": "object" },
        "secrets_config":     { "type": "object" }
      },
      "required": ["tool"]
    },
    "rbac_design": {
      "type": "object",
      "properties": {
        "cluster_roles":     { "type": "array" },
        "namespace_roles":   { "type": "array" },
        "service_accounts":  { "type": "array" },
        "pss_config":        { "type": "object" }
      },
      "required": ["cluster_roles","service_accounts"]
    },
    "network_policies": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name":      { "type": "string" },
          "namespace": { "type": "string" },
          "policy_yaml":{ "type": "string" }
        },
        "required": ["name","namespace","policy_yaml"]
      }
    },
    "cost_optimization_notes": {
      "type": "array",
      "items": { "type": "object", "properties": { "note": { "type": "string" }, "estimated_savings_pct": { "type": "number" } }, "required": ["note"] }
    },
    "metrics": {
      "type": "object",
      "properties": {
        "tokens_in":      { "type": "integer" },
        "tokens_out":     { "type": "integer" },
        "duration_ms":    { "type": "integer" },
        "items_produced": { "type": "integer" },
        "version":        { "type": "string" }
      },
      "required": ["tokens_in","tokens_out","duration_ms","items_produced","version"]
    },
    "feedback": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type":        { "type": "string", "enum": ["backpropagate","info","warning"] },
          "from_skill":  { "type": "string" },
          "target_skill":{ "type": "string" },
          "reason":      { "type": "string" },
          "evidence":    { "type": "object" }
        },
        "required": ["type","from_skill","reason"]
      }
    }
  },
  "required": ["cluster_design","workload_specs","helm_chart_structure","autoscaling_config","gitops_config","rbac_design","network_policies","cost_optimization_notes","metrics","feedback"]
}
```

## Rules & Constraints

- Every database or cache workload MUST be assigned a StatefulSet, never a Deployment; Deployments for stateful workloads are flagged as an architectural error.
- PodDisruptionBudget MUST be defined for all Deployments/StatefulSets with `replicas >= 2` to protect against accidental full drain.
- Network Policy baseline MUST include a `default-deny-all` ingress and egress rule per namespace before any allow rules are applied.
- Secrets MUST be managed via external-secrets-operator referencing a vault (AWS SM / GCP SM / Azure KV); Kubernetes Secrets with plaintext values MUST NOT be committed to Git.
- Production clusters MUST enforce Pod Security Standards `restricted` profile; `baseline` is acceptable for staging; `privileged` requires explicit justification.
- HPA and VPA MUST NOT be applied simultaneously to the same workload on CPU/memory metrics (conflict); use KEDA + VPA instead for event-driven + right-sizing.
- Helm chart `values.yaml` MUST NOT contain environment-specific values; overlays are managed via Argo CD ApplicationSet generators or Kustomize patches.

## Security Considerations

- ServiceAccounts MUST have `automountServiceAccountToken: false` unless the workload explicitly requires K8s API access; token mounting is a common lateral movement vector.
- All inter-pod communication in production MUST be encrypted: use Istio STRICT mTLS or Linkerd automatic mTLS if service_mesh is enabled; use NetworkPolicy + TLS in-app otherwise.
- Pod Security Standards `restricted` profile prevents privilege escalation, host path mounts, privileged containers, and hostPID/hostNetwork access.
- Audit logs MUST capture `RequestResponse` verbosity for `secrets`, `configmaps`, and `serviceaccounts` resource types; audit logs must be shipped to an immutable log store.
- RBAC bindings MUST follow least-privilege: CI/CD service accounts receive only `apply`/`get`/`list` on their owned namespace resources, never cluster-admin.

## Token Optimization

- Workload manifest YAML in `workload_specs` is returned as a compact skeleton (< 50 lines per manifest); omit optional annotations and labels blocks until populated by `documentation-generator`.
- Network policies: return only non-trivial policies (skip default-allow-same-namespace if Cilium/Calico handles it via label selectors).
- RBAC output: return policy bindings as compact YAML; use references (`roleRef: ClusterRole/edit`) rather than inlining full ClusterRole definitions.
- Limit `cost_optimization_notes` to top 5 items by estimated savings percentage.

## Quality Checklist

- [ ] All database/cache workloads assigned StatefulSet kind
- [ ] PodDisruptionBudgets defined for all multi-replica workloads
- [ ] Network Policy default-deny-all baseline present for every namespace
- [ ] No plaintext Kubernetes Secrets in GitOps repository references
- [ ] Pod Security Standards profile assigned per namespace
- [ ] HPA and VPA not configured simultaneously for the same workload on CPU/memory
- [ ] Helm values.yaml contains no environment-specific values
- [ ] GitOps config uses external-secrets-operator for all secret references

## Failure Scenarios

| Condition | Fallback Behavior |
|-----------|-------------------|
| No workloads provided | Reject: `{"error": "NO_WORKLOADS", "min_items": 1}` |
| GPU workload present but `cloud_provider` not specified | Emit warning; generate generic GPU tolerations; flag that node pool must be configured manually |
| `service_mesh: true` and `cloud_provider: on_prem` | Recommend Istio self-hosted; note that cloud-managed mesh (ASM/Anthos) is unavailable |
| Both `gitops: false` and `multi_cluster: true` | Reject: multi-cluster without GitOps is an operational anti-pattern; require gitops: true |
| Workload `storage_gi > 0` but no `cloud_provider` specified | Use generic StorageClass placeholder; flag as `STORAGE_CLASS_REQUIRES_PROVIDER` in feedback |

## 12. Human-in-the-Loop Gates

| Gate | Trigger | Timeout | Behavior |
|------|---------|---------|----------|
| Privileged container detected | Any workload requiring `securityContext.privileged: true` | 3600s | Pause; require security lead sign-off with documented justification |
| Multi-cluster federation design | `multi_cluster: true` and production cluster_purpose | 7200s | Present multi-cluster topology to platform architect for approval before finalization |

## 13. Skill Composition

`container-orchestration-architect` bridges `architecture-design` and `deployment-strategy`:

```yaml
composes:
  - skill: container-orchestration-architect
    version: "^1.0.0"
    input_map:
      workloads: "architecture.modules[*].{ name: name, type: workload_type, replicas: min_replicas }"
      cloud_provider: "session.cloud_provider"
      gitops: "session.gitops_enabled"
      cluster_purpose: "session.environment"
    output_map:
      cluster_design: "state.k8s_spec.cluster"
      workload_specs: "state.k8s_spec.manifests"
      gitops_config: "state.k8s_spec.gitops"
      helm_chart_structure: "state.k8s_spec.helm"
```
