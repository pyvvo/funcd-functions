# Run every recipe through the pinned dev shell: `nix develop -c just <recipe>`.
# Each recipe covers every apps/*/functions/ts and apps/*/functions/py, so a new App needs no change here.

python := "3.14"

default:
    @just --list

# install each App's TypeScript deps from package-lock.json and its Python deps from uv.lock
install:
    #!/usr/bin/env bash
    set -euo pipefail
    shopt -s nullglob
    for d in apps/*/functions/ts; do
        echo "== npm ci $d"
        (cd "$d" && npm ci --no-audit --no-fund)
        # the functions run on nodejs22; a node from elsewhere (a node_modules/.bin/node) would run the scripts
        v=$(cd "$d" && npm exec -c 'node --version')
        [[ $v == v22.* ]] || { echo "npm runs $d's scripts on node $v, not node 22"; exit 1; }
    done
    for d in apps/*/functions/py; do
        echo "== uv sync $d"
        (cd "$d" && uv sync --locked --python {{python}})
    done

# rebuild every App's committed TypeScript bundles (*.mjs)
build:
    #!/usr/bin/env bash
    set -euo pipefail
    shopt -s nullglob
    for d in apps/*/functions/ts; do
        echo "== build $d"
        (cd "$d" && npm run build)
    done

# format and apply ruff's safe lint fixes to every App's Python functions
fmt:
    #!/usr/bin/env bash
    set -euo pipefail
    shopt -s nullglob
    for d in apps/*/functions/py; do
        (cd "$d" && ruff format . && ruff check --fix .)
    done

# tsc on every App's TypeScript functions; ruff (the flake's single version) and mypy on its Python functions;
# --locked fails on a stale uv.lock
check:
    #!/usr/bin/env bash
    set -euo pipefail
    shopt -s nullglob
    for d in apps/*/functions/ts; do
        echo "== tsc $d"
        (cd "$d" && npm run typecheck)
    done
    for d in apps/*/functions/py; do
        echo "== ruff $d"
        (cd "$d" && ruff format --check . && ruff check .)
        echo "== mypy $d"
        (cd "$d" && uv run --locked --python {{python}} mypy)
    done

# the Go module funcd pins
go-check:
    go vet ./...
    go build ./...
    go test ./...

# the CI gate: fails when a build changed a committed file
ci: install check build go-check
    @if [ -n "$(git status --porcelain)" ]; then git status --short; echo "build outputs are stale: run 'just build' and commit the result"; exit 1; fi
