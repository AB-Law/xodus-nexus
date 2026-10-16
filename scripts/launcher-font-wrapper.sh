#!/bin/sh
app_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd) || exit 1
binary="$app_root/xodus-nexus.bin"
# Native helper modes must retain their normal behavior, including Crashpad.
if [ "${ELECTRON_RUN_AS_NODE-}" = 1 ]; then exec "$binary" "$@"; fi
original_set="${FONTCONFIG_FILE+x}"
original="${FONTCONFIG_FILE-}"
config=$(ELECTRON_RUN_AS_NODE=1 "$binary" "$app_root/resources/font-bootstrap/bootstrap.mjs")
if [ -n "$config" ]; then
  export XODUS_NEXUS_FONTCONFIG="$config"
  export XODUS_NEXUS_FONTCONFIG_ORIGINAL_SET="$original_set"
  export XODUS_NEXUS_FONTCONFIG_ORIGINAL="$original"
  export FONTCONFIG_FILE="$config"
fi
exec "$binary" "$@"
