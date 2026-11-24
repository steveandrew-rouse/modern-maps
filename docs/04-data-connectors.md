# Data connector and integration plan

## Connector principle

Treat a provider as a source of records, not as a permission to redistribute them. Before implementing an adapter, record: official endpoint, authentication, terms/licence, attribution, permitted storage, permitted derived use, refresh quota, rate limits, data classification, geography, spatial resolution, time semantics and support contact.

## Candidate Indian source families

| Domain | Candidate source | Integration path | Important qualification |
|---|---|---|---|
| Weather and forecasts | India Meteorological Department (IMD) | Official API management portal and published API reference | Create an account, review API access and terms, then map each endpoint's timestamp and geography. Do not scrape or assume anonymous access. |
| Multi-hazard alerts | NDMA SACHET / CAP feeds | Official RSS/CAP feed and published integration guide | Preserve issuer, severity, issue/expiry time, affected area and original message. A feed in a dashboard is not itself an emergency-service integration. |
| Geospatial foundations | NSDI / National Data Registry and Survey of India National Geo-Platform | Discover datasets and services, request/contract access as applicable | Use authoritative boundary/metadata services; confirm current publication and licence for every layer. |
| Earth observation | ISRO / NRSC Bhuvan services | OGC services such as WMS/WMTS/WFS/KML where access is permitted | Bhuvan's terms govern content; some services are view-only or separately licensed. Do not bulk-copy imagery without permission. |
| Open government datasets | data.gov.in | Published APIs and dataset downloads | Obtain API credentials where required and preserve each dataset's licence, attribution, update date and schema. |
| Base map / streets | OpenStreetMap ecosystem or a commercial tile provider | Vector/raster tiles or self-hosted tiles | Follow attribution, tile usage policy, caching and redistribution terms. Keep basemap provider configurable. |
| Transport | Relevant central/state transport operators and public feeds | Official API, GTFS/GTFS-RT, data-sharing agreement or licensed provider | Do not promise live rail/metro/road movement until a real supported feed is contracted and monitored. |
| Water / hydrology | Central Water Commission and relevant state agencies | Official bulletins, portals or approved machine-readable service | Validate station identity, units, basin mapping, update cadence and alert authority. |
| Air quality | CPCB and state pollution-control boards | Official published feeds / data services | Distinguish station measurements, modelled grids and third-party estimates. |
| Agriculture | Agromet and authorized agricultural datasets | Published advisories, approved services and research datasets | Preserve district/crop/time coverage; do not translate a sample into a farm-specific claim. |
| Multilingual AI | BHASHINI ecosystem | Approved language/voice APIs or partnership integration | Use only available services and approved credentials; keep human confirmation for critical translations and emergency wording. |
| AI compute/models | IndiaAI Compute / AIKosh ecosystem | Eligible compute access, model/dataset discovery and programme partnerships | Availability, eligibility, terms and approval are programme-specific; do not assume free or unrestricted access. |
| Economic / population statistics | Official statistical releases and census tables | Official downloads / documented APIs | Use published aggregate geographies only; do not infer individual movement or precise household locations. |

## Useful official starting points

- IMD API reference: https://api.imd.gov.in/public/api_reference.html
- NDMA SACHET CAP feeds: https://sachet.ndma.gov.in/CapFeed
- NSDI / National Data Registry: https://www.nsdi.gov.in/
- Survey of India geospatial guidelines: https://geospatial.dst.gov.in/Guidelines.aspx
- Bhuvan developer information: https://bhuvan.nrsc.gov.in/wiki/index.php/Information_for_Developers
- OGD India API catalogue/help: https://data.gov.in/apis and https://data.gov.in/help
- BHASHINI: https://bhashini.gov.in/
- IndiaAI Compute: https://compute.indiaai.gov.in/
- AIKosh: https://aikosh.indiaai.gov.in/

## Recommended integration order

1. Base map plus state/district boundaries from a source whose licence is explicit.
2. IMD weather data for a limited pilot area after API access is approved.
3. NDMA SACHET alerts through the documented RSS/CAP path.
4. Bhuvan/NRSC layers only after confirming each service's terms and permitted downstream use.
5. One pilot-domain data feed (e.g. municipal assets or transport) supplied by a consenting partner.

## Data contract

Every normalized record should carry at least:

```json
{
  "record_id": "provider:dataset:source-record-id",
  "provider": "authoritative-provider-name",
  "dataset": "dataset-name-and-version",
  "license": "license-or-contract-reference",
  "attribution": "required-attribution-text",
  "geometry": "GeoJSON geometry in WGS84 or documented CRS",
  "valid_time": "source observation or forecast-valid timestamp",
  "published_at": "provider publication timestamp",
  "ingested_at": "platform ingestion timestamp",
  "quality": {"status": "validated|warning|rejected", "notes": []},
  "processing": {"pipeline_version": "...", "transformations": []}
}
```

Never collapse `valid_time`, `published_at` and `ingested_at` into a single generic “updated” timestamp.
