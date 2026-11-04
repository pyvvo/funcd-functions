"""Install the DuckDB extensions lake_sql needs into its bundle (the post-install of funcd-bundle). It runs in the build
container with the bundle on PYTHONPATH, so the vendored duckdb downloads the extensions built for the target platform.
funcd's app-todo lane checks each file against funcd's own pins (images/runtime/duckdb/duckdb.sha256) after the build,
as its duckdb lane does."""

import os

import duckdb

ext_dir = os.path.join(os.environ["FUNCD_BUNDLE_DIR"], "duckdb-ext")
os.makedirs(ext_dir, exist_ok=True)
con = duckdb.connect()
con.execute(f"SET extension_directories=['{ext_dir}']")
for ext in ("quack", "httpfs"):
    con.execute(f"INSTALL {ext}")
