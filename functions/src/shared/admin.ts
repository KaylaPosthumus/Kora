/**
 * The one initialised Admin app for the whole functions package.
 *
 * Cloud Functions reuses a warm instance across invocations, and
 * `initializeApp()` throws if it runs twice in the same process. Every module
 * imports the accessors here rather than calling `initializeApp` itself.
 */

import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Initialisation is deferred rather than run at import time: a module that only
 * needs a type from here should not force credentials to resolve.
 */
const app = (): App => (getApps().length > 0 ? getApps()[0] : initializeApp());

export const auth = (): Auth => getAuth(app());

export const db = (): Firestore => getFirestore(app());
