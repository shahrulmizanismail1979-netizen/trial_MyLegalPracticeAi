# Universal Build Prompt

Use this prompt in Build Mode after approving the plan for each phase.

---

Implement the approved plan for "[PHASE-ID]" only.

Before changing anything, read:

- "/replit.md";
- "/docs/PROJECT_CHARTER.md";
- "/docs/ARCHITECTURE.md";
- "/docs/PHASES.md";
- "/docs/status/current-phase.json";
- the approved plan for "[PHASE-ID]";
- the previous phase completion report.

Follow these rules:

1. Preserve every previously passing feature and test.
2. Work only within the approved phase scope.
3. Do not begin work assigned to a later phase.
4. Do not change the selected technology stack unless the approved plan contains a written Architecture Decision Record.
5. Do not introduce mock implementations into production code.
6. Do not use hard-coded success responses.
7. Do not suppress errors merely to make tests pass.
8. Do not remove or weaken an existing security, provenance, rights, review, or audit control.
9. Do not process real restricted legal documents.
10. Do not send documents to an external AI service.
11. Use synthetic fixtures for all testing.
12. Make processing operations idempotent and resumable where the phase concerns files or background jobs.
13. Run the relevant tests after each logical implementation task.
14. Where a user interface is added or changed, perform browser-based App Testing.
15. Where a migration is created, test both applying the migration and starting the application with the migrated database.
16. Where a requested function cannot be implemented safely in the present environment, return "BLOCKED" and explain the exact limitation. Do not pretend the function works.

Before declaring completion, run:

- formatting checks;
- lint checks;
- TypeScript type checks;
- unit tests;
- integration tests;
- relevant end-to-end tests;
- security checks relevant to this phase.

Create:

"/docs/reports/[PHASE-ID]-completion.md"

The report must contain:

- status: "PASS", "PARTIAL", or "BLOCKED";
- objective;
- implementation summary;
- files created;
- files changed;
- database migrations;
- dependencies added or removed;
- test commands;
- test results;
- browser-testing results;
- synthetic fixtures used;
- evidence that each acceptance criterion passed;
- defects discovered;
- limitations;
- security implications;
- privacy implications;
- rights or licensing implications;
- rollback instructions;
- recommended next phase.

Update:

"/docs/status/current-phase.json"

Use this exact response structure at the end:

PHASE:
STATUS:
CHECKPOINT:
FILES CHANGED:
MIGRATIONS:
TESTS PASSED:
TESTS FAILED:
APP TESTING:
ACCEPTANCE CRITERIA:
KNOWN LIMITATIONS:
SECURITY FINDINGS:
RIGHTS OR PRIVACY FINDINGS:
NEXT PHASE STARTED: NO

If any mandatory acceptance criterion fails, the status cannot be "PASS".

Stop after producing the completion report. Do not begin another phase.
