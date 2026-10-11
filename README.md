# funcd-functions

Example functions and Apps that [funcd](https://github.com/pyvvo/funcd) deploys in its Lima lanes, the end-to-end
tests that run funcd on containerd. Each example App holds TypeScript and Python functions, Workflows, ConfigMaps,
Secret declarations, catalogs and the other kinds an App can declare. Each one is configured to catch a scenario that
only a real runtime shows, such as a cold start, a daemon restart, data on disk or the real edge.

## Apps

- [`apps/todo`](apps/todo): the to-do App of funcd's App design, deployed by funcd's `app-todo` lane.

## How funcd uses this repository

funcd pins this repository as a Go module in its `go.mod`, as it pins
[funcd-typescript](https://github.com/pyvvo/funcd-typescript) and [funcd-python](https://github.com/pyvvo/funcd-python)
(funcd's ADR-0141). A lane names this module in funcd's `scripts/lanes.yaml`, and funcd reads its files from the Go
module cache, so a change reaches funcd only through a release and a `go get` in funcd:

1. Change this repository and release it with a tag `vX.Y.Z`.
2. In funcd, run `go get github.com/pyvvo/funcd-functions@vX.Y.Z` and open a pull request.

To test an unreleased change, clone this repository next to funcd and add a local `go.work` in funcd
(`go work init . ../funcd-functions`). Git ignores it; never commit it.

## Develop

```bash
nix develop -c just ci
```

It type-checks and rebuilds every App's TypeScript functions, failing when a committed bundle differs from its
source, and checks every App's Python functions with ruff and mypy. The dev shell also installs the git hooks. They
format and lint staged files, check the commit message, and run the checks before a push.

## License

Apache License 2.0. See [LICENSE](LICENSE).
