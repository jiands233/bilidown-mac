#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT_DIR/mac-bilidown/bin/bilidown"
BIN_DIR="$HOME/bin"
TARGET="$BIN_DIR/bilidown"
ZSHRC="$HOME/.zshrc"

if [[ ! -x "$SOURCE" ]]; then
  echo "bilidown entrypoint is missing or not executable: $SOURCE" >&2
  exit 1
fi

mkdir -p "$BIN_DIR"
ln -sfn "$SOURCE" "$TARGET"

touch "$ZSHRC"
if ! grep -Fqx 'export PATH="$HOME/bin:$PATH"' "$ZSHRC"; then
  {
    echo
    echo '# Bilidown CLI'
    echo 'export PATH="$HOME/bin:$PATH"'
  } >> "$ZSHRC"
fi

echo "Installed: $TARGET"
echo "Run this once in the current terminal:"
echo '  source ~/.zshrc'
echo "Then start the interactive CLI with: bilidown"
