#!/bin/sh
set -eu

PREFIX=${PREFIX:-$HOME/.local/bin}
rm -f "$PREFIX/a11ylens"
echo "Removed $PREFIX/a11ylens"
echo "The A11yLens folder was not deleted."
