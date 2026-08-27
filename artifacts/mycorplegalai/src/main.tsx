import { createRoot } from "react-dom/client";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Generated API hooks use root-relative endpoint paths. Configure them with
// the same API origin as the portal's hand-written requests; otherwise a
// deployed portal with VITE_API_URL set posts the access code to its static
// origin instead of the API. Keep the bearer token getter live so tokens
// issued at login are used by subsequent generated requests.
setBaseUrl(import.meta.env.VITE_API_URL || null);
setAuthTokenGetter(() => localStorage.getItem("auth_token"));

createRoot(document.getElementById("root")!).render(<App />);
