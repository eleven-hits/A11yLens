# Platform launchers

The audit engine, rules and reporters are shared. Only installation and process launching differ per operating system, so each OS gets its own folder instead of scattering conditional shell code through the project.

| Folder | Contents |
| --- | --- |
| `windows/` | `install.ps1`, `a11ylens.cmd`, `run.ps1`, `uninstall.ps1` |
| `macos/` | `install.sh`, `a11ylens` POSIX launcher, `uninstall.sh` |
| `linux/` | `install.sh`, `a11ylens` POSIX launcher, `uninstall.sh` |

## Windows

```powershell
powershell -ExecutionPolicy Bypass -File .\platforms\windows\install.ps1 -AddToPath
a11ylens .\dist --render
```

- `install.ps1` verifies Node 20.10+, runs `npm install`, and with `-AddToPath` appends this folder to the **user** PATH (no administrator rights).
- `a11ylens.cmd` is the command shim. It resolves the repository root relative to itself, so it keeps working after moving the project.
- `run.ps1` is for PowerShell users who prefer `.\run.ps1 .\dist`.
- `uninstall.ps1` removes the PATH entry only. Delete the folder manually if you want to remove the tool.

## macOS

```sh
./platforms/macos/install.sh
a11ylens ./dist --render
```

The installer symlinks the POSIX launcher into `~/.local/bin` (or `$PREFIX`). The launcher locates the repo through its own path, then runs `bin/a11ylens.js`.

For VoiceOver, test in Safari. A11yLens still drives Chrome, Chromium, Edge or Brave for the rendered scan; install one of them if the Mac only has Safari.

## Linux

```sh
./platforms/linux/install.sh
a11ylens ./dist --render
```

The installer checks Node, installs dependencies, warns when no Chromium browser is present and symlinks the launcher into `~/.local/bin`. On headless servers, Chrome may need `--no-sandbox`; pass a wrapper script through `--browser` if your environment requires it.

## Keeping the executable bit

The `a11ylens` launchers and `*.sh` installers must be executable on macOS and Linux. If the files lose the bit after copying, run:

```sh
chmod +x bin/a11ylens.js platforms/macos/a11ylens platforms/linux/a11ylens platforms/macos/*.sh platforms/linux/*.sh
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `A11YLENS_BROWSER` | Browser executable used by `--render` |
| `CHROME_PATH` | Fallback browser executable |
| `NO_COLOR` | Disable ANSI colour |
| `A11YLENS_DEBUG` | Print stack traces for unexpected errors |
| `A11Y_TEST_RENDER` | Set to `1` to enable the Chrome integration test |
