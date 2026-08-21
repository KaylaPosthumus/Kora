import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registered only in a real build — a service worker in front of the dev server
// would sit between Vite and the browser and break hot reload. Failure to
// register is not worth surfacing to the user: the app runs fine without it,
// it just is not installable.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => console.error("Service worker registration failed", error));
  });
}
