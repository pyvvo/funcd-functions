# funcd-functions — agent working agreement

This repo holds the example Apps and functions that funcd deploys in its Lima lanes. The platform
itself (Go daemon, API, CLI, e2e tests, lanes, ADRs) lives in [pyvvo/funcd](https://github.com/pyvvo/funcd),
and the runtime shims in [pyvvo/funcd-typescript](https://github.com/pyvvo/funcd-typescript) and
[pyvvo/funcd-python](https://github.com/pyvvo/funcd-python).

## ⛔ Nothing about the dev machine ever enters the repo

No absolute OS paths, no local username, no personal email: not in files, commit messages,
examples or grep patterns. Paths are repo-root-relative. The only identity is `green-0-rabbit`,
`github.com/pyvvo` and "The funcd Authors".

## Decisions live in funcd

Design decisions are ADRs in funcd ([`docs/adr/`](https://github.com/pyvvo/funcd/tree/main/docs/adr)). This repo implements them and never
decides on its own. An App here follows funcd's App design, and the lane that deploys it is defined in funcd.

## Layout

| Path | What |
|---|---|
| `apps/<app>/` | One example App: its template, values, grants and site. Its README lists its parts |
| `apps/<app>/functions/ts` | Its TypeScript functions, one npm project. `vite build` bundles each `src/<name>/main.ts` into `<name>.mjs` beside its `<name>.contract.yaml`, and the bundles are committed |
| `apps/<app>/functions/py` | Its Python functions, one uv project. Each is `src/<name>/main.py` with its `<name>.contract.yaml`, listed in `[tool.funcd-bundle.functions]` |
| `go.mod` | This repo is also a Go module. funcd pins it by git tag |

## Toolchain

`flake.nix` pins node 22, Python 3.14, uv, ruff, Go, just and lefthook, and turns off uv's own Python
downloads. Run everything through the dev shell:

```bash
nix develop -c just ci
```

For many short commands (agents, scripts), use `scripts/agent/d <cmd>` instead: the same pinned environment
from a cached `nix print-dev-env` (regenerated when `flake.nix` or `flake.lock` change), about 0.02 s per call
instead of about 2 s. It caches this repo's flake; funcd and the language repos ship the same script for their own.

The recipes loop over every `apps/*/functions/ts` and `apps/*/functions/py`, so a new App needs no CI change.

The dev shell also installs the lefthook git hooks. pre-commit formats and lints staged files
with ruff and gofmt, commit-msg enforces Conventional Commits, and pre-push runs `just check`.
CI runs the same checks, so never bypass a hook with `--no-verify`.

## Rules

- **Built files are committed.** After changing a TypeScript function, run `just build` and commit
  the bundles. CI fails when a build changes a committed file.
- **Lockfiles are exact.** CI installs with `npm ci` and `uv sync --locked`, so a `package.json`
  change needs `npm install` and a `pyproject.toml` change needs `uv lock`.
- **ruff owns Python formatting**, from the flake so every project uses one version. Run `just fmt`
  instead of formatting by hand. CI runs `ruff format --check`.
- **Conventional Commits.** A PR title must be a Conventional Commit, and CI checks it. PRs are
  squash-merged through a merge queue, which uses the PR title as the commit message on `main`, so
  nobody can edit the message at merge time. The queue checks that exact message again before it
  lands. `main` takes no direct pushes, and the ruleset has no bypass, not even for admins.
- **Releases come from release-please**, as in funcd-typescript and funcd-python: merging its release PR
  tags `vX.Y.Z` on `main` (no component prefix) and creates the GitHub release, and funcd takes it with
  `go get github.com/pyvvo/funcd-functions@vX.Y.Z`. From v2.0.0 on, Go requires
  a `/v2` module path, so stay below v2.
- YAML is block style, imports sit at the top of the module, and comments explain why, not what.
