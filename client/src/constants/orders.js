// Mirrors of the server's own Order enums (server/utils/constants.js) - the server is the source
// of truth and re-validates every write; these exist purely so the Selects can render without a
// round-trip. Change one, change the other. Previously these were copy-pasted inline into
// BackofficePage.jsx, which meant the dropdown could silently drift out of sync with what the
// server would actually accept.

export const ORDER_STATUS = ['New', 'E& In-process', 'On Hold', 'Activated', 'Closed', 'Cancelled'];

// Post-completion reconciliation flag, the successor to the old 'In Line'/'Not In Line' statuses.
// Setting 'Linked' locks the order for non-admins - see server/services/workflow.js setOrderLinked.
export const LINKED_STATUS = ['Linked', 'Not Linked'];

// Statuses at which `linked` becomes settable — "post-completion", per the business rule.
export const ORDER_DONE_STATUSES = ['Activated', 'Closed'];

// e&'s own processing status - separate from ORDER_STATUS (our internal fulfillment workflow) and
// separate again from the correction-request lock, which the orders table labels "Correction
// Pending" rather than reusing this list's "On Hold".
export const ETISALAT_STATUS = ['Submitted', 'In Progress', 'On Hold', 'Pending for delivery', 'Activated', 'Rejected', 'Closed'];
