import resolve from "@rollup/plugin-node-resolve"
import typescript from "@rollup/plugin-typescript"

export default [
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/stimulus-parser.js",
        format: "esm",
      },
    ],
    plugins: [
      resolve(),
      typescript(),
    ],
    watch: {
      include: "src/**",
    },
  },
]
