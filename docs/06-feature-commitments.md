# Complete feature catalogue — release promises vs future scope

This document turns the original master brief into a testable capability catalogue. A feature name in the catalogue is not proof that it is implemented; use the status column.

| Feature | Intended product behaviour | Initial release state | Production gate |
|---|---|---|---|
| India overview | India-first map landing page with state/district drill-down | Demo shell exists | Approved boundaries and source-backed indicators |
| Interactive map | Pan, zoom, select features, inspect attributes | Working with demo map markers | Chosen basemap/data provider rights and performance tests |
| Map search | Find a place or asset | UI search panel filters demo scenarios only | Geocoder / authoritative place-name source |
| Layer manager | Toggle thematic overlays and inspect legend | Demo marker categories | Per-layer source, licence and styling metadata |
| Time slider | Compare observations and scenarios across time | Planned | Time-aware source records and historical storage |
| Map drawing | User-drawn point, line and polygon annotations | Planned | Editing permissions, geometry validation and audit |
| Measurement | Distance and area measurement | Planned | CRS-aware calculation and clear units |
| Live transport | Authorized road/rail/metro status and trend analysis | Not connected | Feed agreement, latency/SLO and provenance |
| Climate dashboard | Weather, rainfall, heat and cyclone views | Not connected | Official feeds, timestamp validation and uncertainty display |
| Disaster alerts | Official CAP alert ingestion and geospatial display | Not connected | Authorized feed, expiry handling, duplicate handling and review |
| Flood-risk analysis | Combine rainfall, terrain, river and exposure layers | Not implemented | Hydrology data, calibrated model and backtesting with domain experts |
| Emergency coordination | Situation reports, response checklists and resource status | Not implemented | Agency-approved workflow and accountable human authority |
| Infrastructure registry | Asset location, condition, inspection and maintenance history | Not implemented | Partner asset data and asset-ID reconciliation |
| Energy intelligence | Aggregate load, generation, outage and resilience analytics | Not connected | Utility data-sharing agreement and secure telemetry path |
| Water intelligence | Basin, reservoir and groundwater indicators | Not connected | Authorized water observations and consistent units/geography |
| Agriculture intelligence | Soil, crop, agromet and seasonal risk layers | Not connected | Official/research datasets and local validation |
| Economic dashboard | Official statistics by published geography and time | Not implemented | Data lineage, revision handling and comparable definitions |
| Population analytics | Aggregate population density and published mobility statistics | Not implemented | Statistical disclosure controls and minimum aggregation thresholds |
| Industrial growth | Industrial clusters and investment/infrastructure indicators | Not implemented | Lawful public or partner data with clear definitions |
| AI analyst | Natural-language questions over approved datasets, with citations | Rule-based placeholder only | Retrieval grounding, evaluations, access controls and model monitoring |
| AI reports | Evidence-linked situation, state and infrastructure reports | Not implemented | Reproducibility, source citations and human review |
| Multi-agent monitoring | Specialist agents for data quality, climate, transport and reports | Architecture planned | Bounded tools, budget/timeouts, permission broker and evals |
| Anomaly detection | Find outliers in time-series or spatial observations | Not implemented | Validated baselines, false-positive review and alert thresholds |
| Prediction and forecasting | Forecast a defined measurable outcome with uncertainty | Not implemented | Holdout testing, calibration, drift monitoring and published limitations |
| Strategic simulation | Sandbox what-if scenario runs | Not implemented | Documented assumptions, sensitivity analysis and no live-action side effects |
| 3D globe / city | 3D globe, terrain, buildings and city layers | Not implemented | Licensed data, performance targets and GPU fallbacks |
| Satellite imagery | View approved raster/imagery and compare time periods | Not connected | Provider agreements, licensing and storage controls |
| Drone imagery | Import approved mission imagery for inspection/incident mapping | Not connected | Operator permission, airspace/legal checks, privacy review and retention policy |
| Cyber monitoring | Defensive infrastructure health and approved telemetry | Not implemented | Explicit authorization and defensive-only scope |
| Multilingual UI | English plus phased Indian-language interface and reports | Planned | Terminology review, accessibility and human-checked critical translation |
| Voice interface | Speech input/output for hands-free analyst workflows | Planned | Language coverage, privacy notice and voice recognition evaluation |
| Offline field mode | Cached maps and queued field notes with later sync | Planned | Conflict resolution, cache expiry and device security |
| Identity and RBAC | User sign-in, role and tenant policy | Not implemented | IdP integration, MFA and security testing |
| Audit and compliance | Trace searches, exports, data changes and AI-generated outputs | Not implemented | Immutable/sealed audit storage and retention policy |
| Notifications | In-app/email/SMS/browser notifications | Not implemented | Approved channels, subscription preferences and delivery monitoring |
| Export | PDF/CSV/GeoJSON/map snapshots with attribution | Not implemented | Licence propagation and access policy checks |
| API / SDK | Versioned APIs for partner platforms | Local demo API exists | API contract, auth, quotas, observability and versioning |
| Mobile / field app | Field observation, inspection and alert subscription | Future | Offline sync, device protection and platform testing |
| Federated national deployment | Agency/region-level deployments with shared standards | Long-term concept | Formal governance, data agreements, independent audit and operations team |

## What can be promised from v0.1

- A local development dashboard and API.
- Interactive India-centred basemap.
- Synthetic scenario markers and category filters.
- A visible distinction between demo data and live data.
- An API health check, basic tests and developer build scripts.

## What must not be promised yet

- Live national monitoring, real-time traffic, official emergency alerts or government integrations.
- Accurate flood, cyclone, economic, security or infrastructure predictions.
- Autonomous emergency response or automated governance action.
- Full satellite/drone ingestion, a national digital twin or 3D city coverage.
- Any claim of government approval, official status or nationwide operational deployment.
