#!/usr/bin/env bash
# The frp-bunny demo's Environment teardown, after its own teardown.sh: it stops env/api.py, deletes the Lima VM,
# releases funcd's lane lock and removes the workspace, only when env/up.sh made them in this run, whose state folder it
# recorded. When teardown.sh found Bunny's side still there, the VM stays: it holds the stack's OpenTofu state.
set -uo pipefail
base=$(dirname "$DEMO_WORKSPACE")
if [ "$(cat "$base/owner" 2>/dev/null)" != "$DEMO_STATE" ]; then
  echo "$base is not this run's: nothing to remove"
  exit 0
fi
[ ! -f "$base/api.pid" ] || kill "$(cat "$base/api.pid")" 2>/dev/null
if [ -f "$base/keep-vm" ]; then
  echo "the VM $(cat "$base/vm") stays, with the stack's state: destroy Bunny's side there, then run this again" >&2
  exit 1
fi
if [ -f "$base/vm" ]; then
  d=$HOME/.cache/funcd-functions/funcd/scripts/agent/d
  "$d" limactl stop -f "$(cat "$base/vm")" >/dev/null 2>&1
  "$d" limactl delete -f "$(cat "$base/vm")" >/dev/null 2>&1
fi
[ ! -f "$base/lock-holder" ] || kill "$(cat "$base/lock-holder")" 2>/dev/null
git worktree remove --force "$DEMO_WORKSPACE" 2>/dev/null
rm -rf "$base"
