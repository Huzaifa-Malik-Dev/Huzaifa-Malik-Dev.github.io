// employeeId is stored as "DC16" - the URL just uses the bare number ("/hr/employees/16"),
// so this is the one place that strips the prefix, instead of every call site repeating it.
export const employeeUrlId = (employeeId) => (employeeId || '').replace(/^DC/i, '');
