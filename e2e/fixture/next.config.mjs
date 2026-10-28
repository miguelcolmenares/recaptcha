import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
export default {
  // The fixture is copied into e2e/fixture/.build, inside another project that has its own
  // lockfile. Pin the root so Next does not guess it.
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
};
