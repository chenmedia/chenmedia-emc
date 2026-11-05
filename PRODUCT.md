# Eventphoto Mission Control

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is an event photo editor or team lead planning coverage across parallel stages, activities, breaks, and partner commitments. Photographers use their individual schedules during the event, while external viewers may inspect the shared plan without editing it.

## Product Purpose

EMC coordinates event photography teams. It makes the full programme, coverage priorities, photographer availability, assignment conflicts, and individual run sheets visible in one place so the team can cover more of an event without double-booking people.

## Positioning

The product plans coverage by photographic moment—start, end, or the whole programme item—rather than assuming that a photographer remains for every complete session.

## Operating Context

EMC is used before and during conferences, summits, tradeshows, festivals, and corporate events. Editors work from the master schedule; photographers receive focused schedule views and PDF run sheets. The current working event is Oslo Proptech Summit 2026 at Construction City.

## Capabilities and Constraints

- Filter programme items by stage, main-partner status, customer priority, coverage state, and photographer.
- Assign one or more photographers to coverage windows and warn before double-booking.
- Preserve centrally stored planning data in Neon Postgres.
- Authenticate approved editors with Neon Auth and Google login; shared visitors remain read-only.
- Export individual photographer plans and a master plan as PDF.
- Keep an editor-facing change history with the ability to inspect and reverse changes.
- The daisyUI/Tailwind prototype is illustrative and must not write to Neon or replace the production interface without explicit approval.

## Brand Commitments

The product name is Eventphoto Mission Control (EMC). The Oslo Proptech Summit identity and teal-led event palette remain recognizable. Interface language is concise, operational, and primarily Norwegian.

## Evidence on Hand

- Existing production implementation and programme data in this repository.
- Oslo Proptech Summit logo assets in the project.
- Existing photographer assignments, priority annotations, and programme metadata.
- The prototype may reuse real programme titles but must label its state as a mockup and avoid implying that edits are saved.

## Product Principles

- Make conflicts visible before an assignment is made.
- Optimize for fast scanning during a live event.
- Separate editor controls from read-only sharing.
- Keep the master plan and every photographer plan consistent.
- Treat partner and customer priorities as operational constraints, not decoration.

## Accessibility & Inclusion

Controls must be keyboard accessible, maintain visible focus, preserve readable contrast, and remain usable on desktop and mobile screens.
