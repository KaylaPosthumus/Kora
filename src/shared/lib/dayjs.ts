/**
 * The one place dayjs is configured.
 *
 * `dayjs.extend` mutates the single dayjs instance every module shares, so a
 * plugin registered anywhere is registered everywhere — which is exactly what
 * makes doing it inside a page dangerous. The routes are lazy, so a plugin
 * registered in one screen's module only exists once that screen's chunk has
 * been loaded: `relativeTime` lived in `AdminIndividualEmployee`, and every
 * other screen that called `.fromNow()` threw
 * `dayjs(...).fromNow is not a function` until an admin had happened to open
 * that one page first.
 *
 * Importing this module for its side effect — from the app shell and from the
 * test setup — registers them once, before any chunk can run.
 */

import dayjs from "dayjs";
import "dayjs/locale/en";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

dayjs.locale("en");

export default dayjs;
