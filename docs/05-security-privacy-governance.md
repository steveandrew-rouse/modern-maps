# Security, privacy and responsible operations

## Non-negotiable controls

- Least-privilege identities, role-based access and tenant separation.
- MFA for administrators and privileged users.
- Secret storage outside source code; rotate credentials and use scoped keys.
- TLS for network traffic and encryption at rest for sensitive datasets.
- Audit log for data reads, exports, connector changes, user approvals and administrative actions.
- Data retention schedule, deletion workflow, backup and restore tests.
- Input validation, rate limiting, dependency scanning, patching and security review.
- Source-level licence, privacy and permitted-use checks before publication.

## Privacy boundary

The platform is intended for public-interest geospatial analysis. Do not implement face recognition, biometric identification, watchlists, person-level tracking, covert device tracking, mass-surveillance workflows or identity inference from location traces. Population and mobility views must use approved aggregate datasets, minimum aggregation thresholds, spatial coarsening and suppression where needed.

## AI action boundary

AI can summarize evidence, identify missing data, propose analytical checks and draft reports. It cannot independently publish official alerts, dispatch responders, enforce regulations, deny benefits, identify suspects or trigger other high-impact actions. Such outputs require a named human authority, review, source verification and an audit record.

## Forecast and alert governance

- A forecast must include model version, training cutoff, validation period, geography, horizon, baseline comparison, uncertainty and known failure modes.
- A warning imported from an official source must preserve the original issuing body, message ID, issue time, expiry time and affected polygon.
- The UI must visually distinguish official warning, observed measurement, third-party estimate, AI inference and simulated scenario.
- Expired or stale content must be automatically marked and excluded from current-alert counts.

## Cybersecurity module scope

A future cyber module should be limited to defensive asset inventory, approved telemetry, vulnerability posture, service availability and incident coordination. Do not create offensive intrusion, unauthorized network scanning, covert access, exploit deployment or targeting workflows.

## Operational fallback

If an AI model, data connector or policy service fails, the map, read-only source viewer, authentication, audit and emergency stop must remain usable. If a permission check cannot be completed, privileged operations fail closed.
