/**
 * Deploys firestore.rules and storage.rules through the Firebase Rules REST API.
 *
 * What `firebase deploy --only firestore:rules,storage` does, without the CLI.
 * On this project the CLI cannot authenticate with a service account: it fails
 * with "Premature close" fetching an OAuth token, on both v13 and v15, inside a
 * sandbox and outside it. The key itself is fine — `google-auth-library`, which
 * the CLI bundles, gets a token with the same key and the same scopes in one
 * call. So the blockage is the CLI's own invocation, and this goes around it.
 *
 *   BUCKET=<storage bucket> node scripts/deploy-rules.mjs
 *
 * Needs GOOGLE_APPLICATION_CREDENTIALS-style access: it reads
 * serviceAccountKey.json from the repo root directly.
 */
import { readFileSync } from "node:fs";
import { JWT } from "google-auth-library";

const PROJECT = process.env.FIREBASE_PROJECT_ID ?? "kora-51711";
const key = JSON.parse(readFileSync("serviceAccountKey.json", "utf8"));
const client = new JWT({
  email: key.client_email,
  key: key.private_key,
  scopes: ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/firebase"],
});
const { token } = await client.getAccessToken();
const api = "https://firebaserules.googleapis.com/v1";

const call = async (method, path, body) => {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
};

/** Uploads a ruleset and points a release at it. */
const deploy = async (label, file, releaseId) => {
  const ruleset = await call("POST", `/projects/${PROJECT}/rulesets`, {
    source: { files: [{ name: file, content: readFileSync(file, "utf8") }] },
  });
  console.log(`  ${label}: ruleset ${ruleset.name.split("/").pop()} created`);

  const release = { name: `projects/${PROJECT}/releases/${releaseId}`, rulesetName: ruleset.name };
  try {
    await call("PATCH", `/projects/${PROJECT}/releases/${releaseId}`, { release });
    console.log(`  ${label}: release updated -> live`);
  } catch (e) {
    if (!/404|NOT_FOUND/.test(e.message)) throw e;
    await call("POST", `/projects/${PROJECT}/releases`, release);
    console.log(`  ${label}: release created -> live`);
  }
};

await deploy("firestore.rules", "firestore.rules", "cloud.firestore");
const bucket = process.env.BUCKET;
if (!bucket) throw new Error("Set BUCKET to the Storage bucket, e.g. kora-51711.firebasestorage.app");
await deploy("storage.rules", "storage.rules", `firebase.storage/${bucket}`);
console.log("done");
