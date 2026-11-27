#!/usr/bin/env bash
# The frp-bunny demo's own setup, after env/up.sh. As an admin would, it registers the InfraStack and Tunnel Addons of
# pyvvo/funcd-addons, then writes the two Secrets that the App declares; the Bunny API key goes from its file through a
# pipe, never printed, on a command line or in an environment. In the workspace, it writes values/demo.yaml, names the pull zone in
# egress.yaml and installs the page's dependencies. The demo's values bypass the stack's approval. It lists Bunny's pull zones first, so that teardown.sh deletes only
# the Magic Containers zone that this run adds. Needs DEMO_BUNNY_KEY_FILE, a file that holds the account's API key, and
# DEMO_BUNNY_REGISTRY, the Id of the account's public Docker Hub registry in Magic Containers.
set -euo pipefail
: "${DEMO_BUNNY_KEY_FILE:?a file that holds the Bunny API key}" "${DEMO_BUNNY_REGISTRY:?the Id of its Magic Containers registry}"
name=funcd-tunnel-demo
base=$(dirname "$DEMO_WORKSPACE")
app=$DEMO_WORKSPACE/apps/frp-bunny
addons=$HOME/.cache/funcd-functions/funcd-addons
export PATH=$base/bin:$PATH FUNCD_SERVER=http://127.0.0.1:8080

python3 docs/demo/frp-bunny/env/bunny.py zones > "$base/zones-before"
FUNCD_TOKEN=funcd-demo-admin funcdctl apply -f "$addons/infrastack/app/addon.yaml"
FUNCD_TOKEN=funcd-demo-admin funcdctl apply -f "$addons/tunnel/app/addon.yaml"
export FUNCD_TOKEN=funcd-demo-developer
python3 -c '
import base64, os
key = base64.b64encode(open(os.environ["DEMO_BUNNY_KEY_FILE"], "rb").read().strip()).decode()
print("apiVersion: funcd.io/v1alpha1\nkind: Secret\nmetadata:\n  name: bunny-api\n  namespace: default\n"
      "  resourceGroup: default\nspec:\n  data:\n    BUNNYNET_API_KEY: " + key)' | funcdctl apply -f -
yq 'select(.metadata.name == "frp-bunny-outputs")' "$app/secrets.yaml" | funcdctl apply -f -
perl -pi -e "s/frp-bunny-example/$name/" "$app/egress.yaml"
sed -e "s#^registry: .*#registry: oci-layout://$base/registry#" -e "s#^name: .*#name: $name#" \
  -e "s#^imageRegistry: .*#imageRegistry: $DEMO_BUNNY_REGISTRY#" "$app/values/bunny.yaml" > "$app/values/demo.yaml"
echo "bypass: true" >> "$app/values/demo.yaml"
(cd "$app/web" && npm ci --no-audit --no-fund >/dev/null)
