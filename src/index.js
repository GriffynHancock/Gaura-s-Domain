// Thin Worker in front of the static assets:
//  - redirects bare `/` to `/crypto/`
//  - stamps every response with a header-hidden flag (devtools/Network-tab lesson,
//    used later — not wired into any module's UI yet)
const HEADER_FLAG = 'flag{check_the_headers}';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/') {
      return Response.redirect(url.origin + '/crypto/', 302);
    }

    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    out.headers.set('X-Ctf-Debug', HEADER_FLAG);
    return out;
  },
};
