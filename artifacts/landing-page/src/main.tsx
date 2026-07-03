import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const root = document.getElementById("root")!;

// The app is wrapped in <ClerkProvider>, whose auth-aware rendering doesn't
// match the static prerendered markup (which only covers the home route),
// so we client-render instead of hydrating to avoid hydration mismatches.
// The prerendered HTML is still served for SEO and first paint; React then
// mounts the identical Home tree on "/" with no visible change.
createRoot(root).render(<App />);
