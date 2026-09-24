#!/usr/bin/env bash
# Signs built packages and turns them into a signed pacman repo named "open-task-manager".
# Used by .github/workflows/publish-linux.yml; runnable locally too.
#
# Usage: make-repo.sh <dir containing *.pkg.tar.zst> <output dir>
# The signing key is imported from $PACKAGES_GPG_PRIVATE_KEY if set, else the keyring's
# default secret key is used.
set -euo pipefail
src=$1
out=$2

if [[ -n "${PACKAGES_GPG_PRIVATE_KEY:-}" ]]; then
  echo "$PACKAGES_GPG_PRIVATE_KEY" | gpg --batch --import
fi

mkdir -p "$out"
cp "$src"/*.pkg.tar.zst "$out"/
cd "$out"
for pkg in *.pkg.tar.zst; do
  gpg --batch --yes --detach-sign --no-armor "$pkg"
done
repo-add --sign --include-sigs open-task-manager.db.tar.gz ./*.pkg.tar.zst

# repo-add makes open-task-manager.db/.files (and their .sig) symlinks to the .tar.gz files.
# GitHub Pages doesn't serve symlinks, so replace them with real copies.
find . -maxdepth 1 -type l -print0 | while IFS= read -r -d '' link; do
  cp --remove-destination "$(readlink -f "$link")" "$link"
done
