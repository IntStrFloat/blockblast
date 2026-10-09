// Local React Native debugger only. No network hosts outside the task's Metro.
const fs = require('fs');
(async () => {
  const targets = await (await fetch('http://localhost:8081/json/list')).json();
  const target = targets.find((entry) => entry.title.startsWith('com.intstrfloat.blockblast '));
  if (!target) throw new Error('Task app debugger unavailable');
  const expression = fs.readFileSync(process.argv[2], 'utf8');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const timeout = setTimeout(() => { ws.close(); process.exitCode = 1; }, 15000);
  ws.addEventListener('open', () => ws.send(JSON.stringify({
    id: 1, method: 'Runtime.evaluate',
    params: { expression, returnByValue: true, awaitPromise: true },
  })));
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== 1) return;
    clearTimeout(timeout);
    console.log(JSON.stringify(message.result ?? message.error));
    ws.close();
  });
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
