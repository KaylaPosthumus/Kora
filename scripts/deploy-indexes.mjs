/**
 * Creates the composite indexes in firestore.indexes.json, through the Firestore
 * Admin REST API. What `firebase deploy --only firestore:indexes` does — see
 * scripts/deploy-rules.mjs for why the CLI is not used.
 *
 *   node scripts/deploy-indexes.mjs
 *
 * Index builds are asynchronous: this returns once each is accepted, not once it
 * is ready. An index that already exists comes back 409 and is reported as such
 * rather than failing the run, so this is safe to re-run.
 */
import { readFileSync } from "node:fs";
import { JWT } from "google-auth-library";

const PROJECT = process.env.FIREBASE_PROJECT_ID ?? "kora-51711";
const key = JSON.parse(readFileSync("serviceAccountKey.json", "utf8"));
const client = new JWT({
  email: key.client_email,
  key: key.private_key,
  scopes: ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/datastore"],
});
const { token } = await client.getAccessToken();

const { indexes } = JSON.parse(readFileSync("firestore.indexes.json", "utf8"));
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/collectionGroups`;

let created = 0, existing = 0;
for (const index of indexes) {
  const label = `${index.collectionGroup} (${index.fields.map((f) => f.fieldPath).join(", ")})`;
  const res = await fetch(`${base}/${index.collectionGroup}/indexes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ queryScope: index.queryScope ?? "COLLECTION", fields: index.fields }),
  });
  const text = await res.text();

  if (res.ok) { created++; console.log(`  created  ${label}`); continue; }
  if (res.status === 409) { existing++; console.log(`  exists   ${label}`); continue; }
  throw new Error(`${label} -> ${res.status} ${text.slice(0, 300)}`);
}
console.log(`\n${created} created, ${existing} already present, ${indexes.length} declared.`);
console.log("Builds are asynchronous — watch the console's Indexes tab until all show Enabled.");
