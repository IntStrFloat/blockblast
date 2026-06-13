const http = require('node:http');
const path = require('node:path');

const { createApi } = require('./server.cjs');

const port = Number(process.env.PORT ?? 8787);
const api = createApi({
  apiKey: process.env.API_KEY ?? '',
  dataPath: process.env.DATA_PATH ?? path.join(__dirname, 'data', 'store.json'),
});

const server = http.createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 2_000_000) {
      res.writeHead(413);
      res.end();
      return;
    }
  }

  try {
    const result = await api.handle({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body,
    });
    res.writeHead(result.status, {
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(result.json === null ? '' : JSON.stringify(result.json));
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'internal_error' }));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Bloxx backend listening on 127.0.0.1:${port}`);
});
