import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
setBaseUrl(base);

createRoot(document.getElementById("root")!).render(<App />);
