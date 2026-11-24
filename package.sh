#!/bin/sh
# Builds the zip to upload to addons.mozilla.org: only the files the extension
# needs (no README, store notes, old builds or git data). Output goes in dist/.
set -e
cd "$(dirname "$0")"
version=$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')
out="dist/finite-for-youtube-$version.zip"
mkdir -p dist
rm -f "$out"
zip -q -r "$out" manifest.json settings.js content.js popup.html popup.css popup.js \
  content.css distractions.css search.css subscriptions.css watch.css searchbar.css responsive.css \
  icons -x "*.DS_Store"
echo "Built $out"
unzip -l "$out"
