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
#
# Stable vs beta is driven entirely by the version string (set upstream by changesets,
# incl. its prerelease mode): a prerelease like 0.1.0-beta.0 publishes under that dist-tag
# (`beta`) and is flagged a GitHub prerelease; a plain version goes to `latest`.
set -euo pipefail

# 0.1.0-beta.2 -> beta ; 1.2.3-rc.0 -> rc ; 1.2.3 -> latest
disttag_for() {
  case "$1" in
    *-*) printf '%s' "${1#*-}" | cut -d. -f1 ;;
    *) printf 'latest' ;;
  esac
}

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

  tag=$(disttag_for "$version")
  echo "publishing $name@$version (dist-tag: $tag)"
  # Auth + provenance come from OIDC trusted publishing (configured per package on npmjs.com);
  # npm >= 11.5.1 under id-token:write attests provenance automatically — no token, no --provenance.
  (cd "$dist" && npm publish --access public --tag "$tag")
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

release_args=(--title "$tag" --notes-file -)
case "$version" in *-*) release_args+=(--prerelease) ;; esac

git tag "$tag"
git push origin "$tag"
printf -- '- %s\n' "${published[@]}" | gh release create "$tag" "${release_args[@]}"
echo "created release $tag"
