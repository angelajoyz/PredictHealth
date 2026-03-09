import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
  CloudUpload as CloudUploadIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  Logout as LogoutIcon,
  KeyboardArrowUp as ArrowUpIcon,
} from '@mui/icons-material';

// ── Design tokens ─────────────────────────────────────────────────────────────
export const T = {
  // Primary accent — one blue only
  blue:         '#1B4F8A',
  blueMid:      '#2260A8',
  blueDim:      '#EBF1F9',

  // Backgrounds
  pageBg:       '#F4F6F8',
  cardBg:       '#FFFFFF',
  rowBg:        '#FAFBFC',

  // Borders
  border:       '#DDE1E7',
  borderSoft:   '#EAECF0',

  // Text
  textHead:     '#111827',
  textBody:     '#374151',
  textMuted:    '#6B7280',
  textFaint:    '#9CA3AF',
  textDisabled: '#D1D5DB',

  // Semantic — data meaning only, not decoration
  danger:        '#B91C1C',
  dangerBg:      '#FEF2F2',
  dangerBorder:  '#FECACA',

  warn:          '#92400E',
  warnAccent:    '#D97706',
  warnBg:        '#FFFBEB',
  warnBorder:    '#FDE68A',

  ok:            '#166534',
  okBg:          '#F0FDF4',
  okBorder:      '#BBF7D0',

  // Neutral bars
  neutralBar:    '#6B7280',
  neutralLight:  '#9CA3AF',

  // Sidebar
  sidebarBg:      '#162032',
  sidebarHover:   'rgba(255,255,255,0.05)',
  sidebarActive:  'rgba(255,255,255,0.08)',
  sidebarDivider: 'rgba(255,255,255,0.06)',
  sidebarText:    'rgba(255,255,255,0.88)',
  sidebarSub:     'rgba(255,255,255,0.42)',
  sidebarMute:    'rgba(255,255,255,0.20)',
  sidebarAccent:  '#4A90D9',

  // Legacy aliases used by other pages
  increasing:    '#B91C1C',
  decreasing:    '#166534',
  emerald:       '#1B4F8A',
  emeraldDark:   '#2260A8',
  emeraldGlow:   '#EBF1F9',
  emeraldSubtle: 'rgba(27,79,138,0.06)',
  neutral:       '#6B7280',
  warning:       '#D97706',
};

const NAV_SECTIONS = [
  {
    label: 'MAIN',
    items: [
      { Icon: DashboardIcon,   text: 'Dashboard',   page: 'dashboard'  },
      { Icon: TrendingUpIcon,  text: 'Prediction',  page: 'prediction' },
    ],
  },
  {
    label: 'DATA',
    items: [
      { Icon: HistoryIcon,     text: 'History',     page: 'history'    },
      { Icon: CloudUploadIcon, text: 'Data Import', page: 'dataimport' },
    ],
  },
];

