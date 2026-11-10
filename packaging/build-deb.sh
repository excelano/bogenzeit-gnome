#!/bin/bash
# Author: David M. Anderson
# Built with AI assistance (Claude, Anthropic)

set -euo pipefail
umask 022

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTROL="$ROOT/packaging/control"
PKG=$(awk '/^Package:/{print $2}' "$CONTROL")
VER=$(awk '/^Version:/{print $2}' "$CONTROL")
ARCH=$(awk '/^Architecture:/{print $2}' "$CONTROL")
[ -n "$PKG" ] && [ -n "$VER" ] && [ -n "$ARCH" ] || { echo "no Package:, Version: or Architecture: in $CONTROL" >&2; exit 1; }
UUID=$(sed -n 's/.*"uuid": *"\([^"]*\)".*/\1/p' "$ROOT/metadata.json")

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
chmod 0755 "$STAGE"

EXT="$STAGE/usr/share/gnome-shell/extensions/$UUID"
mkdir -p "$STAGE/DEBIAN" "$EXT" "$STAGE/usr/share/glib-2.0/schemas" "$STAGE/usr/share/doc/$PKG"
cp "$CONTROL" "$STAGE/DEBIAN/control"

install -m 0644 "$ROOT/metadata.json" "$ROOT/extension.js" "$ROOT/stylesheet.css" "$EXT/"
install -m 0644 "$ROOT"/schemas/*.gschema.xml "$STAGE/usr/share/glib-2.0/schemas/"
install -m 0644 "$ROOT/LICENSE" "$STAGE/usr/share/doc/$PKG/copyright"
install -m 0644 "$ROOT/README.md" "$STAGE/usr/share/doc/$PKG/README.md"

OUT="/tmp/${PKG}_${VER}_${ARCH}.deb"
dpkg-deb --build --root-owner-group "$STAGE" "$OUT" >/dev/null
echo "$OUT"
