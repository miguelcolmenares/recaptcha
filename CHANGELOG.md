# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `RecaptchaField` and `useRecaptcha` (`/client`): hidden-input token field with refresh, lazy loading, and stable handling of callback props.
- `verifyRecaptcha`, `getRecaptchaToken`, `isRecaptchaEnabled` (`/server`): server-side check of score, action and hostname that returns a typed result.
- Root entry with constants, types and the pure `evaluateResponse` rule, free of React.
- Pack-and-install verification (`npm run verify:package`) and Playwright end-to-end tests.
