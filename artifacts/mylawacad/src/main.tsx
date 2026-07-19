import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@/lib/api-client";

setBaseUrl("/api/acad");

createRoot(document.getElementById("root")!).render(<App />);
