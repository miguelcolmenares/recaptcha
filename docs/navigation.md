---
order: 4
---

# Navigation and the badge

Next.js moves between pages without reloading, so a form can mount and unmount many times in one visit. This page explains what the package does about Google's script when that happens.

## The script is loaded once

The script is loaded the first time a field needs it and is **not** removed when the field unmounts. Google keeps its own state, the badge, its iframes and extra scripts, and removing the script tag does not reset any of it. Loading the script again after a client-side navigation left duplicate badges, so it is loaded once per page and every field shares it.

Two forms on one page, or a form that mounts again after you navigate away and back, all use the same script and the same promise.

## The badge stays visible

Because the script stays, the reCAPTCHA badge stays visible on pages without a form after the first visit to one that has a form. If you want the badge hidden, follow Google's rules for showing the reCAPTCHA branding text in your form instead of the badge.

## What this is tested against

The package is tested in a real Next.js app with Playwright: leaving a form and coming back does not load the script twice, fast navigation never leaves two scripts on the page, the back and forward buttons keep the form working, and a form submitted after navigating still reaches the server with its token.
