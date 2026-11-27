# funcd-functions

Example functions and Apps that [funcd](https://github.com/pyvvo/funcd) deploys in its Lima lanes, the end-to-end
tests that run funcd on containerd. An example App holds the kinds that its scenarios need, such as TypeScript and
Python functions, Workflows, ConfigMaps, Secret declarations and lakes. Each App is configured to catch a scenario
that only a real runtime shows, such as a cold start, a daemon restart, data on disk or the real edge.

## Apps

- [`apps/todo`](apps/todo): the to-do App of funcd's App design, deployed by funcd's `app-todo` lane.
- [`apps/todo-shared`](apps/todo-shared): the App that the to-do App requires, deployed by the same lane.
- [`apps/site-config`](apps/site-config): one Site build served to two environments, each with its own generated
  `config.json`, at a host and at a path, deployed by funcd's `app-todo` lane.

## How funcd uses this repository

funcd [pins this repository](https://github.com/pyvvo/funcd/blob/main/docs/adr/0141-repo-split-pyvvo-pinned-language-modules.md)
as a Go module in its `go.mod`, as it pins [funcd-typescript](https://github.com/pyvvo/funcd-typescript) and
[funcd-python](https://github.com/pyvvo/funcd-python). A lane names this module in funcd's `scripts/lanes.yaml`, and
funcd reads its files from the Go module cache, so a change reaches funcd only through a release and a `go get` in
funcd:

1. Change this repository and merge its release-please PR, which tags `vX.Y.Z`.
2. In funcd, run `go get github.com/pyvvo/funcd-functions@vX.Y.Z` and open a pull request.

To test an unreleased change, clone this repository next to funcd and add a local `go.work` in funcd
(`go work init . ../funcd-functions`). Git ignores it; never commit it.

## Develop

```bash
nix develop -c just ci
```

It type-checks and rebuilds every App's TypeScript functions, and fails when a committed bundle differs from its
source. It type-checks and builds every App's Vite page, checks every App's Python functions with ruff and mypy, and
checks each README against its [template](scripts/readme-template.yaml). The dev shell also installs the git hooks:
they format and lint staged files, check staged READMEs and the commit message, and run the checks before a push.

## License

Apache License 2.0. See [LICENSE](LICENSE).
