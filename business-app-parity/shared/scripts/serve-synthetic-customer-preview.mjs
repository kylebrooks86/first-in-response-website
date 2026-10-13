/** Local-only review server. Never deploys, serves app routes or reads customer sources. */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url), ts = require('typescript');
export async function startSyntheticCustomerPreview(port = 0) {
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) throw Error('Invalid preview port.');
  const files = new Map();
  for (const name of ['store', 'backup', 'vault', 'repository']) {
    files.set(`/local-customer-${name}.js`, ['text/javascript', compile(`../lib/local-customer-${name}.ts`)]);
  }
  files.set('/view.js', ['text/javascript', compile('../components/local-customer-view.ts')]);
  files.set('/controller.js', ['text/javascript', compile('../lib/synthetic-customer-controller.ts')]);
  files.set('/preview-bootstrap.js', ['text/javascript', compile('../synthetic-customers-preview/bootstrap.ts')]);
  files.set('/', ['text/html', readFileSync(new URL('../synthetic-customers-preview/index.html', import.meta.url))]);
  files.set('/preview.css', ['text/css', readFileSync(new URL('../synthetic-customers-preview/preview.css', import.meta.url))]);
  function compile(file) {
    let js = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    }).outputText;
    for (const name of ['store', 'backup', 'vault', 'repository']) {
      js = js.replaceAll(`'./local-customer-${name}'`, `'/local-customer-${name}.js'`)
        .replaceAll(`'../lib/local-customer-${name}'`, `'/local-customer-${name}.js'`);
    }
    return js.replaceAll("'../components/local-customer-view'", "'/view.js'")
      .replaceAll("'../lib/synthetic-customer-controller'", "'/controller.js'");
  }
  const server = createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
    const file = files.get(req.url);
    if (!file) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', `${file[0]}; charset=utf-8`); res.end(file[1]);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const preview = await startSyntheticCustomerPreview(Number(process.env.FIRE_SYNTHETIC_PREVIEW_PORT || 0));
  console.log(`Synthetic-only review screen: ${preview.origin}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await preview.close(); process.exit(0); });
}
