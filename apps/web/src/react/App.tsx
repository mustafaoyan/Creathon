import { Button } from "@/react/components/ui/button";

export function App({ url }: { url: string }) {
  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>my-app</title>
        <link rel="stylesheet" href="/src/styles/globals.css" />
      </head>
      <body>
        <div id="root">
          <main className="flex min-h-screen flex-col items-center justify-center gap-4">
            <h1 className="text-2xl font-bold">my-app</h1>
            <p className="text-muted-foreground">Render edilen path: {url}</p>
            <Button>Shadcn Button</Button>
          </main>
        </div>
      </body>
    </html>
  );
}
