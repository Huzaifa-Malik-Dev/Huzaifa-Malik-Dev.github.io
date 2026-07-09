const AVATAR_COLORS = ['blue', 'teal', 'grape', 'orange', 'cyan', 'lime', 'violet', 'pink', 'indigo', 'yellow'];

// Stable color per name, so the same person always gets the same avatar color everywhere in the app.
export function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
}
