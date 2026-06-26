import { createRoot } from "react-dom/client";

import App from "./App";

import "./styles.css";

// NOTE: StrictMode intentionally omitted — it double-invokes render in dev,
// which is noticeable on a canvas-heavy app. Re-enable if you want the extra
// dev-time checks.
createRoot(document.getElementById("root")!).render(<App />);
