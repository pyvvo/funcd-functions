"""Experiment 0015's attestation half, run by attest/workflow.yml on a branch of pyvvo/funcd-functions: on pyvvo's
plan GitHub signs artifact attestations only in public repositories, and pyvvo/experiment is private.

`produce` builds the functions, pushes them to GHCR with the pinned funcdctl and makes their SBOMs. The workflow's
actions/attest steps then sign an SBOM attestation for each platform manifest and for render, and a provenance
attestation for fetch's index and for render, all pushed to the registry. `consume` reads them back as a scan job
would: it verifies each attestation, extracts its SBOM, scans it, and tries a forged plain SBOM referrer. It writes
out/results-attest.json in the experiment's results format.
"""

import json
import os
import platform
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
OUT = HERE / "out"
FUNCDCTL = HERE / "bin" / "funcdctl"
FETCH = "ghcr.io/pyvvo/exp-0015-fetch"
RENDER = "ghcr.io/pyvvo/exp-0015-render"
REPO = "pyvvo/funcd-functions"
CDX_PREDICATE = "https://cyclonedx.org/bom"
CDX = "application/vnd.cyclonedx+json"
SAMPLES = int(os.environ.get("SAMPLES", "5"))
PY_VULNERABLE = {"requests", "urllib3", "jinja2", "cryptography"}
TS_VULNERABLE = {"lodash"}
SECRET = os.environ.get("GITHUB_TOKEN", "")
ENV = os.environ | {
    "TRIVY_NO_PROGRESS": "true",
    "TRIVY_SKIP_VERSION_CHECK": "true",
    "GRYPE_DB_AUTO_UPDATE": "false",
    "GRYPE_DB_VALIDATE_AGE": "false",
    "GRYPE_CHECK_FOR_APP_UPDATE": "false",
    "GH_TOKEN": SECRET,
    "UV_PYTHON": "python3.14",
    "UV_PYTHON_DOWNLOADS": "never",
}

Findings = set[tuple[str, str, str]]


def redact(text: str) -> str:
    return text.replace(SECRET, "***") if SECRET else text


def sh(*args: object, cwd: Path = HERE, check: bool = True, stdin: str | None = None, timeout: int = 1800) -> subprocess.CompletedProcess:
    argv = [str(a) for a in args]
    print(redact(f"$ {' '.join(argv)}"), flush=True)
    p = subprocess.run(argv, cwd=cwd, env=ENV, input=stdin, capture_output=True, text=True, timeout=timeout)
    if p.returncode != 0:
        print(redact(f"# rc={p.returncode}\n{p.stderr[-3000:]}"), flush=True)
    if check and p.returncode != 0:
        raise RuntimeError(redact(f"{argv[0]} exited {p.returncode}: {last_line(p.stderr or p.stdout)}"))
    return p


def last_line(text: str) -> str:
    lines = [line.strip() for line in redact(text).splitlines() if line.strip()]
    return lines[-1][:240] if lines else ""


def loads(text: str) -> object:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


