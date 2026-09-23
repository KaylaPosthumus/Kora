/**
 * Public surface of the auth feature's components.
 *
 * Other features import from this barrel and never from a file beside it;
 * within this feature, import the file directly — routing a sibling through
 * here would make the barrel import itself.
 */

export { default as ProtectedRoute } from "./ProtectedRoute";
export { default as UnlinkedMessage } from "./UnlinkedMessage";
export { default as SignUpComplete } from "./SignUpComplete";
