// Public entry point. Forwards normal Solana requests to the fork (and
// websocket subscriptions for trade confirmations), but blocks the fork's
// control commands unless the caller holds the admin token — so visitors
// can't mint balances or break the shared sandbox.
const http = require("http");
const net = require("net");

const PORT = process.env.PORT || 8080;
const ADMIN = process.env.ADMIN_TOKEN || "";
const blocked = (m) => typeof m === "string" && (m.startsWith("surfnet_") || m === "requestAirdrop");
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, solana-client, x-wexel-admin",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  if (req.method === "GET") { res.writeHead(200, { ...CORS, "content-type": "text/plain" }); return res.end("wexel paper sandbox"); }

  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    let parsed;
    try { parsed = JSON.parse(body.toString()); } catch { res.writeHead(400, CORS); return res.end(); }
    const calls = Array.isArray(parsed) ? parsed : [parsed];
    const isAdmin = ADMIN && req.headers["x-wexel-admin"] === ADMIN;

    if (!isAdmin && calls.some((c) => blocked(c.method))) {
      res.writeHead(403, { ...CORS, "content-type": "application/json" });
      return res.end(JSON.stringify({ jsonrpc: "2.0", id: calls[0]?.id ?? null,
        error: { code: -32601, message: "Not available on the public sandbox" } }));
    }

    const up = http.request({ host: "127.0.0.1", port: 8899, method: "POST", path: "/",
      headers: { "content-type": "application/json", "content-length": body.length } }, (r) => {
      res.writeHead(r.statusCode || 200, { ...CORS, "content-type": "application/json" });
      r.pipe(res);
    });
    up.on("error", () => { res.writeHead(502, CORS); res.end(); });
    up.end(body);
  });
});

// Websocket upgrades go straight to the fork's subscription port.
server.on("upgrade", (req, socket, head) => {
  const up = net.connect(8900, "127.0.0.1", () => {
    let raw = `${req.method} ${req.url} HTTP/1.1\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) raw += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
    up.write(raw + "\r\n");
    if (head?.length) up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on("error", () => socket.destroy());
  socket.on("error", () => up.destroy());
});

server.listen(PORT, "0.0.0.0", () => console.log(`[proxy] listening on ${PORT}`));
