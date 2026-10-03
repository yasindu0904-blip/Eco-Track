# EcoTrack documentation

Start with the [project README](../README.md) for setup and Docker commands.

## Essential references

- [Architecture](architecture.md): backend structure and notification delivery.
- [System flow](IMPORTANT/EcoTrack_Complete_System_Flow_Source_of_Truth_v1.txt): product rules and workflows.
- [Authorization contract](IMPORTANT/EcoTrack_Core_Authorization_Contract.md): roles, permissions and tenant isolation.
- [Database model](../database_docs/EcoTrack_ERD_v2_Final.dbml) and [database guidance](../database_docs/EcoTrack_Database_v2_Finalization_and_Codex_Instructions.txt).
- [Local PostGIS setup](IMPORTANT/EcoTrack_Local_Docker_PostGIS_First_Run_Setup.txt), [Redis](IMPORTANT/EcoTrack_Redis_Usage_Guide.txt), and [Sri Lankan service areas](IMPORTANT/EcoTrack_Sri_Lanka_Service_Area_Boundaries_Guide.md).
- [UI and navigation](IMPORTANT/EcoTrack_UI_and_List_Navigation.md) and [visual design](ui/google-stitch/DESIGN.md).

## Team and testing

- [Team contributions](TEAM_CONTRIBUTIONS.md): concise responsibility summary for all three members.
- [Development rules](IMPORTANT/EcoTrack_Core_Feature_Parallel_Development_Guide.md) and [repository coding guidance](IMPORTANT/EcoTrack_CODEX_Instructions_for_docs_IMPORTANT.txt).
- [Testing guides](testing/team-guides/): detailed web, API/performance and Android test cases.
- [Test evidence](testing/evidence/): recorded results, defects, screenshots and reports. Historical results do not establish current build status.
- [Map regression notes](team-plans/MAP-03_Implementation_Notes.md) and [query plans](team-plans/MAP-03_Query_Plans.json): retained at their existing paths because backend regression tests consume the JSON fixture.
- [Testing materials](test-docs/): test-plan template, SUS task list and calculator.
- [Additional SUS workbook](<usability test/Satori-SUS-Calculator.xls>): differs from the workbook in `test-docs`. Retained to preserve its contents.

## Reports and supporting material

- [Report documents](report/).
- [CV and portfolio dossier](CV_PORTFOLIO_PROJECT_DOSSIER.md): historical project material. Verify implementation and personal attribution before reusing claims.
- [Project proposal](<IMPORTANT/8 - SE - A Multi-Tenant SaaS Platform for Community-Driven.pdf>).

Superseded task backlogs, individual handoffs, generated planning previews and duplicate files were removed. A recoverable local copy is in `tmp/docs-cleanup-20261003`, which Git ignores. Their committed versions also remain in Git history. Keep future handoff details in pull requests and add documentation here only when it has lasting reference value.
