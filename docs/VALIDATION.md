# Validation and known differences

## Executed checks

- TypeScript: passed.
- ESLint: passed.
- Scheduling unit suite: 11 tests passed, covering combined durations/buffers, incompatible professionals, breaks, shifts, conflicts, rescheduling, Any Available, duplicate check-in, tokens, ETA changes, transitions and audit reasons.
- Playwright: 21 tests passed. Includes booking validation/persistence, reschedule saving and cancellation, full reception queue lifecycle and keyboard focus restoration, queue joining/leaving and privacy, cross-tab updates, completion-to-ETA synchronization and analytics filters.
- Responsive browser checks: all five primary routes at 390, 768 and 1448px; no horizontal overflow. Screenshots are generated under `docs/screenshots`.
- Production Next.js Webpack build: passed.

Form controls are labeled, focus outlines are visible, and Radix dialogs provide keyboard focus trapping and Escape dismissal. The automated suite is focused functional coverage, not a complete accessibility audit.

## Reference matching

The supplied screenshots were used to compare logo silhouette, typography, colors, photo crops, major grid composition and desktop/mobile layouts. Original photos and vector masters were not supplied. Cleanly recoverable crops are reused; extracted content is necessarily limited in resolution and framing. The plant cutout/testimonial environment could not be recovered cleanly as separate assets. No unrelated photo replacement was made.

Queue estimates, availability slots and operational totals are computed from the coherent synthetic state. They therefore differ from static screenshot numbers. The historical analytics fixture is illustrative and separate from the operational fixture.

## Figma handoff status

File: https://www.figma.com/design/Gkg2DNv0MUBVqDLgoRER6s

Created five editable desktop layouts, three mobile customer layouts, two tablet dashboard layouts, brand color variables, outlined vector logo masters and reusable navigation, action, service card, professional card, queue row, dashboard panel, header/footer and sidebar components.

The Starter-plan Figma MCP call limit stopped the final organization pass after component creation. Screens remain on the working canvas with preliminary capture frames. Final canvas cleanup, page grouping, replacement of every captured logo with its vector instance, and Figma-export screenshot validation remain incomplete. Desktop captures retain their full content heights; the intended final artboard viewport is 1448 × 1086. Do not describe the Figma file as fully polished or pixel-identical. Local SVG delivery is complete and independent of the Figma export quota. `figma-cleanup.js` preserves the pending canvas organization code; inspect the current file and follow the Figma skill before resuming it.

## Production limitations

LocalStorage synchronization is a demo mechanism and can race on simultaneous independent writes. It does not provide security, durable transactions or real-time server delivery. Customer records are synthetic. Public queue privacy is verified at the rendered interface; secure server-side customer isolation is a later backend requirement. Backend authorization, tenant/branch enforcement, payments, OTP, messaging, sockets and deployment are not implemented in this phase.
