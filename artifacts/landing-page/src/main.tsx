import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { rootExperience } from "./route-selection";

const root = document.getElementById("root")!;

function routePath(pathname: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  if (base && (pathname === base || pathname.startsWith(`${base}/`))) {
    return pathname.slice(base.length) || "/";
  }
  return pathname || "/";
}

// Keep Vite development and HMR entirely free of service-worker control.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`);
  });
}

// A hosting rewrite can serve the prerendered homepage index for any deep
// route. Never hydrate that homepage as /lawyes, /sign-in, or an admin page:
// remove the mismatched shell and let the route-aware App client-render it.
// The route marker is emitted by each HTML shell and is intentionally stricter
// than checking whether #root happens to contain elements.
const prerenderedRoute = root.dataset.ssrPath;
const currentRoute = routePath(window.location.pathname);
const urlParams = new URLSearchParams(window.location.search);
const rootNeedsBrowserRoute =
  currentRoute === "/" &&
  (window.location.search !== "" ||
    rootExperience(window.location.search, window.location.hash) === "marketing");
const contributeNeedsBrowserUrlState =
  currentRoute === "/contribute" && urlParams.get("type") === "judgment";

if (
  root.children.length > 0 &&
  prerenderedRoute === currentRoute &&
  !rootNeedsBrowserRoute &&
  !contributeNeedsBrowserUrlState
) {
  hydrateRoot(root, <App />);
} else {
  root.replaceChildren();
  createRoot(root).render(<App />);
}
