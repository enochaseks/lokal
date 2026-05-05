// Minimal Deno type stubs so VS Code doesn't report errors in edge function files.
// These files run on Deno in Supabase and are not compiled by the project's tsconfig.
declare namespace Deno {
  const env: {
    get(key: string): string | undefined;
  };
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
}
