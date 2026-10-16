import React from "react";
import ReactDOM from "react-dom/client";
import ThemeController from "./theme/ThemeController";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ThemeController>
      <App />
    </ThemeController>
  </React.StrictMode>
);
