import { build } from "esbuild";
import { readFile } from "node:fs/promises";
const lunarLicense = await readFile("LUNAR-LICENSE", "utf8");
await build({ entryPoints: ["src/main.js"], bundle: true, platform: "browser", format: "cjs", target: "es2020", external: ["obsidian"], outfile: "main.js", sourcemap: false, legalComments: "eof", banner: { js: `/*! lunar-javascript license:\n${lunarLicense}\n*/` } });
