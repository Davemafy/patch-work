import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import "@fontsource-variable/dm-sans";
import "@fontsource/dm-serif-display";
import "./styles.css";
import App from "./App";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {convexUrl ? (
      <ConvexProvider client={new ConvexReactClient(convexUrl)}>
        <App />
      </ConvexProvider>
    ) : (
      <MissingSetup />
    )}
  </React.StrictMode>,
);

function MissingSetup() {
  return (
    <main className="setup-page">
      <div className="brand brand--dark"><span className="brand-mark">P</span>Patch</div>
      <section className="setup-card">
        <p className="eyebrow">One setup step left</p>
        <h1>Patch needs its Convex address.</h1>
        <p>Run <code>npx convex dev</code>, then restart the app. The command writes <code>VITE_CONVEX_URL</code> to <code>.env.local</code>.</p>
      </section>
    </main>
  );
}
