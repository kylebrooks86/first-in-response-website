import { createHash } from "node:crypto";

if (!process.stdin.isTTY) {
  console.error("Run npm run hash:password in an interactive terminal.");
  process.exit(1);
}

process.stdout.write("Owner password (input hidden): ");
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");

let password = "";
for await (const character of process.stdin) {
  if (character === "\u0003") {
    process.stdin.setRawMode(false);
    process.stdout.write("\n");
    process.exit(130);
  }
  if (character === "\r" || character === "\n") break;
  if (character === "\u007f" || character === "\b") password = password.slice(0, -1);
  else password += character;
}

process.stdin.setRawMode(false);
process.stdin.pause();
process.stdout.write("\n");

if (password.length < 16) {
  console.error("Use a unique owner password with at least 16 characters.");
  process.exit(1);
}

console.log(createHash("sha256").update(password, "utf8").digest("hex"));
