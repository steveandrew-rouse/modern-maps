# Delivery roadmap and acceptance gates

The ranges below are planning estimates for a small, capable team; they are not delivery guarantees. The schedule depends mainly on data access, data quality, product scope and validation.

## Phase 0 — foundation and demo (current starter)
**Goal:** a running dashboard, stable data model and visible demo/real-data boundary.

- Run the React + MapLibre UI and FastAPI service locally.
- Add automated API tests and frontend build checks.
- Define layer catalogue, event schema and source registry.
- Confirm target pilot use case: disaster preparedness, transport, city infrastructure or another single domain.

**Exit criteria:** clean setup on a second Windows machine; API tests pass; frontend production build passes; demo fixtures are visibly labelled; no external source is implied to be live.

## Phase 1 — trustworthy map and source registry
**Goal:** one real geography and two or three authorized datasets.

- Add PostGIS and migrations.
- Add a dataset registry with provider, licence, coverage, resolution, timestamp and refresh frequency.
- Integrate one administrative-boundary dataset and one base-map/data service under its terms.
- Add feature inspection, legend, time filter, source drawer and export attribution.

**Exit criteria:** source lineage can be followed from UI to raw record; stale feeds visibly become stale; refresh failures are observable; all terms/attributions are documented.

## Phase 2 — operational analytics
**Goal:** a useful decision-support workflow for one pilot domain.

- Select one domain and geographic pilot area.
- Add time-series storage, backtesting and a transparent baseline model.
- Build a human-reviewed alert triage workflow.
- Generate reports with evidence links, assumptions and uncertainty.
- Add RBAC, MFA, audit and retention controls.

**Exit criteria:** measurable accuracy/latency/availability targets are agreed with the pilot user; model results are compared to a simple baseline; reviewers can reject/correct an output; every published report is reproducible.

## Phase 3 — multi-domain intelligence
**Goal:** controlled expansion into transport, climate, water, infrastructure, agriculture and energy.

- Add connector adapters per data owner.
- Add temporal and spatial analytics.
- Introduce bounded specialist agents with scoped tools and action approvals.
- Create state/district scorecards only where source resolution supports that aggregation.

**Exit criteria:** each module has named data owners, service levels, quality checks, model cards and operational owners.

## Phase 4 — simulation and advanced visualization
**Goal:** sandboxed city scenarios and 3D context.

- Add terrain/building models where lawful and available.
- Add scenario inputs, assumptions, parameter sweeps and sensitivity analysis.
- Add 3D globe/city views as optional workspaces, not as a prerequisite for core use.
- Add approved satellite imagery/change-detection workflows.

**Exit criteria:** simulations are clearly separated from observations; scenario assumptions and model versions are saved; results pass expert review.

## Phase 5 — institutional / national-scale deployment
**Goal:** multiple agencies or operators using a federated system.

- Establish formal data-sharing agreements and governance.
- Deploy regionally resilient services with disaster recovery.
- Use tenant and agency boundaries, federated identity and fine-grained policy controls.
- Conduct independent security, privacy, accuracy, resilience and legal reviews.

**Exit criteria:** signed service agreements, audited access controls, documented SLOs, disaster recovery tests, independent penetration testing and a real operations team.
