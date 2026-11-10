#!/bin/bash
# Author: David M. Anderson
# Built with AI assistance (Claude, Anthropic)
#
# dev.sh install   pack the extension and install it for this user
# dev.sh nested    run it in a nested GNOME Shell with a throwaway config and
#                  data directory under build/, holding a copy of the bz places

set -euo pipefail
cd "$(dirname "$0")"
uuid=bogenzeit@excelano.com

pack() {
    mkdir -p build
    gnome-extensions pack --force --out-dir build --extra-source=LICENSE .
}

case "${1:-}" in
    install)
        pack
        gnome-extensions install --force "build/$uuid.shell-extension.zip"
        echo "Installed. Log out and back in, then: gnome-extensions enable $uuid"
        ;;
    nested)
        pack
        root=$PWD/build/nested
        rm -rf "$root"
        bz_config=${XDG_CONFIG_HOME:-$HOME/.config}/bz/config
        export XDG_CONFIG_HOME=$root/config XDG_DATA_HOME=$root/data
        mkdir -p "$XDG_CONFIG_HOME/bz" "$XDG_DATA_HOME"
        [[ -f $bz_config ]] && cp "$bz_config" "$XDG_CONFIG_HOME/bz/config"
        gnome-extensions install "build/$uuid.shell-extension.zip"
        MUTTER_DEBUG_DUMMY_MODE_SPECS=1600x900 dbus-run-session -- bash -c "
            gsettings set org.gnome.shell enabled-extensions \"['$uuid']\"
            exec gnome-shell --nested --wayland"
        ;;
    *)
        echo "usage: dev.sh install | nested" >&2
        exit 2
        ;;
esac
