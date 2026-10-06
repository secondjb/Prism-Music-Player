import { createTheme } from '@mui/material/styles';

export const prismDarkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1',
    },
    background: {
      default: '#09090b',
      paper: 'rgba(20, 20, 26, 0.95)',
    },
    text: {
      primary: '#ffffff',
      secondary: '#a1a1aa',
    },
  },
  typography: {
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  components: {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#18181b',
          color: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          fontSize: '11px',
          fontWeight: 500,
          borderRadius: '8px',
          padding: '4px 8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 8%, #141416)',
          backgroundImage: 'none',
          border: '1px solid color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, rgba(255, 255, 255, 0.12))',
          borderRadius: '14px',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 12px 36px -4px rgba(0, 0, 0, 0.75), 0 0 16px color-mix(in srgb, var(--color-stop-1, #6366f1) 18%, transparent)',
          color: '#e4e4e7',
          padding: '4px',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '12px',
          borderRadius: '8px',
          padding: '6px 10px',
          margin: '2px 0',
          gap: '10px',
          '&:hover': {
            backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 22%, transparent)',
            color: '#ffffff',
          },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          color: 'var(--color-stop-1, #6366f1)',
          height: 4,
          padding: '13px 0',
        },
        thumb: {
          height: 14,
          width: 14,
          backgroundColor: '#ffffff',
          border: '2px solid var(--color-stop-1, #6366f1)',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
          '&:hover, &.Mui-focusVisible, &.Mui-active': {
            boxShadow: '0 0 0 6px color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
          },
        },
        track: {
          height: 4,
          borderRadius: 2,
          border: 'none',
          backgroundColor: 'var(--color-stop-1, #6366f1)',
        },
        rail: {
          height: 4,
          borderRadius: 2,
          opacity: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
        },
        mark: {
          backgroundColor: 'rgba(255, 255, 255, 0.35)',
          height: 4,
          width: 4,
          borderRadius: '50%',
          '&.MuiSlider-markActive': {
            opacity: 0.9,
            backgroundColor: '#ffffff',
          },
        },
        markLabel: {
          color: '#71717a',
          fontSize: '11px',
          fontFamily: 'monospace',
          fontWeight: 600,
          '&.MuiSlider-markLabelActive': {
            color: '#e4e4e7',
          },
        },
        valueLabel: {
          lineHeight: 1.2,
          fontSize: '11px',
          background: '#18181b',
          padding: '3px 8px',
          borderRadius: '8px',
          border: '1px solid color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, rgba(255, 255, 255, 0.15))',
          color: '#ffffff',
          fontFamily: 'monospace',
          fontWeight: 700,
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.6)',
          '&::before': {
            display: 'none',
          },
        },
      },
    },
  },
});
