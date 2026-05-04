#!/bin/zsh

cd "$(dirname "$0")" || exit 1

URL="http://localhost:5173/index.html"

if curl -fsS --max-time 1 "$URL" >/dev/null 2>&1; then
  open "$URL"
  exit 0
fi

echo "Movie Shelfを起動しています..."
(sleep 1; open "$URL") &
node server.js
