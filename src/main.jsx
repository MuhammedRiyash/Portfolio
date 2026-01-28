import React from "react";
import ReactDOM from "react-dom/client";
import { router } from "./routes/Router";
import { RouterProvider } from "react-router-dom";
import "../src/../index.css";
import { ProtectionLayer } from "./utils/security";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ProtectionLayer>
      <RouterProvider router={router} />
    </ProtectionLayer>
  </React.StrictMode>
);

