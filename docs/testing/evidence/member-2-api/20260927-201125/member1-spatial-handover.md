# Member 1 spatial fixture handover

Run 20260927-201125. SQL setup only; not registration/approval/publication workflow evidence. No credentials included. API cases A05?A07 passed. Use your own web session/assigned test account.

Organization A: 5bd7613b-8dad-45d4-9933-f1ec124417c9
Official GN: Bangalawatta (1136125)
Point latitude 6.837643, longitude 79.961131

Organization B: 7b832c2f-03e7-445b-ba62-8ce08736b113
Official GN: Batakettara North (1136250)
Point latitude 6.785302, longitude 79.921836

| Kind | Label | UUID |
|---|---|---|
| Incident | radius-500 | 318f949e-cdd9-49bd-adc5-ab69026f35b6 |
| Incident | radius-1500 | c8e1d382-7e89-4f4c-9df7-93664ad506ef |
| Incident | radius-2500 | e9d45be8-af03-4d22-a5f9-37f948b55211 |
| Incident | radius-3500 | ba0fbd5c-1b94-4452-9519-0a3324a4ffc5 |
| Incident | radius-resolved | f8c5207b-dfbc-47b3-84fa-337d61381123 |
| Incident | area-0-unlinked | 7c55d958-92a7-446d-8897-e633c8e285dd |
| Incident | area-0-resolved | f1d940b5-a025-48f7-8329-23d31eb553f8 |
| Incident | area-0-linked | a92fb738-339d-489c-bc0d-0c8b933fa65f |
| Incident | area-1-unlinked | bd5defb7-1ba4-471f-9670-b7c08b0c0964 |
| Incident | area-1-resolved | f3bf60c2-bf9c-4513-af37-7d7fac1167ce |
| Incident | area-1-linked | bec3762b-4d77-4da0-bfe1-e40e6298761e |
| Event | radius-500 | 91d76e2b-a993-472f-93e6-e1bdb3fbc8f4 |
| Event | radius-1500 | e3120d2f-0091-4aa1-9882-f6dc119ecc21 |
| Event | radius-2500 | 142c6f4f-1cfc-4c64-b29f-5827bb79a637 |
| Event | radius-3500 | 1b8de8e4-9e71-44cc-8985-efa89e97656e |
| Event | area-0-own-draft | 21f67744-6726-49af-922c-6ca706c45847 |
| Event | area-0-other-draft | 78029c3e-29c4-4148-bd92-c5670469996b |
| Event | area-0-direct-public | b48cae0d-0881-46d7-a727-56dedd812afe |
| Event | area-0-other-linked-public | c322a9b1-c76d-4921-bbf8-bb8fd46d51c5 |
| Event | area-1-own-draft | 1c919b94-805f-4c00-8a50-5d5e1a83697d |
| Event | area-1-other-draft | 63ee9015-146b-4acd-925b-efaf77a95e67 |
| Event | area-1-direct-public | d777743b-2023-4071-89f1-2a2851afbf11 |
| Event | area-1-other-linked-public | 933f080b-3561-43e5-9cab-93b785170d0d |

Expected: area-0 belongs to A coverage; area-1 to B. Own drafts visible to owner within its coverage; other drafts hidden; published direct/linked events within viewer coverage visible. Resolved incidents excluded. Test IDs independently from UI marker colors.
