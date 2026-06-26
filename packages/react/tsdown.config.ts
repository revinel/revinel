import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.tsx"],
  clean: true,
  dts: {
    resolve: true,
  },
  hash: false,
  minify: true,
  sourcemap: false,
  treeshake: true,
  unbundle: true,
  outExtensions: () => {
    return {
      js: ".js",
      dts: ".d.ts",
    }
  },
  external: ["@revinel/sdk", "react", "react/jsx-runtime"],
})
