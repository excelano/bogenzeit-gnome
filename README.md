# Bogenzeit for GNOME

A GNOME Shell extension that shows the time as Bogenzeit beside the clock in the top bar. [Bogenzeit](https://github.com/excelano/bogenzeit) reads the time as a position on the Sun's arc, counted in spans from solar noon (☉) by day and solar midnight (○) by night, so `59 ☉` means 59 spans before noon and `☉ 3` means three after it.

The reading comes from the `bz` command, the reference engine, so the bar shows the same number `bz` prints at a terminal. The extension asks `bz` again at each step of the reading, which is roughly every three minutes in spans and every 100 seconds in kiloseconds.

## Install

Add the [Excelano apt repository](https://excelano.com/apt/):

```sh
curl -fsSL https://excelano.com/apt/setup.sh | sudo sh
```

Then install it, which brings `bz` along, so `apt upgrade` keeps both current:

```sh
sudo apt install gnome-shell-extension-bogenzeit
```

The reading is for `bz`'s default place, so set one if you have not:

```sh
bz place home 29.76 -95.37
```

GNOME on Wayland loads a newly installed extension only at login, so log out and back in, then turn it on:

```sh
gnome-extensions enable bogenzeit@excelano.com
```

## Develop

From a clone, `./dev.sh nested` runs the extension in a nested GNOME Shell window with a throwaway settings directory and a copy of your `bz` places, so trying a change touches nothing in your session. `./dev.sh install` installs the working copy for your user, which takes effect at the next login.

## Use

The bar shows the span form, such as `☉ 69`. Click the reading for a menu with a Kiloseconds switch, which shows the offset from the anchor at one decimal instead, such as `☉ 13.5 ks`. When `bz` cannot give a reading, the bar shows `bz ?` and the menu shows what `bz` said, most often that no place is set.

`bz place` changes the place, and the bar follows within a minute. On a day with no sunrise or sunset, the bar shows the kiloseconds reading in either mode, since spans are undefined on such a day.

## License

MIT. See [LICENSE](LICENSE).
