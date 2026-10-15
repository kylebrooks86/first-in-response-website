// CI-only test runner: suppress Node's enormous data: module source dump
// when synthetic TypeScript fixture imports throw. Do not swallow failures.
const testPath = process.argv[2];
if (!testPath || !/^\.\/test-[a-z0-9-]+\.mjs$/.test(testPath)) {
  console.error("Usage: node scripts/run-ci-regression.mjs ./test-name.mjs");
  process.exit(2);
}
try {
  await import(new URL(testPath, import.meta.url).href);
} catch (cause) {
  const error = cause instanceof Error ? cause : new Error(String(cause));
  console.error(`FAIL: ${error.name}: ${error.message}`);
  const lines = String(error.stack || "").split("\n").filter((line) =>
    !line.includes("data:text/javascript;base64,"));
  for (const line of lines.slice(0, 12)) console.error(line);
  process.exitCode = 1;
}
