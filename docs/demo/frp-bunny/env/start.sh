#!/usr/bin/env bash
# The frp-bunny demo's Environment start: env/api.py on the site api's port, which answers the journey's waits with
# what funcd's API answers, read with the demo's developer token. env/down.sh stops it.
set -euo pipefail
base=$(dirname "$DEMO_WORKSPACE")
FUNCD_SERVER=http://127.0.0.1:8080 FUNCD_TOKEN=funcd-demo-developer \
  nohup python3 docs/demo/frp-bunny/env/api.py "${DEMO_SITE_API##*:}" >"$base/api.log" 2>&1 &
echo $! > "$base/api.pid"
curl -sf --retry-connrefused --retry 20 --retry-delay 1 -o /dev/null "$DEMO_SITE_API/apis/funcd.io/v1alpha1/namespaces/default/apps"
