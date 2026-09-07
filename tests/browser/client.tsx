import * as React from "react";
import { hydrateRoot } from "react-dom/client";
import { App } from "./app";

hydrateRoot(document.getElementById("root") as HTMLElement, <App />, {
    onRecoverableError(error) {
        const errors = document.getElementById("errors");
        if (errors) errors.textContent += `${String(error)}\n`;
    },
});
