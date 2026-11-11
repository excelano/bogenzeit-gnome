# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately, using the **Report a vulnerability** button on the Security tab of this repository. If that button is not there, or you would rather not go through GitHub, email david.anderson@excelano.com instead. I aim to respond within seven days.

Please do not open public issues for security problems.

## Supported versions

The latest release receives security fixes. Older versions are not supported. A fix ships in a new release; update the way you installed.

## What Bogenzeit for GNOME can access

The extension runs inside GNOME Shell with the session's privileges. Its only outside contact is the `bz` command, found on the session's `PATH` and run with fixed arguments (`--json`, then `--form` and `--precision`), whose output it parses and shows in the top bar; a `bz` earlier on the `PATH` than the packaged one is what the extension runs. It makes no network connection and reads no file itself. `bz` reads its own config file for the default place, as its own policy describes.

## What Bogenzeit for GNOME stores

One setting, whether the bar shows kiloseconds, in the GNOME settings database under `org.gnome.shell.extensions.bogenzeit`. Nothing else is written.
