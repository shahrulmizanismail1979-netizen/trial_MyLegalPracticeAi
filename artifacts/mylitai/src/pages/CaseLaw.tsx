/**
 * LAWYes Judgment Library — MyLitAI.
 *
 * The API derives the effective practice area from the lit session.  The
 * practiceArea prop retains the portal's normal civil-procedure context for
 * unrestricted identities without being relied upon as an access control.
 */
import { JudgmentLibrary, type CaseHomeRequest } from "@workspace/case-home-ui";

const caseLawRequest: CaseHomeRequest = (path, init = {}) =>
  fetch(path, {
    ...init,
    // Case-law access is authenticated by the existing lit.sid cookie.  Do not
    // replace this with a client-provided token or a portal-specific API base.
    credentials: "include",
  });

export default function CaseLawPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <JudgmentLibrary
          request={caseLawRequest}
          practiceArea="civil_procedure"
          accent="hsl(var(--primary))"
        />
      </div>
    </div>
  );
}