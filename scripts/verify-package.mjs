#!/usr/bin/env node
// Pack-and-install check. It builds the package, packs the tarball, installs that tarball
// into a throwaway Next.js app (e2e/fixture), builds the app and asserts the result.
// A problem that only shows up for consumers (a missing file, a wrong "exports" entry,
// server code in the browser bundle) fails here, before publish.
//
// Nothing in this file is specific to reCAPTCHA except the CONFIG block, so the script
// can be lifted into its own package later.

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const FIXTURE = join(ROOT, "e2e", "fixture");
const BUILD = join(FIXTURE, ".build");

const CONFIG = {
  packageName: "@miguelcolmenares/recaptcha",
  subpaths: ["", "/client", "/server"],
  clientEntries: ["dist/client.js", "dist/client.cjs"],
  // Files that must never reach the browser bundle.
  forbiddenInClient: ["siteverify", "RECAPTCHA_SECRET_KEY"],
  // Files that must not be inside the tarball.
  forbiddenInTarball: [/^src\//, /^e2e\//, /^scripts\//, /\.env/, /\.test\./],
  // Strings that must be in the browser bundle (proof that inlining and the loader work).
  requiredInClient: ["recaptcha/api.js"],
  serverEntriesWithoutReact: [
    "dist/index.js",
    "dist/index.cjs",
    "dist/server.js",
    "dist/server.cjs",
  ],
};

const failures = [];
const passes = [];

function check(name, fn) {
  try {
    fn();
    passes.push(name);
    console.log(`  ok    ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  FAIL  ${name}\n        ${String(error.message).split("\n").join("\n        ")}`);
  }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", stdio: "pipe", ...options });
}

function runLoud(command, args, options = {}) {
  execFileSync(command, args, { stdio: "inherit", ...options });
}

function loadEnvFile() {
  try {
    process.loadEnvFile(join(ROOT, ".env.local"));
  } catch {
    // No .env.local: CI uses real environment variables, forks and Dependabot have none.
  }
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const rootPackage = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const dev = rootPackage.devDependencies;
const version = (name) => String(dev[name]).replace(/^[\^~]/, "");

loadEnvFile();
const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "fixture-site-key";

console.log("1/5 Build and pack");
runLoud("npm", ["run", "build"], { cwd: ROOT });
rmSync(BUILD, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });
// Older npm prints an array, npm 12 prints an object keyed by package name.
const packOutput = JSON.parse(
  run("npm", ["pack", "--json", "--pack-destination", BUILD], { cwd: ROOT }),
);
const packed = Array.isArray(packOutput) ? packOutput[0] : Object.values(packOutput)[0];
assert(packed?.filename, "npm pack returned no tarball");
const tarball = packed.filename.replace(/^@/, "").replace("/", "-");

check("tarball has the entry files", () => {
  const names = packed.files.map((file) => file.path);
  for (const required of [
    "package.json",
    "LICENSE",
    "dist/index.js",
    "dist/client.js",
    "dist/server.js",
  ]) {
    assert(names.includes(required), `missing ${required}`);
  }
});
check("tarball has no source, tests, scripts or env files", () => {
  const bad = packed.files
    .map((file) => file.path)
    .filter((p) => CONFIG.forbiddenInTarball.some((re) => re.test(p)));
  assert(bad.length === 0, `unexpected files: ${bad.join(", ")}`);
});

console.log("2/5 Install the tarball into the fixture app");
for (const name of ["package.json", "next.config.mjs", "tsconfig.json"]) {
  cpSync(join(FIXTURE, name), join(BUILD, name));
}
cpSync(join(FIXTURE, "app"), join(BUILD, "app"), { recursive: true });

const fixturePackage = JSON.parse(readFileSync(join(BUILD, "package.json"), "utf8"));
fixturePackage.dependencies = {
  [CONFIG.packageName]: `file:./${tarball}`,
  next: version("next"),
  react: version("react"),
  "react-dom": version("react-dom"),
};
fixturePackage.devDependencies = {
  typescript: version("typescript"),
  "@types/node": version("@types/node"),
  "@types/react": version("@types/react"),
  "@types/react-dom": version("@types/react-dom"),
};
writeFileSync(join(BUILD, "package.json"), JSON.stringify(fixturePackage, null, 2));
runLoud("npm", ["install", "--no-audit", "--no-fund"], { cwd: BUILD });

const installed = join(BUILD, "node_modules", ...CONFIG.packageName.split("/"));

console.log("3/5 Check the installed package");
for (const file of CONFIG.clientEntries) {
  check(`${file} starts with "use client"`, () => {
    const head = readFileSync(join(installed, file), "utf8").trimStart().slice(0, 40);
    assert(/^["']use client["']/.test(head), `starts with: ${head.split("\n")[0]}`);
  });
}
for (const file of CONFIG.serverEntriesWithoutReact) {
  check(`${file} does not import React`, () => {
    const source = readFileSync(join(installed, file), "utf8");
    assert(!/from ["']react["']|require\(["']react["']\)/.test(source), "imports react");
  });
}

console.log("4/5 Build the fixture app with Next.js");
runLoud("npx", ["next", "build"], {
  cwd: BUILD,
  env: { ...process.env, NEXT_PUBLIC_RECAPTCHA_SITE_KEY: siteKey, NEXT_TELEMETRY_DISABLED: "1" },
});

const clientFiles = listFiles(join(BUILD, ".next", "static")).filter((file) =>
  file.endsWith(".js"),
);
const clientCode = clientFiles.map((file) => readFileSync(file, "utf8")).join("\n");

check("the browser bundle has the site key inlined", () => {
  assert(
    clientCode.includes(siteKey),
    `"${siteKey}" not found in ${clientFiles.length} client files`,
  );
});
for (const needle of CONFIG.requiredInClient) {
  check(`the browser bundle contains "${needle}"`, () => {
    assert(clientCode.includes(needle), "not found");
  });
}
for (const needle of CONFIG.forbiddenInClient) {
  check(`the browser bundle does not contain "${needle}"`, () => {
    assert(!clientCode.includes(needle), "server-only code reached the browser bundle");
  });
}

console.log("5/5 Resolve types under node10, node16 and bundler");
const typesDir = join(BUILD, "types-check");
mkdirSync(typesDir, { recursive: true });
const imports = CONFIG.subpaths
  .map((subpath, index) => `import * as m${index} from "${CONFIG.packageName}${subpath}";`)
  .join("\n");
const usage = `void [${CONFIG.subpaths.map((_, index) => `m${index}`).join(", ")}];\nexport {};\n`;
const source = `${imports}\n${usage}`;
const base = {
  strict: true,
  noEmit: true,
  skipLibCheck: false,
  jsx: "react-jsx",
  types: [],
  lib: ["es2022", "dom"],
};
const matrix = [
  {
    name: "node10",
    files: ["check.ts"],
    options: { ...base, module: "commonjs", moduleResolution: "node10", ignoreDeprecations: "6.0" },
  },
  {
    name: "node16",
    files: ["check.mts", "check.cts"],
    options: { ...base, module: "node16", moduleResolution: "node16" },
  },
  {
    name: "bundler",
    files: ["check.ts"],
    options: { ...base, module: "esnext", moduleResolution: "bundler" },
  },
];
const tsc = join(BUILD, "node_modules", "typescript", "bin", "tsc");
for (const entry of matrix) {
  for (const file of entry.files) writeFileSync(join(typesDir, file), source);
  const config = join(typesDir, `tsconfig.${entry.name}.json`);
  writeFileSync(config, JSON.stringify({ compilerOptions: entry.options, files: entry.files }));
  check(`types resolve under ${entry.name}`, () => {
    try {
      run("node", [tsc, "-p", config], { cwd: typesDir });
    } catch (error) {
      throw new Error(String(error.stdout || error.message).trim(), { cause: error });
    }
  });
}

console.log(`\n${passes.length} passed, ${failures.length} failed`);
if (!existsSync(join(BUILD, ".next"))) failures.push("fixture build output missing");
process.exit(failures.length === 0 ? 0 : 1);
