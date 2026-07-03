import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const root = document.getElementById("root")!;

if (root.innerHTML.trim()) {
  hydrateRoot(root, <App />);
} else {
  createRoot(root).render(<App />);
}
