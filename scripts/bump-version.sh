#!/usr/bin/env bash
# Bumps patch version, rolling over at .9 -> minor+1.0
set -e

PKG="App/package.json"
VERSION=$(node -p "require('./$PKG').version")

IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"

if [ "$PATCH" -ge 9 ]; then
  MINOR=$((MINOR + 1))
  PATCH=0
else
  PATCH=$((PATCH + 1))
fi

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

# Update package.json and package-lock.json
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('$PKG', 'utf8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('$PKG', JSON.stringify(pkg, null, 2) + '\n');
"

# Update package-lock.json if it exists
LOCK="App/package-lock.json"
if [ -f "$LOCK" ]; then
  node -e "
    const fs = require('fs');
    const lock = JSON.parse(fs.readFileSync('$LOCK', 'utf8'));
    lock.version = '$NEW_VERSION';
    if (lock.packages && lock.packages['']) lock.packages[''].version = '$NEW_VERSION';
    fs.writeFileSync('$LOCK', JSON.stringify(lock, null, 2) + '\n');
  "
fi

echo "$NEW_VERSION"
