#!/usr/bin/env bash
# The frp-bunny demo's own teardown, before env/down.sh deletes the VM and with it the stack's OpenTofu state. When the
# journey stopped before its end, it deletes the App and approves each destroy run of the stack by its preview's
# digest, so that OpenTofu removes Bunny's side, the pull zone Magic Containers added included. When Bunny still runs
# the container app funcd-tunnel-demo, the destroy did not finish: it keeps the VM for env/down.sh and fails.
set -uo pipefail
base=$(dirname "$DEMO_WORKSPACE")
[ "$(cat "$base/owner" 2>/dev/null)" = "$DEMO_STATE" ] && [ -f "$base/apps-before" ] || exit 0
export PATH=$base/bin:$PATH FUNCD_SERVER=http://127.0.0.1:8080 FUNCD_TOKEN=funcd-demo-developer
bunny=docs/demo/frp-bunny/env/bunny.py

# answer <path>: the HTTP status of funcd's answer at <path> in the namespace default, 000 when funcd does not answer
answer() {
  curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $FUNCD_TOKEN" \
    "$FUNCD_SERVER/apis/funcd.io/v1alpha1/namespaces/default/$1"
}

[ "$(answer apps/frp-bunny)" != 200 ] || funcdctl app delete frp-bunny --no-wait
for _ in $(seq 450); do
  [ "$(answer infrastacks/frp-bunny-stack)" != 404 ] || break
  funcdctl job runs frp-bunny-stack --phase AwaitingApproval -o json 2>/dev/null | python3 -c '
import json, sys
for run in json.load(sys.stdin) or []:
    preview = run["status"]["preview"]
    if preview["document"].get("action") == "destroy":
        print(run["metadata"]["name"], preview["digest"])' | while read -r run digest; do
    funcdctl job approve "$run" --digest "$digest"
  done
  sleep 2
done

python3 "$bunny" apps > "$base/apps-after" || exit 1
if grep -qx funcd-tunnel-demo "$base/apps-after"; then
  echo "Bunny still runs the container app funcd-tunnel-demo: the stack's destroy did not finish" >&2
  touch "$base/keep-vm"
  exit 1
fi