def norm(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def login() -> None:
    """Logs oras (and through its Docker config, gh and actions/attest) and funcdctl in to GHCR with the job's token."""
    sh("oras", "login", "ghcr.io", "-u", os.environ["GITHUB_ACTOR"], "--password-stdin", stdin=SECRET)
    sh(FUNCDCTL, "login", "ghcr.io", "-u", os.environ["GITHUB_ACTOR"], "-p", SECRET)


def produce() -> None:
    OUT.mkdir(exist_ok=True)
    FUNCDCTL.parent.mkdir(exist_ok=True)
    sh("go", "build", "-o", FUNCDCTL, "./cmd/funcdctl", cwd=Path(os.environ["FUNCD_SRC"]))
    ts, py = HERE / "fn" / "ts", HERE / "fn" / "py"
    sh("npm", "ci", "--no-audit", "--no-fund", "--loglevel=error", cwd=ts)
    sh("npx", "vite", "build", "--logLevel", "warn", cwd=ts)
    sh("uv", "run", "--frozen", "funcd-bundle", "--platform", "linux/amd64", "--platform", "linux/arm64", "--no-check", cwd=py)
    login()
    tag = f"run-{os.environ['GITHUB_RUN_ID']}"
    digests = {"tag": tag}
    for a in ("amd64", "arm64"):
        out = sh(FUNCDCTL, "push", py / "dist" / f"linux-{a}" / "fetch", f"{FETCH}:{tag}-{a}", "--platform", f"linux/{a}")
        digests[f"fetch_{a}"] = out.stdout.strip().rsplit("@", 1)[1]
    out = sh(FUNCDCTL, "index", f"{FETCH}:{tag}", f"{FETCH}:{tag}-amd64", f"{FETCH}:{tag}-arm64")
    digests["fetch_index"] = out.stdout.strip().rsplit("@", 1)[1]
    digests["render"] = sh(FUNCDCTL, "push", ts / "render.mjs", f"{RENDER}:{tag}").stdout.strip().rsplit("@", 1)[1]
    for a in ("amd64", "arm64"):
        sh("trivy", "rootfs", "--format", "cyclonedx", "--output", OUT / f"fetch-{a}.cdx.json", py / "dist" / f"linux-{a}" / "fetch")
    shutil.copy(ts / "sbom" / "render.cdx.json", OUT / "render.cdx.json")
    (OUT / "digests.json").write_text(json.dumps(digests, indent=2) + "\n")
    with open(os.environ["GITHUB_OUTPUT"], "a") as f:
        f.writelines(f"{k}={v}\n" for k, v in digests.items())


def referrers(ref: str) -> list[dict]:
    answer = loads(sh("oras", "discover", "--format", "json", ref).stdout)
    if not isinstance(answer, dict):
        return []
    return answer.get("referrers") or answer.get("manifests") or []


def statements(p: subprocess.CompletedProcess) -> list[dict]:
    """The in-toto statements gh attestation verify --format json reports as verified."""
    found: list[dict] = []

    def walk(node: object) -> None:
        if isinstance(node, dict):
            if "predicateType" in node and "subject" in node:
                found.append(node)
                return
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(loads(p.stdout))
    return found


def certificates(p: subprocess.CompletedProcess) -> list[dict]:
    """The signing certificates' summaries in gh attestation verify --format json (source repository, workflow, commit)."""
    found: list[dict] = []

    def walk(node: object) -> None:
        if isinstance(node, dict):
            if "sourceRepositoryURI" in node:
                found.append(node)
                return
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(loads(p.stdout))
    return found


def cdx_packages(bom: dict) -> set[tuple[str, str]]:
    found: set[tuple[str, str]] = set()

    def walk(components: list) -> None:
        for c in components:
            if c.get("purl"):
                found.add((norm(c["name"]), c.get("version", "")))
            walk(c.get("components") or [])

    walk(bom.get("components") or [])
    return found


def trivy_findings(report: object) -> Findings:
    if not isinstance(report, dict):
        return set()
    return {(norm(v["PkgName"]), v["InstalledVersion"], v["VulnerabilityID"]) for r in report.get("Results") or [] for v in r.get("Vulnerabilities") or []}


def grype_findings(report: object) -> Findings:
    if not isinstance(report, dict):
        return set()
    return {(norm(m["artifact"]["name"]), m["artifact"]["version"], m["vulnerability"]["id"]) for m in report.get("matches") or []}


def osv_findings(report: object) -> Findings:
    if not isinstance(report, dict):
        return set()
    return {
        (norm(k["package"]["name"]), k["package"]["version"], min(g["ids"]))
        for r in report.get("results") or []
        for k in r.get("packages") or []
        for g in k.get("groups") or []
    }


def vulnerable(findings: Findings) -> set[str]:
    return {name for name, _, _ in findings}


def verify(ref: str, *extra: str) -> subprocess.CompletedProcess:
    return sh("gh", "attestation", "verify", f"oci://{ref}", "--format", "json", *extra, check=False)


def consume() -> None:
    d = json.loads((OUT / "digests.json").read_text())
    FUNCDCTL.chmod(0o755)
    login()
    sh("trivy", "image", "--download-db-only")
    sh("grype", "db", "update")
    checks: list[dict] = []
    timings: list[dict] = []
    measures: list[dict] = []

    def check(name: str, ok: bool, detail: str) -> None:
        checks.append({"name": name, "pass": bool(ok), "detail": redact(detail)})
        print(f"{'PASS' if ok else 'FAIL'} {name}: {redact(detail)}", flush=True)

    def measure(name: str, what: str, unit: str, value: float) -> None:
        measures.append({"name": name, "what": what, "unit": unit, "samples": [value]})

    def timing(name: str, what: str, step) -> None:
        samples = []
        for _ in range(SAMPLES):
            start = time.perf_counter()
            step()
            samples.append(round(time.perf_counter() - start, 3))
        timings.append({"name": name, "what": what, "samples_s": samples})

    subjects = {
        "fetch-amd64": f"{FETCH}@{d['fetch_amd64']}",
        "fetch-arm64": f"{FETCH}@{d['fetch_arm64']}",
        "fetch-index": f"{FETCH}@{d['fetch_index']}",
        "render": f"{RENDER}@{d['render']}",
    }
    bundles = {k: [r for r in referrers(ref) if "sigstore.bundle" in (r.get("artifactType") or "")] for k, ref in subjects.items()}
    kinds = sorted({r.get("artifactType", "") for rs in bundles.values() for r in rs})
    check(
        "push-to-registry stores each attestation as a referrer of its funcd manifest in GHCR",
        all(bundles[k] for k in subjects) and len(bundles["render"]) >= 2,
        f"bundles per subject {({k: len(v) for k, v in bundles.items()})}; artifact types {kinds}",
    )
    # A referrer's descriptor sizes its manifest; the Sigstore bundle, with the SBOM inside, is that manifest's layer.
    layers = {}
    for k, ref in subjects.items():
        repo = ref.split("@")[0]
        sizes = [sum(layer["size"] for layer in json.loads(sh("oras", "manifest", "fetch", f"{repo}@{r['digest']}").stdout)["layers"]) for r in bundles[k]]
        layers[k] = max(sizes, default=0)
    measure("attest-bundle-sbom", "the Sigstore bundle of fetch's SBOM attestation for linux/amd64", "KiB", round(layers["fetch-amd64"] / 1024, 1))
    measure("attest-bundle-provenance", "the Sigstore bundle of the provenance attestation of fetch's index", "KiB", round(layers["fetch-index"] / 1024, 1))
    resolved = {
        "fetch": json.loads(sh("oras", "manifest", "fetch", "--descriptor", f"{FETCH}:{d['tag']}").stdout)["digest"],
        "render": json.loads(sh("oras", "manifest", "fetch", "--descriptor", f"{RENDER}:{d['tag']}").stdout)["digest"],
    }
    check(
        "the attestations leave each function's tag on its digest",
        resolved == {"fetch": d["fetch_index"], "render": d["render"]},
        f"tags resolve to the pushed digests: {resolved == {'fetch': d['fetch_index'], 'render': d['render']}}",
    )
    pulled = OUT / "pull"
    shutil.rmtree(pulled, ignore_errors=True)
    p = sh(FUNCDCTL, "pull", f"{FETCH}:{d['tag']}", d["fetch_index"], pulled, "--platform", "linux/amd64", check=False)
    check(
        "funcdctl pulls the multi-arch function from GHCR by its index digest, with attestations attached",
        p.returncode == 0 and (pulled / "fetch.contract.yaml").is_file(),
        f"rc={p.returncode}; {len(list(pulled.iterdir())) if pulled.is_dir() else 0} entries" + (f"; {last_line(p.stderr)}" if p.returncode else ""),
    )

    for fn, want in (("fetch-amd64", PY_VULNERABLE), ("fetch-arm64", PY_VULNERABLE), ("render", TS_VULNERABLE)):
        made = cdx_packages(json.loads((OUT / f"{fn}.cdx.json").read_text()))
        got = {}
        for source, extra in (("registry", ["--bundle-from-oci"]), ("api", [])):
            p = verify(subjects[fn], "--repo", REPO, "--predicate-type", CDX_PREDICATE, *extra)
            sboms = [s["predicate"] for s in statements(p) if s.get("predicateType") == CDX_PREDICATE]
            got[source] = (p, sboms)
        ok = all(p.returncode == 0 and any(cdx_packages(b) == made for b in sboms) for p, sboms in got.values())
        check(
            f"gh attestation verify returns {fn}'s signed SBOM, from the registry and from GitHub's API",
            ok,
            "; ".join(
                f"{source}: rc={p.returncode}, {len(sboms)} SBOMs" + (f": {last_line(p.stderr)}" if p.returncode else "")
                for source, (p, sboms) in got.items()
            ),
        )
        if fn == "fetch-arm64":
            continue
        sbom_path = OUT / f"verified-{fn}.cdx.json"
        p, sboms = got["registry"]
        sbom_path.write_text(json.dumps(sboms[0] if sboms else {}))
        tf = trivy_findings(loads(sh("trivy", "sbom", "--skip-db-update", "--format", "json", sbom_path, check=False).stdout))
        gf = grype_findings(loads(sh("grype", f"sbom:{sbom_path}", "-o", "json", check=False).stdout))
        of = osv_findings(loads(sh("osv-scanner", "scan", "source", "--format", "json", "-L", sbom_path, check=False).stdout))
        check(
            f"trivy, grype and osv-scanner each find every vulnerable package from {fn}'s verified SBOM",
            all(want <= vulnerable(f) for f in (tf, gf, of)),
            f"trivy {sorted(vulnerable(tf))} ({len(tf)}), grype {sorted(vulnerable(gf))} ({len(gf)}), osv-scanner {sorted(vulnerable(of))} ({len(of)})",
        )

    sha = os.environ["GITHUB_SHA"]
    for name, ref in (("fetch's index", subjects["fetch-index"]), ("render", subjects["render"])):
        p = verify(ref, "--repo", REPO, "--bundle-from-oci")
        certs = certificates(p)
        named = any(
            c.get("sourceRepositoryURI", "").endswith(f"/{REPO}")
            and c.get("sourceRepositoryDigest") == sha
            and "exp-0015-attest.yml" in json.dumps(c)
            for c in certs
        )
        check(
            f"the provenance of {name} verifies and names this repository, workflow and commit",
            p.returncode == 0 and named,
            f"rc={p.returncode}, {len(certs)} certificates" + (f": {last_line(p.stderr)}" if p.returncode else ""),
        )
    # The same digest and bundle source as the passing checks above, so only the expected repository differs. The
    # text output, unlike --format json, says why it refuses.
    p = sh("gh", "attestation", "verify", f"oci://{subjects['fetch-amd64']}", "--repo", "pyvvo/funcd", "--predicate-type", CDX_PREDICATE, "--bundle-from-oci", check=False)
    why = [line.strip() for line in redact(p.stdout + p.stderr).splitlines() if re.search(r"repositor|SourceRepository|expected", line, re.I)]
    check("verification against another repository fails", p.returncode != 0, f"rc={p.returncode}: {(why or [last_line(p.stderr)])[0][:240]}")

    # Anyone with push rights can attach a plain SBOM that claims the manifest holds nothing.
    forged = {"bomFormat": "CycloneDX", "specVersion": "1.5", "serialNumber": "urn:uuid:00000000-0000-4000-8000-000000000000", "version": 1, "components": []}
    (OUT / "forged.cdx.json").write_text(json.dumps(forged))
    sh("oras", "attach", "--artifact-type", CDX, subjects["fetch-amd64"], f"forged.cdx.json:{CDX}", cwd=OUT)
    # produce attaches no plain SBOM, so every plain CycloneDX referrer here is a forged one.
    plain = [r for r in referrers(subjects["fetch-amd64"]) if r.get("artifactType") == CDX]
    pulled = OUT / "plain"
    shutil.rmtree(pulled, ignore_errors=True)
    sh("oras", "pull", "--output", pulled, f"{FETCH}@{plain[0]['digest']}")
    tf = trivy_findings(loads(sh("trivy", "sbom", "--skip-db-update", "--format", "json", next(pulled.glob("*.json")), check=False).stdout))
    check(
        "a forged plain SBOM referrer makes a scan that trusts it report no advisory",
        bool(plain) and not tf,
        f"{len(plain)} plain CycloneDX referrers; trivy reports {len(tf)} advisories from one",
    )
    p = verify(subjects["fetch-amd64"], "--repo", REPO, "--predicate-type", CDX_PREDICATE, "--bundle-from-oci")
    sboms = [s["predicate"] for s in statements(p) if s.get("predicateType") == CDX_PREDICATE]
    check(
        "verification ignores the forged SBOM and returns only the signed one",
        p.returncode == 0 and bool(sboms) and all(cdx_packages(b) for b in sboms),
        f"rc={p.returncode}, {len(sboms)} SBOMs, packages per SBOM {[len(cdx_packages(b)) for b in sboms]}",
    )

    amd = subjects["fetch-amd64"]
    timing(
        "attest-verify-registry",
        "gh attestation verify of one platform manifest's SBOM attestation, bundle from GHCR, on a GitHub-hosted runner",
        lambda: sh("gh", "attestation", "verify", f"oci://{amd}", "--repo", REPO, "--predicate-type", CDX_PREDICATE, "--bundle-from-oci", "--format", "json"),
    )
    timing(
        "attest-verify-api",
        "the same verification with the bundle from GitHub's attestation API, on a GitHub-hosted runner",
        lambda: sh("gh", "attestation", "verify", f"oci://{amd}", "--repo", REPO, "--predicate-type", CDX_PREDICATE, "--format", "json"),
    )
    timing(
        "attest-scan",
        "trivy sbom on the SBOM extracted from the verified attestation, on a GitHub-hosted runner",
        lambda: sh("trivy", "sbom", "--skip-db-update", "--format", "json", OUT / "verified-fetch-amd64.cdx.json"),
    )
    env = {
        "runner": f"{os.environ.get('ImageOS', '')} {os.environ.get('ImageVersion', '')}".strip() or platform.platform(),
        "arch": platform.machine(),
        "gh": sh("gh", "--version").stdout.split()[2],
        "run": os.environ.get("GITHUB_RUN_ID", ""),
        "commit": os.environ.get("GITHUB_SHA", "")[:8],
    }
    (OUT / "results-attest.json").write_text(json.dumps({"env": env, "timings": timings, "measures": measures, "checks": checks}, indent=2) + "\n")


if __name__ == "__main__":
    {"produce": produce, "consume": consume}[sys.argv[1]]()
