import "dotenv/config";

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.log("DATABASE_URL is NOT set. Is the file named exactly .env, in this folder, saved as UTF-8?");
  process.exit(1);
}

// Split the string the way a strict parser does: scheme://user:password@host:port/db
const m = raw.match(/^(postgres(?:ql)?):\/\/([^:/@]*):(.*)@([^@/?#]+)(\/[^?#]*)?(\?.*)?$/);
if (!m) {
  console.log("Could not split the string into user / password / host. Masked view:");
  console.log(raw.replace(/(:\/\/[^:/@]*:).*@/, "$1***@"));
  process.exit(1);
}
const [, , user, password, hostPort, db = ""] = m;
const [host, port = "(none)"] = hostPort.split(":");

console.log("user    :", user);
console.log("host    :", host);
console.log("port    :", port);
console.log("database:", db);
console.log("password length:", password.length);

const problems = [];
if (/[\[\]]/.test(raw)) problems.push("Square brackets [ ] found. Remove them.");
if (/[@:/#?\s]/.test(password)) problems.push("Password contains a special character (@ : / # ? or a space) that breaks the URL. Reset it to letters and numbers only, or URL-encode it.");
if (!/^\d+$/.test(port) && port !== "(none)") problems.push("Port is not a number.");
console.log(problems.length ? "\nPROBLEMS:\n- " + problems.join("\n- ") : "\nThe structure looks valid.");