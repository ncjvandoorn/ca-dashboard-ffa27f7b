---
name: vaselife-trials
description: Plantscout Vaselife trial data (headers, vases, measurements) seeded into 3 DB tables, displayed on /trials Trials Dashboard
type: feature
---
**Plantscout Vaselife Trials**

- DB: `vaselife_headers` (trial-level), `vaselife_vases` (cultivar × treatment), `vaselife_measurements` (per-property scores like FLC, STD, BTR, LFQ, etc.)
- RLS: any authenticated user can read; admins/internal can write
- Initial data seeded from 3 JSON files supplied by Plantscout (headers/vases/measurements export definitions on plantscout-api.net)
- Future: replace seed with live API ingestion via edge function (3 export definitions: Headers `25baa6b4-565d-468b-aac5-03a00ad7bf21`, Vases `9dad8543-2b07-4901-9191-03a00af200fd`, Measurements `53d6018b-2ae6-4104-bbfa-03a00b0285f2`)
- UI: `/trials` Trials Dashboard — list trials, drill into Vases tab (treatments grouped by cultivar with VL days), Measurements tab (cultivar×treatment×property matrix), Conclusion tab
- Property labels reference table in `src/hooks/useVaselifeTrials.ts` (PROPERTY_LABELS)
- Some vase/measurement rows reference header IDs not present in the headers export — stored as stub headers labeled "(missing from export)"
