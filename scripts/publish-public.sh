#!/usr/bin/env bash
# Publishes the public @revinel/* client packages to npm — RUNS IN THE PUBLIC MIRROR
# (revinel/revinel), where this file is placed by scripts/sync-public-sdk.sh. Invoked by
# the mirror's `release` script (after `bun run build` has produced each package's ./dist).
#
# Each package is published from its built ./dist, NOT its package root: dist/package.json
# is the publishable manifest (entry points rewritten to ./index.js by prepare-package.ts),
# whereas the root package.json still points main at ./src. publishConfig.directory is a
# pnpm/bun-only hint that npm ignores, so publishing ./dist explicitly is the only correct way.
#
# Idempotent: any version already on npm is skipped, so running on every sync is a safe
# no-op until the private monorepo bumps a version. The four packages share one version
# (changesets `fixed` group), so a single umbrella GitHub Release is cut per version.
set -euo pipefail

PACKAGES=(embeds sdk react browser)
published=()

for pkg in "${PACKAGES[@]}"; do
  dist="packages/$pkg/dist"
  name=$(node -p "require('./$dist/package.json').name")
  version=$(node -p "require('./$dist/package.json').version")

  if npm view "$name@$version" version >/dev/null 2>&1; then
    echo "skip $name@$version — already on npm"
    continue
  fi

  echo "publishing $name@$version"
  (cd "$dist" && npm publish --provenance --access public)
  published+=("$name@$version")
done

if [ ${#published[@]} -eq 0 ]; then
  echo "nothing to publish — all current versions are already on npm"
  exit 0
fi

# All four share a version (fixed group) — read it from any package, cut one release.
version=$(node -p "require('./packages/sdk/dist/package.json').version")
tag="v$version"

if gh release view "$tag" >/dev/null 2>&1; then
  echo "release $tag already exists — skipping release creation"
  exit 0
fi

git tag "$tag"
git push origin "$tag"
printf -- '- %s\n' "${published[@]}" | gh release create "$tag" --title "$tag" --notes-file -
echo "created release $tag"
