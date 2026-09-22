"""Generate a deterministic CycloneDX 1.5 SBOM for both Dev repositories."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import uuid
from pathlib import Path


def package_name_from_path(path: str) -> str:
    value = path.removeprefix("node_modules/")
    parts = value.split("/", 1)
    if value.startswith("@") and len(parts) == 2:
        return value
    return parts[0]


def purl(name: str, version: str) -> str:
    return f"pkg:npm/{name}@{version}"


def load_lock(repository: str, lockfile: Path) -> tuple[dict, list[dict], list[dict], str]:
    raw = lockfile.read_bytes()
    lock = json.loads(raw)
    packages = lock.get("packages")
    if not isinstance(packages, dict):
        raise ValueError(f"{repository}: package-lock.json has no packages object")
    components = []
    dependencies = []
    refs_by_path: dict[str, str] = {}
    root = packages.get("", {})
    root_name = root.get("name", repository)
    root_version = root.get("version", "0.0.0")
    root_ref = purl(root_name, root_version)
    for path, entry in sorted(packages.items()):
        if not path or not path.startswith("node_modules/"):
            continue
        name = package_name_from_path(path)
        version = entry.get("version")
        if not name or not version:
            continue
        ref = purl(name, version)
        refs_by_path[path] = ref
        component = {
            "bom-ref": ref,
            "type": "library",
            "scope": "optional" if entry.get("optional") else ("required" if not entry.get("dev") else "development"),
            "name": name,
            "version": version,
            "purl": ref,
            "properties": [{"name": "aiw:repository", "value": repository}],
        }
        integrity = entry.get("integrity", "")
        if integrity.startswith("sha512-"):
            component["hashes"] = [{"alg": "SHA-512", "content": integrity.removeprefix("sha512-")}]
        if entry.get("license"):
            component["licenses"] = [{"license": {"id": entry["license"]}}]
        components.append(component)
    for path, entry in sorted(packages.items()):
        if path not in refs_by_path:
            continue
        depends_on = []
        for dep_name, spec in sorted((entry.get("dependencies") or {}).items()):
            candidate = f"{path}/node_modules/{dep_name}"
            candidate_ref = refs_by_path.get(candidate)
            if candidate_ref:
                depends_on.append(candidate_ref)
        dependencies.append({"ref": refs_by_path[path], "dependsOn": depends_on})
    return {"name": root_name, "version": root_version, "bom-ref": root_ref}, components, dependencies, hashlib.sha256(raw).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--website-root", type=Path, help="Optionally include a local website checkout")
    parser.add_argument("--output", type=Path, default=Path("artifacts/sbom.cdx.json"))
    args = parser.parse_args()
    source_root = args.source_root.resolve()
    repositories = [("AI-Workflow", source_root / "package-lock.json")]
    if args.website_root:
        repositories.append(("ASE-OS-Website", args.website_root.resolve() / "package-lock.json"))
    components: list[dict] = []
    dependencies: list[dict] = []
    roots = []
    lock_hashes = []
    for repository, lockfile in repositories:
        if not lockfile.exists():
            raise SystemExit(f"missing required lockfile: {lockfile}")
        root, repo_components, repo_dependencies, lock_hash = load_lock(repository, lockfile)
        roots.append(root)
        components.extend(repo_components)
        dependencies.extend(repo_dependencies)
        lock_hashes.append(f"{repository}:{lock_hash}")
    serial_seed = "|".join(lock_hashes).encode()
    serial = "urn:uuid:" + str(uuid.UUID(bytes=hashlib.sha256(serial_seed).digest()[:16]))
    bom = {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "serialNumber": serial,
        "version": 1,
        "metadata": {
            "component": {"type": "application", "name": "AI-Workflow", "version": "Dev"},
            "properties": [{"name": "aiw:lockfile-hash", "value": value} for value in lock_hashes],
        },
        "components": components,
        "dependencies": dependencies,
    }
    args.output.resolve().parent.mkdir(parents=True, exist_ok=True)
    args.output.resolve().write_text(json.dumps(bom, indent=2) + "\n")
    print(json.dumps({"format": "CycloneDX", "specVersion": "1.5", "components": len(components), "dependencies": len(dependencies), "output": str(args.output.resolve())}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
