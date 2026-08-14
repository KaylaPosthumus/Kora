/**
 * Seeds a Firestore project with the reference data the app needs plus one test
 * admin and one test employee.
 *
 * Run with:  npm run seed
 *
 * Needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service account key (see
 * .env.example). Safe to re-run — everything is written with a deterministic id
 * and merged, so a second run updates rather than duplicates.
 */
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";

const projectId = process.env.FIREBASE_PROJECT_ID;
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

initializeApp({
  projectId,
  credential: credentialsPath
    ? cert(JSON.parse(readFileSync(credentialsPath, "utf8")))
    : applicationDefault(),
});

const db = getFirestore();
const auth = getAuth();

// Reference data ---------------------------------------------------------------------------------

/** Document ids are the readable enum values, matching src/types/common.ts. */
const equipmentCategories = [
  { id: "cellphone", equipmentCatName: "Cellphone" },
  { id: "tablet", equipmentCatName: "Tablet" },
  { id: "laptop", equipmentCatName: "Laptop" },
  { id: "monitor", equipmentCatName: "Monitor" },
  { id: "headset", equipmentCatName: "Headset" },
  { id: "keyboard", equipmentCatName: "Keyboard" },
];

const leaveTypes = [
  {
    id: "annual",
    leaveTypeName: "Annual",
    description: "Paid time off for rest and holidays.",
    defaultDays: 15,
  },
  {
    id: "sick",
    leaveTypeName: "Sick",
    description: "Time off for illness or medical appointments.",
    defaultDays: 10,
  },
  {
    id: "family",
    leaveTypeName: "Family Responsibility",
    description: "Time off to care for an immediate family member.",
    defaultDays: 3,
  },
  {
    id: "parental",
    leaveTypeName: "Parental",
    description: "Leave following the birth or adoption of a child.",
    defaultDays: 20,
  },
  {
    id: "study",
    leaveTypeName: "Study",
    description: "Time off to prepare for or write exams.",
    defaultDays: 5,
  },
];

async function seedReferenceData() {
  const batch = db.batch();

  equipmentCategories.forEach(({ id, ...data }) =>
    batch.set(db.collection("equipmentCategories").doc(id), data, { merge: true })
  );

  leaveTypes.forEach(({ id, ...data }) =>
    batch.set(db.collection("leaveTypes").doc(id), data, { merge: true })
  );

  await batch.commit();
  console.log(
    `✔ reference data: ${equipmentCategories.length} equipment categories, ${leaveTypes.length} leave types`
  );
}

// Test accounts ----------------------------------------------------------------------------------

/** Creates an auth user if the address is free, otherwise reuses the existing one. */
async function ensureAuthUser({ email, password, fullName }) {
  try {
    const existing = await auth.getUserByEmail(email);
    console.log(`  ↳ auth user already exists: ${email}`);
    return existing;
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;

    const created = await auth.createUser({
      email,
      password,
      displayName: fullName,
      emailVerified: true,
    });
    console.log(`  ↳ created auth user: ${email}`);
    return created;
  }
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@kora.test";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Password123!";
  const fullName = "Ada Admin";

  const user = await ensureAuthUser({ email, password, fullName });

  // The role is mirrored into a custom claim so the security rules can check it
  // without a document read.
  await auth.setCustomUserClaims(user.uid, { role: "admin", adminId: user.uid });

  const batch = db.batch();

  // Reusing the uid as the admin document id keeps the mapping obvious.
  batch.set(
    db.collection("admins").doc(user.uid),
    { userId: user.uid, fullName, email, createdAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  batch.set(
    db.collection("users").doc(user.uid),
    {
      fullName,
      email,
      role: "admin",
      isLinked: true,
      adminId: user.uid,
      profilePicture: null,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
  console.log(`✔ admin seeded: ${email} / ${password}`);

  return { adminId: user.uid, fullName };
}

async function seedEmployee() {
  const email = process.env.SEED_EMPLOYEE_EMAIL ?? "employee@kora.test";
  const password = process.env.SEED_EMPLOYEE_PASSWORD ?? "Password123!";
  const fullName = "Evan Employee";

  const user = await ensureAuthUser({ email, password, fullName });
  await auth.setCustomUserClaims(user.uid, { role: "employee", employeeId: user.uid });

  const batch = db.batch();

  batch.set(
    db.collection("employees").doc(user.uid),
    {
      userId: user.uid,
      // Denormalised from the user doc so employee lists are a single query.
      fullName,
      email,
      profilePicture: null,

      gender: "other",
      dateOfBirth: "1995-04-12",
      phoneNumber: "0821234567",
      jobTitle: "Software Engineer",
      department: "Engineering",
      salaryAmount: 55000,
      payCycle: "monthly",
      lastPaidDate: null,
      employType: "fullTime",
      employDate: "2023-02-01",
      isSuspended: false,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    db.collection("users").doc(user.uid),
    {
      fullName,
      email,
      role: "employee",
      isLinked: true,
      employeeId: user.uid,
      profilePicture: null,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // One balance per leave type. The document id IS the leave type id — that's
  // what lets the approve-and-decrement run as a single transaction client-side.
  leaveTypes.forEach(({ id, leaveTypeName, description, defaultDays }) =>
    batch.set(
      db.collection("employees").doc(user.uid).collection("leaveBalances").doc(id),
      { leaveTypeId: id, leaveTypeName, description, defaultDays, remainingDays: defaultDays },
      { merge: true }
    )
  );

  await batch.commit();
  console.log(`✔ employee seeded: ${email} / ${password}`);

  return { employeeId: user.uid, fullName };
}

/** A couple of rows so the admin screens aren't empty on first run. */
async function seedSampleData({ employeeId, employeeName }) {
  const batch = db.batch();

  batch.set(
    db.collection("equipment").doc("seed-laptop"),
    {
      equipmentName: 'MacBook Pro 14"',
      equipmentCatId: "laptop",
      equipmentCategoryName: "Laptop",
      condition: "good",
      employeeId,
      assignedDate: "2023-02-01T08:00:00.000Z",
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    db.collection("equipment").doc("seed-monitor"),
    {
      equipmentName: 'Dell UltraSharp 27"',
      equipmentCatId: "monitor",
      equipmentCategoryName: "Monitor",
      condition: "new",
      // Unassigned, so it shows up in the assign-equipment pickers.
      employeeId: null,
      assignedDate: null,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    db.collection("leaveRequests").doc("seed-leave-request"),
    {
      employeeId,
      employeeName,
      leaveTypeId: "annual",
      leaveTypeName: "Annual",
      description: "Paid time off for rest and holidays.",
      defaultDays: 15,
      startDate: "2026-09-07",
      endDate: "2026-09-11",
      comment: "Family trip.",
      status: "pending",
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  );

  await batch.commit();
  console.log("✔ sample equipment and a pending leave request seeded");
}

// ------------------------------------------------------------------------------------------------

async function main() {
  console.log(`Seeding project: ${projectId ?? "(from credentials)"}\n`);

  await seedReferenceData();
  await seedAdmin();
  const { employeeId, fullName } = await seedEmployee();
  await seedSampleData({ employeeId, employeeName: fullName });

  console.log("\nDone. Sign in with the seeded accounts above.");
}

main().catch((error) => {
  console.error("\nSeeding failed:", error);
  process.exit(1);
});
