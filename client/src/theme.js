import { createTheme, DEFAULT_THEME } from '@mantine/core';

// swaps the two shades Mantine actually renders for filled/light variants
// (index 6 = base, index 5 = lighter/hover) onto a given hex pair
function swapShades(colorName, base, light) {
  const scale = [...DEFAULT_THEME.colors[colorName]];
  scale[5] = light;
  scale[6] = base;
  return scale;
}

export const theme = createTheme({
  primaryColor: 'red',
  primaryShade: 6,
  defaultRadius: 'md',
  colors: {
    dark: [
      '#e7edf7', // 0 text
      '#c3cee2', // 1
      '#93a1bd', // 2 muted / dimmed text
      '#5b6b8c', // 3
      '#2a3650', // 4 line / border
      '#1d293d', // 5 panel2 (hover surface)
      '#161f30', // 6 panel (card / surface bg)
      '#0f1623', // 7 page background
      '#0b111c', // 8
      '#070a10', // 9
    ],
    red: swapShades('red', '#e30613', '#ff3b4e'),
    blue: swapShades('blue', '#3b82f6', '#5b9bff'),
    violet: swapShades('violet', '#8b5cf6', '#a382ff'),
    green: swapShades('green', '#1db954', '#2fd06a'),
    yellow: swapShades('yellow', '#f6b73c', '#ffcb61'),
  },
  components: {
    // bg: 'dark.6' is a literal color reference, not scheme-aware - it would
    // stay navy even in light mode. --panel-bg (index.css) switches per
    // data-mantine-color-scheme, so use that instead.
    Paper: { styles: { root: { backgroundColor: 'var(--panel-bg)' } } },
    Card: { styles: { root: { backgroundColor: 'var(--panel-bg)' } } },
    // Toast palette: success = green, error = red (both readable on any background already).
    // Neutral/info toasts (color="gray") get the OPPOSITE of the current theme's background
    // instead of a same-toned gray, so they never blend into the page like a same-color toast
    // would - see --toast-neutral-bg/--toast-neutral-color in index.css.
    Notification: {
      styles: (_theme, props) =>
        props.color === 'gray'
          ? {
              root: { backgroundColor: 'var(--toast-neutral-bg)' },
              title: { color: 'var(--toast-neutral-color)' },
              description: { color: 'var(--toast-neutral-color)' },
              closeButton: { color: 'var(--toast-neutral-color)' },
            }
          : {},
    },
  },
});
