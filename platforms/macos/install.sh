#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install Node.js 20.10 or newer from https://nodejs.org/" >&2
  exit 1
fi

NODE_SUPPORTED=$(node -p "Number(process.versions.node.split('.')[0]) > 20 || (Number(process.versions.node.split('.')[0]) === 20 && Number(process.versions.node.split('.')[1]) >= 10)")
if [ "$NODE_SUPPORTED" != true ]; then
  echo "Node.js $(node -v) is too old. A11yLens needs Node.js 20.10+ (22+ for --render)." >&2
  exit 1
fi

echo "Installing A11yLens dependencies in $ROOT ..."
(cd "$ROOT" && npm install --no-audit --no-fund)
chmod +x "$ROOT/bin/a11ylens.js" "$ROOT/platforms/macos/a11ylens"

PREFIX=${PREFIX:-$HOME/.local/bin}
mkdir -p "$PREFIX"
ln -sf "$ROOT/platforms/macos/a11ylens" "$PREFIX/a11ylens"

echo ""
echo "A11yLens is ready."
echo "  $PREFIX/a11ylens --help"
echo ""
case ":$PATH:" in
  *":$PREFIX:"*) ;;
  *) echo "Add $PREFIX to your PATH to run 'a11ylens' from anywhere:"; echo "  export PATH=\"$PREFIX:\$PATH\"" ;;
esac
echo ""
echo "For the rendered scan, install Google Chrome, Chromium or Edge and run:"
echo "  a11ylens /path/to/site --render"
