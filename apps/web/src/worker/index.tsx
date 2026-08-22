import { Hono } from "hono";
import { renderToReadableStream } from "react-dom/server";
import { App } from "@/react/App";

type Bindings = {
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("*", async (c) => {
  const stream = await renderToReadableStream(<App url={c.req.path} />, {
    bootstrapModules: ["/src/client/main.tsx"],
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

export default app;