const Sidebar = ({ currentPage, onNavigate, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const footerRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (footerRef.current && !footerRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
  <Box sx={{
    width: 220,
    minHeight: '100vh',
    backgroundColor: T.sidebarBg,
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    borderRight: `1px solid ${T.sidebarDivider}`,
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto',
  }}>

    {/* Logo */}
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.25,
      px: 2, pt: 2.5, pb: 2.25,
      borderBottom: `1px solid ${T.sidebarDivider}`,
      mb: 1,
    }}>
      <Box sx={{
        width: 34, height: 34, borderRadius: '8px',
        backgroundColor: T.blue,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        boxShadow: `0 0 0 3px rgba(27,79,138,0.3), 0 4px 12px rgba(27,79,138,0.35)`,
      }}>
        <HealthAndSafetyIcon sx={{ fontSize: 17, color: '#fff' }} />
      </Box>
      <Box>
        <Typography sx={{ fontSize: 15.5, fontWeight: 600, color: T.sidebarText, lineHeight: 1.3 }}>
          PredictHealth
        </Typography>
        <Typography sx={{ fontSize: 8, color: T.sidebarSub, letterSpacing: '0.8px', textTransform: 'uppercase', mt: '1px' }}>
          
        </Typography>
      </Box>
    </Box>

    {/* Nav */}
    <Box sx={{ flex: 1, px: 1 }}>
      {NAV_SECTIONS.map(section => (
        <Box key={section.label} sx={{ mb: 2.25 }}>
          <Typography sx={{
            fontSize: 9, fontWeight: 600, letterSpacing: '1.2px',
            textTransform: 'uppercase', color: T.sidebarMute,
            px: 1, mb: 0.4,
          }}>
            {section.label}
          </Typography>

          {section.items.map(({ Icon, text, page }) => {
            const active = currentPage === page;
            return (
              <Box key={page} onClick={() => onNavigate?.(page)} sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1.125, py: 0.9, mb: 0.25,
                borderRadius: '7px', cursor: 'pointer', position: 'relative',
                backgroundColor: active ? T.sidebarActive : 'transparent',
                transition: 'background 0.13s',
                '&:hover': { backgroundColor: active ? T.sidebarActive : T.sidebarHover },
                '&::before': active ? {
                  content: '""', position: 'absolute',
                  left: 0, top: '22%', height: '56%', width: '2.5px',
                  borderRadius: '0 2px 2px 0',
                  backgroundColor: T.sidebarAccent,
                } : {},
              }}>
                <Icon sx={{ fontSize: 15, flexShrink: 0, color: active ? T.sidebarText : T.sidebarSub, opacity: active ? 1 : 0.8 }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: active ? 500 : 400, color: active ? '#fff' : T.sidebarSub, letterSpacing: 0.1 }}>
                  {text}
                </Typography>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>

    {/* Footer — click avatar to show sign out */}
      <Box ref={footerRef} sx={{ borderTop: `1px solid ${T.sidebarDivider}`, position: 'relative' }}>

        {/* Sign out popover — appears above footer */}
        {menuOpen && (
          <Box sx={{
            position: 'absolute', bottom: '100%', left: 8, right: 8, mb: 0.5,
            backgroundColor: '#1E2E45',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '9px',
            overflow: 'hidden',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.25)',
          }}>
            <Box
              onClick={() => { setMenuOpen(false); onLogout?.(); }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1.5, py: 1.1, cursor: 'pointer',
                transition: 'background 0.13s',
                '&:hover': { backgroundColor: 'rgba(185,28,28,0.15)' },
              }}
            >
              <LogoutIcon sx={{ fontSize: 14, color: '#F87171' }} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: '#F87171' }}>
                Sign out
              </Typography>
            </Box>
          </Box>
        )}

        {/* User row — clickable */}
        <Box
          onClick={() => setMenuOpen(o => !o)}
          sx={{
            px: 1.75, py: 1.4,
            display: 'flex', alignItems: 'center', gap: 1.125,
            cursor: 'pointer', transition: 'background 0.13s',
            '&:hover': { backgroundColor: T.sidebarHover },
          }}
        >
          <Box sx={{
            width: 28, height: 28, borderRadius: '50%',
            backgroundColor: menuOpen ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${menuOpen ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.12)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, flexShrink: 0, transition: 'background 0.13s',
          }}>
            👤
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 11.5, fontWeight: 500, color: T.sidebarText, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Admin User
            </Typography>
            <Typography sx={{ fontSize: 9.5, color: T.sidebarMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              admin@barangay.gov.ph
            </Typography>
          </Box>
          <ArrowUpIcon sx={{
            fontSize: 14, color: T.sidebarMute, flexShrink: 0,
            transition: 'transform 0.2s',
            transform: menuOpen ? 'rotate(0deg)' : 'rotate(180deg)',
          }} />
        </Box>
      </Box>
    </Box>
  );
};

export default Sidebar;