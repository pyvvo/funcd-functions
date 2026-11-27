#!/usr/bin/env bash
# The frp-bunny demo's Environment setup, which the demo engine runs from the project's root. It makes the workspace, a
# git worktree of the current commit, and boots funcd at funcd_ref on containerd in a Lima VM with funcd's lane harness,
# as pyvvo/funcd-addons runs its lanes: the lane frp-bunny-demo of env/lanes.yaml. The host gets that release's funcdctl
# and the InfraStack add-on's plugin from pyvvo/funcd-addons at addons_ref. The VM mounts the folder above the workspace
# at the same path, so the registry in it has one name on both sides. funcd's lane lock is held while the VM runs, since
# every lane VM forwards 127.0.0.1:8080 and 8081. Needs nix, and colima for funcd's runtime images.
set -euo pipefail
: "${DEMO_WORKSPACE:?run by the demo engine}" "${DEMO_STATE:?run by the demo engine}"
funcd_ref=v0.51.0
addons_ref=v0.9.0
lane=frp-bunny-demo
root=$PWD
base=$(dirname "$DEMO_WORKSPACE")
cache=$HOME/.cache/funcd-functions

# checkout <repo> <ref>: a clone of pyvvo/<repo> in the cache, under $HOME since colima shares only $HOME, at ref
checkout() {
  local src=$cache/$1
  [ -d "$src/.git" ] || git clone --quiet "https://github.com/pyvvo/$1.git" "$src"
  git -C "$src" fetch --quiet --tags origin
  # funcd's image build marks its placeholder image tarballs skip-worktree, which no checkout replaces
  git -C "$src" ls-files -v | sed -n 's/^S //p' | git -C "$src" update-index --no-skip-worktree --stdin
  git -C "$src" checkout --quiet --force --detach "$2"
}

if [ -e "$base" ]; then
  echo "$base is left from another run: run demo.ts down, or remove it" >&2
  exit 1
fi
mkdir -p "$base/bin" "$base/registry"
echo "$DEMO_STATE" > "$base/owner"
git worktree add --quiet --detach "$DEMO_WORKSPACE" HEAD
checkout funcd "$funcd_ref"
checkout funcd-addons "$addons_ref"
install -m 0755 "$cache/funcd-addons/infrastack/plugin/funcdctl-infra" "$base/bin/funcdctl-infra"

nohup sleep 86400 >/dev/null 2>&1 &
echo $! > "$base/lock-holder"
echo "funcd-bench-$lane" > "$base/vm"
cd "$cache/funcd"
scripts/agent/d bash -euo pipefail -c '
  holder=$1 base=$2 root=$3 lane=$4
  scripts/lane-lock.sh "$holder"
  deps=$HOME/.cache/funcd-lima
  arch=$(go env GOARCH)
  just ARCH="$arch" build-runtime-images
  for pkg in cmd/funcd cmd/funcdctl e2e/cniadd e2e/laneregistry; do
    CGO_ENABLED=0 GOOS=linux GOARCH="$arch" go build -o "$deps/$(basename "$pkg")" "./$pkg"
  done
  go build -o "$base/bin/funcdctl" ./cmd/funcdctl
  suite=$(FUNCD_LANES="$root/docs/demo/frp-bunny/env/lanes.yaml" FUNCD_LANES_ROOT="$root" \
    python3 scripts/lane.py "$lane" "$deps")
  limactl delete -f "funcd-bench-$lane" >/dev/null 2>&1 || true
  limactl start --name "funcd-bench-$lane" --tty=false scripts/lima-lane.yaml \
    --set ".mounts += [{\"location\": \"$(cd "$base" && pwd -P)\", \"mountPoint\": \"$base\"}]"
  venom run --output-dir "$base" "$suite" >/dev/null
' _ "$(cat "$base/lock-holder")" "$base" "$root" "$lane"
