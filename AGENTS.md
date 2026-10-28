# AGENTS.md

Context for any AI agent working in this repository.

## What this is

`@miguelcolmenares/recaptcha`: reCAPTCHA v3 for React and Next.js, MIT. Written from scratch.
Do not add code, text or configuration copied from other projects, and do not add dependencies on private packages.

## Layout (Domain-Driven Design, barrel exports)

```text
src/
  domain/          pure rules, constants, types. No I/O, no React.
  application/     use cases and ports (interfaces). Depends on domain only.
  infrastructure/  adapters: Google HTTP gateway, browser script loader. Implements ports.
  presentation/    React: the field component and the hook.
  index.ts         root entry: values and types, no React
  client.ts        "use client" entry
  server.ts        server entry, where adapters are wired to use cases
  __tests__/       unit tests, and __tests__/integration for tests with real HTTP
e2e/
  fixture/app/     Next.js app used to consume the packed tarball
  specs/           Playwright specs
scripts/           verify-package.mjs, the pack-and-install check
```

Rules: dependencies point inward (presentation and infrastructure may import application and domain, never the
reverse). Every layer has an `index.ts`, and other layers import it, not its files. Two exceptions, both on purpose:
`client.ts` and `server.ts` are composition roots and import files directly, and `presentation` imports
`infrastructure/scriptLoader` directly so the server-only Google gateway stays out of the browser bundle.

## Naming

- Components: `PascalCase.tsx`. Hooks: `useThing.ts`. Everything else: `camelCase.ts`.
- Tests: `src/__tests__/<unit>.test.ts(x)`. Specs: `e2e/specs/<feature>.spec.ts`.
- Types are exported with `export type`. Use `import type` for type-only imports.

## Tests

Three levels, all required for new behavior:

1. **Unit** (`npm run test:unit`): one unit, no network. jsdom only where the DOM is needed (`@jest-environment jsdom`).
2. **Integration** (`npm run test:integration`): real use case and real adapter over a local HTTP server.
3. **End-to-end** (`npm run test:e2e`): packs the tarball, installs it in `e2e/fixture`, builds it with Next.js,
   checks the build output, then runs Playwright.

Tests transpile only (`@swc/jest`). Types are checked by `npm run typecheck`, never inside the test runner.
Tests that need a real Google key skip themselves when the keys are missing.

## Rules learned the hard way

- `process.env.NEXT_PUBLIC_*` must be a literal member expression in client code, or the bundler will not inline it.
  `verify:package` fails if it is not.
- Server code must never reach the browser bundle. `verify:package` greps the bundle.
- `peerDependencies` list only majors that the tests run. Narrow first, widen with evidence.
- Every subpath must resolve under `node10`, `node16` and `bundler`. `verify:package` checks all three.
- A dev tool must not cap TypeScript in its peer range. One exception is documented in `.github/dependabot.yml`.
- A callback prop must never restart an effect. Keep callbacks in refs.
- Loading a script is not the same as the global being ready. Wait for `grecaptcha.ready`.
- Release with npm trusted publishing (OIDC). No long-lived tokens.

## Commits

Plain messages in the imperative. No attribution trailers.
