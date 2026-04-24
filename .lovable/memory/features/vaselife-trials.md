---
name: vaselife-trials
description: Plantscout Vaselife trial data (headers, vases, measurements) — live API sync via plantscout-sync edge function, displayed on /trials Trials Dashboard
type: feature
---
**Plantscout Vaselife Trials**

- DB: `vaselife_headers` (trial-level), `vaselife_vases` (cultivar × treatment), `vaselife_measurements` (per-property scores like FLC, STD, BTR, LFQ, etc.)
- RLS: any authenticated user can read; admins/internal/ta can write
- **Live sync**: Admin → "Plantscout Vaselife Sync" card → runs `plantscout-sync` edge function. Pulls all 3 exports and upserts by primary key (`id` / `id_line` / `id_line_property`)
- API: `GET https://plantscout-api.net/api/DownloadData?exportDefinitionId={id}` with header `X-API-Key` (secret `PLANTSCOUT_API_KEY`)
- Export definition IDs: Headers `25baa6b4-565d-468b-aac5-03a00ad7bf21`, Vases `9dad8543-2b07-4901-9191-03a00af200fd`, Measurements `53d6018b-2ae6-4104-bbfa-03a00b0285f2`
- UI: `/trials` Trials Dashboard — list trials, drill into Vases tab (treatments grouped by cultivar with VL days), Measurements tab (cultivar×treatment×property matrix), Conclusion tab
- Property labels reference table in `src/hooks/useVaselifeTrials.ts` (PROPERTY_LABELS)
- Some vase/measurement rows reference header IDs not present in the headers export — auto-stored as stub headers labeled "(missing from export)"

**Data → Table mapping (confirmed by Plantscout source report layout):**
- **HEADER table** = top trial metadata block (Trial number(s), Harvest date, Initial quality, Transport/Retail/VL phases, Crop, Number of Cultivars/Treatments/Vases) + bottom narrative block (Objective, Specific comments, Conclusion, Recommendations).
- **VASE table** = (1) the Treatment definitions table (Treatment #, Greenhouse, Post-Harvest treatment, Store phase, Consumer phase, Vase Life days) AND (2) the "Quick overview" matrix at bottom showing per-cultivar × per-treatment vase life days (each row in the quick overview = one vase row).
- **MEASUREMENT table** = the per-trait observation tables ("Leaf burning", "Leaf yellowing", "Botrytis", etc.) — each row = (cultivar, treatment, property) and the score column stores the LAST observation value (final-day score). Earlier daily observations are not stored — only the latest.
