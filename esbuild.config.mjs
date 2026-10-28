import { build } from "esbuild";
await build({ entryPoints: ["src/main.js"], bundle: true, platform: "browser", format: "cjs", target: "es2020", external: ["obsidian"], outfile: "main.js", sourcemap: false, legalComments: "eof" });
