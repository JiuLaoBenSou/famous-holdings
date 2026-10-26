# HoldingsAtlas public website

Published, dated investment-disclosure records with original sources and AI collection/accuracy disclosure. This repository contains the static public release only. Collection and editorial data remain local.

Website: https://holdingsatlas.com/

Correction reports: https://github.com/JiuLaoBenSou/famous-holdings/issues

Search data transport: `data/records.json` uses the versioned lossless `$holdingsAtlasRecords=1` format. Import `decodeRecordsDocument` from `records-codec.mjs` to restore the full original records and sources. Dated record HTML and citation URLs retain the complete published facts.
