import { hydrateRoot } from "react-dom/client";
import { App } from "@/react/App";

hydrateRoot(document, <App url={window.location.pathname} />);
