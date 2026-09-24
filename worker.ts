type AssetFetcher = {
  fetch(request: Request): Promise<Response>;
};

interface Env {
  ASSETS: AssetFetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/login' || url.pathname === '/login/') {
      return Response.redirect(`${url.origin}/${url.search}`, 302);
    }

    return env.ASSETS.fetch(request);
  },
};