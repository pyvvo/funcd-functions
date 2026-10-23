# volumes

Two Functions that own volumes (funcd ADR-0262). funcd's `volumes` lane deploys the App on containerd with a 64 MiB
volume image and checks what each volume type keeps.

| Path | What |
|---|---|
| `app/app.yaml` | The template: the `files` image, and `timeout` so a values file can make a new revision |
| `app/resources/files.yaml` | `volumes-files`, with a `local` volume `data` (`size: 1MiB`) and an `emptyDir` `scratch` (`sizeBytes: 1048576`), and `volumes-peer`, with its own `local` volume `data` (`size: 1Mi`), both from the `files` image (funcd ADR-0266 takes both size forms) |
| `functions/ts/src/files/main.ts` | The `files` function: it writes, reads and lists files in a volume, fills one past its size, lists the directory above it, reports its pid and crashes on request |
| `app/resources/routes.yaml` | The Routes `/files` and `/peer`, which the lane calls |
| `values/e2e.yaml` | The lane's registry |
| `values/redeploy.yaml` | A new `timeout`, so a deploy makes a new revision |
| `fixtures/too-big.yaml` | A Function whose 128 MiB volume does not fit the image: apply refuses it with `VolumeCapacity` |
| `fixtures/two-replicas.yaml` | Two replicas with a `local` volume: apply refuses it |
| `backup/backup.yaml`, `backup/backup-b1.yaml` | A schedule that backs up `volumes-files`' `data` to the S3 server in the lane's VM, sealed, and the Backup the lane takes from it; the Secrets and the identity are the todo App's (`apps/todo/dr`) |
| `backup/restore-in-place.yaml` | The Restore of that Backup into `data` in place, after the lane lost it: the Function's workers stop during the load (funcd ADR-0262 Decisions 11 and 12) |
| `backup/funcdconfig.yaml` | The daemon config the lane restarts funcd with after the loss: the todo App's test admin token instead of the developer token, since only an admin restores in place |
| `funcdconfig.yaml` | The lane's daemon config, with `volumes.capacityBytes` |

## What each volume keeps

The function reads each volume's path from `FUNCD_VOLUME_<NAME>`: `/var/funcd/volumes/data` and
`/var/funcd/volumes/scratch` in a container.

| | `data` (`local`) | `scratch` (`emptyDir`) |
|---|---|---|
| A crash and a new worker | kept | empty again |
| A redeploy to a new revision | kept | empty again |
| A write past 1 MiB | fails (`EDQUOT`) | fails (`EDQUOT`) |
| Deleting the App | kept (`retain`), removed with `funcdctl volume delete` | removed |
| Lost while funcd was down | empty, with `DataMissing`; a Restore in place brings the Backup back | — |

`peek` lists `/var/funcd/volumes`: `volumes-files` sees `data` and `scratch` only, never `volumes-peer`'s `data`.

## Build

```bash
nix develop -c just build
```
