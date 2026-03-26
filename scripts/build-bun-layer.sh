#!/bin/sh
set -eu

VERSION="${1:-1.3.2}"
OUTPUT_ZIP="${2:-bun-layer.zip}"
WORKDIR="$(mktemp -d)"
ARCHIVE="bun-linux-x64.zip"
URL="https://github.com/oven-sh/bun/releases/download/bun-v${VERSION}/${ARCHIVE}"
CACHED_BINARY="${HOME}/.bun/install/cache/bun-linux-x64-v${VERSION}"

cleanup() {
  rm -rf "$WORKDIR"
}

trap cleanup EXIT

mkdir -p "$WORKDIR/download" "$WORKDIR/bin"

if [ -f "$CACHED_BINARY" ]; then
  echo "Using cached Bun binary: $CACHED_BINARY"
  cp "$CACHED_BINARY" "$WORKDIR/bin/bun"
else
  echo "Downloading Bun ${VERSION} for linux-x64..."
  curl -fL "$URL" -o "$WORKDIR/download/$ARCHIVE"

  echo "Extracting Bun binary..."
  unzip -q "$WORKDIR/download/$ARCHIVE" -d "$WORKDIR/download"

  if [ ! -f "$WORKDIR/download/bun-linux-x64/bun" ]; then
    echo "bun binary not found in downloaded archive" >&2
    exit 1
  fi

  cp "$WORKDIR/download/bun-linux-x64/bun" "$WORKDIR/bin/bun"
fi

chmod +x "$WORKDIR/bin/bun"

(cd "$WORKDIR" && zip -qr "$OLDPWD/$OUTPUT_ZIP" bin)
echo "Created $OUTPUT_ZIP"
