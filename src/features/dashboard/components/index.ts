/**
 * Public surface of the dashboard feature's components.
 *
 * Other features import from this barrel and never from a file beside it;
 * within this feature, import the file directly — routing a sibling through
 * here would make the barrel import itself.
 */

export { default as AdminCalendar } from "./AdminCalendar";
export { default as TopRatedEmpAdm } from "./TopRatedEmpAdm";
