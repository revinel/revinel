// Copies the built IIFE (dist/embed.iife.js) to the static asset that apps/app
// serves at GET /embed.js, prepending a "do not edit" banner. Runs as the last
// step of `@revinel/browser` build, so embed.js is regenerated whenever the
// package is built (turbo build), never during dev.
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const packageDir = path.resolve(import.meta.dirname, "..")
const builtFile = path.join(packageDir, "dist", "embed.iife.js")
const destFile = path.resolve(packageDir, "..", "..", "apps", "app", "public", "embed.js")

const banner =
  "// Generated from @revinel/browser/src/embed.ts — do not edit.\n" +
  "// Regenerate: bun run --filter @revinel/browser build\n"

const built = await readFile(builtFile, "utf8")

try {
  await writeFile(destFile, `${banner}${built.trimEnd()}\n`)
  process.stdout.write(`synced embed.js → ${path.relative(process.cwd(), destFile)}\n`)
} catch (error) {
  // ponytail: the public mirror (revinel/revinel) has no apps/app — embed.js is a
  // monorepo-only static asset, so skip the copy there instead of failing the build.
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error
  }

  process.stdout.write("skipped embed.js sync — apps/app/public absent (mirror build)\n")
}
