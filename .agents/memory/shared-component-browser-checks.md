---
name: Shared-component browser checks
description: Defines the layout boundary for cross-artifact browser checks of shared UI.
---

Assert desktop and mobile layout against the shared component's own bounds unless the task explicitly includes the surrounding artifact shell.

**Why:** A host artifact can have independent layout debt, such as an overflowing navigation bar. Treating that as a shared-component failure blocks focused regression coverage and obscures which layer owns the defect.

**How to apply:** For shared UI embedded in multiple artifacts, verify reachability, content, and overflow on the component root. Add whole-document assertions only when the acceptance criteria include the host page layout.