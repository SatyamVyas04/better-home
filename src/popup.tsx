import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import PopupApp from "./popup-app.tsx";

const rootElement = document.getElementById("popup-root");

if (!rootElement) {
  throw new Error("Popup root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>
);
