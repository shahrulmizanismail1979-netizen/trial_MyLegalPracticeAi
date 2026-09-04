import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const root = document.getElementById("root")!;

// Keep Vite development and HMR entirely free of service-worker control.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`);
  });
}

// Production serves prerendered markup, which should stay visible while Clerk
// initializes. Vite's development HTML contains only the <!--ssr-outlet-->
// placeholder, so there is nothing to hydrate in that environment.
if (root.children.length > 0) {
  hydrateRoot(root, <App />);
} else {
  createRoot(root).render(<App />);
}
