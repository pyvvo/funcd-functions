# todo-shared — the App that todo requires

A shared App of a namespace, which the [todo App](../todo) requires at `^1.0.0` when it is installed with
`values/shared.yaml`. It is the smallest App that shows a
[requirement](https://github.com/pyvvo/funcd/blob/main/docs/adr/0219-app-requirements.md): a requirement names an App
and a version range, not its objects, so `todo-shared` holds a version and no part. funcd's `app-todo` lane deploys it
from this directory while the todo App waits for it:

```bash
funcdctl app deploy app
```
