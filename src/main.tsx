import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import Speaker from "@/pages/Speaker";
import Viewer from "@/pages/Viewer";
import Projector from "@/pages/Projector";

const path = location.pathname;
const container = document.getElementById("root")!;

let app: React.ReactNode;
if (path.startsWith("/e/")) {
  app = <Viewer code={path.split("/").pop() || ""} />;
} else if (path === "/projector") {
  const code = new URLSearchParams(location.search).get("event") || "";
  app = <Projector code={code} />;
} else {
  app = <Speaker />;
}

createRoot(container).render(<StrictMode>{app}</StrictMode>);
