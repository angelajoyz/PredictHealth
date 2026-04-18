import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Tooltip, Dialog, DialogTitle, DialogContent, Divider } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
  CloudUpload as CloudUploadIcon,
  Logout as LogoutIcon,
  KeyboardArrowUp as ArrowUpIcon,
  ViewSidebar as ViewSidebarIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
  BarChart as BarChartIcon,
} from '@mui/icons-material';

// ── Design tokens ─────────────────────────────────────────────────────────────
export const T = {
  primary:       '#2563EB',
  success:       '#22C55E',
  pageBg:        '#F8FAFC',
  cardBg:        '#E0F2FE',
  neutralText:   '#64748B',
  blue:          '#2563EB',
  blueMid:       '#1D4ED8',
  blueDim:       '#EFF6FF',
  cardBg2:       '#FFFFFF',
  border:        '#E2E8F0',
  borderSoft:    '#F1F5F9',
  textHead:      '#0F172A',
  textBody:      '#1E293B',
  textMuted:     '#64748B',
  textFaint:     '#94A3B8',
  textDisabled:  '#CBD5E1',
  danger:        '#EF4444',
  dangerBg:      '#FEF2F2',
  dangerBorder:  '#FECACA',
  warn:          '#F59E0B',
  warnBg:        '#FFFBEB',
  warnBorder:    '#FDE68A',
  ok:            '#22C55E',
  okBg:          '#F0FDF4',
  okBorder:      '#BBF7D0',
  neutralBar:    '#64748B',
  neutralLight:  '#94A3B8',
  sidebarBg:      '#FFFFFF',
  sidebarHover:   '#EFF6FF',
  sidebarActive:  '#2563EB',
  sidebarDivider: '#E2E8F0',
  sidebarText:    '#1E293B',
  sidebarSub:     '#475569',
  sidebarMute:    '#94A3B8',
  sidebarAccent:  '#2563EB',
  increasing:    '#EF4444',
  decreasing:    '#22C55E',
  emerald:       '#2563EB',
  emeraldDark:   '#1D4ED8',
  emeraldGlow:   '#EFF6FF',
  emeraldSubtle: 'rgba(37,99,235,0.06)',
  neutral:       '#64748B',
  warning:       '#F59E0B',
  warnAccent:    '#F59E0B',
};

const NAV_SECTIONS = [
  {
    label: 'MAIN',
    items: [
      { Icon: DashboardIcon,   text: 'Prediction',      page: 'dashboard'  },
      { Icon: BarChartIcon,    text: 'Result/Analysis', page: 'prediction' },
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

const PredictHealthLogo = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="hg1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#2563EB" />
      </linearGradient>
      <linearGradient id="hg2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
    <path d="M50 85 C50 85 15 62 15 38 C15 26 24 18 35 18 C41 18 47 21 50 26 C53 21 59 18 65 18 C76 18 85 26 85 38 C85 62 50 85 50 85Z" fill="url(#hg1)" opacity="0.9"/>
    <path d="M50 26 C53 21 59 18 65 18 C76 18 85 26 85 38 C85 62 50 85 50 85 L50 26Z" fill="url(#hg2)" opacity="0.85"/>
    <polyline points="20,44 32,44 37,32 42,56 47,38 52,44 64,44" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <rect x="68" y="14" width="5" height="14" rx="1.5" fill="white" opacity="0.95"/>
    <rect x="64" y="18" width="13" height="5" rx="1.5" fill="white" opacity="0.95"/>
  </svg>
);

// ── Profile Dialog ─────────────────────────────────────────────────────────────
const ProfileDialog = ({ open, onClose }) => {
  const fullName = localStorage.getItem('fullName') || '';
  const username = localStorage.getItem('username') || '';
  const email    = localStorage.getItem('email') || '';

  const initials = fullName
    ? fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : username.slice(0, 2).toUpperCase();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '14px',
          border: `1px solid ${T.border}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
        },
      }}
    >
      <DialogTitle
        sx={{
          pb: 0, pt: 2.5, px: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textHead }}>My Profile</Typography>
        <Box onClick={onClose} sx={{ cursor: 'pointer', color: T.textMuted, display: 'flex', alignItems: 'center', borderRadius: '6px', p: 0.25, '&:hover': { color: T.danger, backgroundColor: T.dangerBg } }}>
          <CloseIcon sx={{ fontSize: 17 }} />
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 2.5, pb: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <Box sx={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: T.blueDim, border: `2px solid ${T.blue}`, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.25 }}>
            <Typography sx={{ fontSize: 22, fontWeight: 700, color: T.blue }}>{initials || '👤'}</Typography>
          </Box>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: T.textHead, lineHeight: 1.3 }}>
            {fullName || username || 'User'}
          </Typography>
        </Box>

        <Divider sx={{ mb: 2.5, borderColor: T.borderSoft }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
          {[
            { icon: <BadgeIcon sx={{ fontSize: 16, color: T.blue }} />, label: 'Full Name', value: fullName || '—' },
            { icon: <PersonIcon sx={{ fontSize: 16, color: T.blue }} />, label: 'Username', value: `@${username || '—'}` },
            { icon: <EmailIcon sx={{ fontSize: 16, color: T.blue }} />, label: 'Email', value: email || '—' },
          ].map(({ icon, label, value }) => (
            <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 34, height: 34, borderRadius: '8px', backgroundColor: T.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {icon}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 10.5, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</Typography>
                <Typography sx={{ fontSize: 13, color: T.textBody, fontWeight: 500, mt: 0.1 }}>{value}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({ currentPage, onNavigate, onLogout, isPublic = false }) => {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === null ? true : saved === 'true';
  });

  const toggleCollapsed = (val) => {
    const next = typeof val === 'boolean' ? val : !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebarCollapsed', String(next));
  };

  const [menuOpen,    setMenuOpen]    = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const footerRef = useRef(null);

  const fullName = localStorage.getItem('fullName') || '';
  const username = localStorage.getItem('username') || 'User';
  const email    = localStorage.getItem('email') || '';

  const initials = fullName
    ? fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : username.slice(0, 2).toUpperCase();

  useEffect(() => {
    const handler = (e) => {
      if (footerRef.current && !footerRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <Box sx={{
        width:           collapsed ? 64 : 220,
        minHeight:       '100vh',
        backgroundColor: T.sidebarBg,
        display:         'flex',
        flexDirection:   'column',
        flexShrink:      0,
        position:        'sticky',
        top:             0,
        height:          '100vh',
        overflowX:       'hidden',
        overflowY:       'auto',
        transition:      'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* ── Logo ── */}
        <Box sx={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: T.sidebarBg, flexShrink: 0 }}>
          <Tooltip title="Go to Dashboard" placement="right">
            <Box
              onClick={() => onNavigate?.('dashboard')}
              sx={{
                display: 'flex', alignItems: 'center',
                gap: 1.25, px: collapsed ? 0 : 2,
                justifyContent: collapsed ? 'center' : 'flex-start',
                minHeight: 64, cursor: 'pointer',
                transition: 'background 0.13s',
                '&:hover': { backgroundColor: T.sidebarHover },
              }}
            >
              <Box sx={{ flexShrink: 0, lineHeight: 0 }}>
                <PredictHealthLogo size={collapsed ? 28 : 30} />
              </Box>
              {!collapsed && (
                <Typography sx={{
                  fontSize: 14.5, fontWeight: 700, letterSpacing: '0.3px',
                  background: 'linear-gradient(90deg, #38BDF8 0%, #2563EB 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text', userSelect: 'none', whiteSpace: 'nowrap',
                }}>
                  PredictHealth
                </Typography>
              )}
            </Box>
          </Tooltip>
        </Box>

        {/* ── Nav ── */}
        <Box sx={{ flex: 1, px: collapsed ? 0.75 : 1.5, pt: 1 }}>

          {collapsed && (
            <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'center' }}>
              <Tooltip title="Expand sidebar" placement="right">
                <Box
                  onClick={() => toggleCollapsed(false)}
                  sx={{
                    width: 28, height: 28, borderRadius: '6px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: T.sidebarMute,
                    transition: 'background 0.13s, color 0.13s',
                    '&:hover': { backgroundColor: T.sidebarHover, color: T.sidebarAccent },
                  }}
                >
                  <ViewSidebarIcon sx={{ fontSize: 17 }} />
                </Box>
              </Tooltip>
            </Box>
          )}

          {/* Filter out DATA section for public users */}
          {NAV_SECTIONS
            .filter(section => isPublic ? section.label === 'MAIN' : true)
            .map((section, sectionIdx) => (
            <Box key={section.label} sx={{ mb: 2 }}>
              {!collapsed ? (
                <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5, mb: 0.5 }}>
                  <Typography sx={{
                    fontSize: 9.5, fontWeight: 600, letterSpacing: '1px',
                    textTransform: 'uppercase', color: T.sidebarMute, flex: 1,
                  }}>
                    {section.label}
                  </Typography>
                  {sectionIdx === 0 && (
                    <Tooltip title="Collapse sidebar" placement="right">
                      <Box
                        onClick={() => toggleCollapsed(true)}
                        sx={{
                          width: 20, height: 20, borderRadius: '4px', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: T.sidebarMute,
                          transition: 'background 0.13s, color 0.13s',
                          '&:hover': { backgroundColor: T.sidebarHover, color: T.sidebarAccent },
                        }}
                      >
                        <ViewSidebarIcon sx={{ fontSize: 14 }} />
                      </Box>
                    </Tooltip>
                  )}
                </Box>
              ) : (
                <Box sx={{ height: '1px', backgroundColor: T.sidebarDivider, mb: 0.75 }} />
              )}

              {section.items.map(({ Icon, text, page }) => {
                const active = currentPage === page;
                const item = (
                  <Box
                    key={page}
                    onClick={() => onNavigate?.(page)}
                    sx={{
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      gap:            collapsed ? 0 : 1,
                      px:             collapsed ? 0 : 1.25,
                      py:             0.875,
                      mb:             0.25,
                      borderRadius:   '8px',
                      cursor:         'pointer',
                      backgroundColor: active ? T.sidebarActive : 'transparent',
                      transition:     'background 0.13s',
                      '&:hover':      { backgroundColor: active ? T.sidebarActive : T.sidebarHover },
                    }}
                  >
                    <Icon sx={{ fontSize: 17, flexShrink: 0, color: active ? '#FFFFFF' : T.sidebarSub }} />
                    {!collapsed && (
                      <Typography sx={{
                        fontSize: 13, fontWeight: active ? 600 : 400,
                        color: active ? '#FFFFFF' : T.sidebarSub,
                        whiteSpace: 'nowrap',
                      }}>
                        {text}
                      </Typography>
                    )}
                  </Box>
                );

                return collapsed
                  ? (
                    <Tooltip key={page} title={text} placement="right" arrow
                      componentsProps={{ tooltip: { sx: { fontSize: 12, backgroundColor: T.sidebarActive } }, arrow: { sx: { color: T.sidebarActive } } }}>
                      {item}
                    </Tooltip>
                  )
                  : item;
              })}
            </Box>
          ))}
        </Box>

        {/* ── Footer / User ── */}
        <Box ref={footerRef} sx={{ borderTop: `1px solid ${T.sidebarDivider}`, position: 'relative' }}>

          {isPublic ? (
            // ── Public: Sign In button ──
            <Tooltip title={collapsed ? 'Sign In' : ''} placement="right">
              <Box
                onClick={() => onLogout?.()}
                sx={{
                  px: collapsed ? 0 : 1.5, py: 1.25,
                  display: 'flex', alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: collapsed ? 0 : 1.125,
                  cursor: 'pointer', transition: 'background 0.13s',
                  '&:hover': { backgroundColor: T.sidebarHover },
                }}
              >
                <Box sx={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: T.blueDim,
                  border: `1.5px solid #BFDBFE`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <PersonIcon sx={{ fontSize: 15, color: T.blue }} />
                </Box>
                {!collapsed && (
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.blue }}>
                    Sign In
                  </Typography>
                )}
              </Box>
            </Tooltip>
          ) : (
            // ── Authenticated: Profile + Sign Out ──
            <>
              {menuOpen && (
                <Box sx={{
                  position: 'absolute', bottom: '100%', left: 8, right: 8, mb: 0.5,
                  backgroundColor: '#FFFFFF', border: `1px solid ${T.sidebarDivider}`,
                  borderRadius: '10px', overflow: 'hidden',
                  boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
                }}>
                  <Box
                    onClick={() => { setMenuOpen(false); setProfileOpen(true); }}
                    sx={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      gap: collapsed ? 0 : 1,
                      px: collapsed ? 0 : 1.5, py: 1.1, cursor: 'pointer',
                      transition: 'background 0.13s',
                      '&:hover': { backgroundColor: T.sidebarHover },
                    }}
                  >
                    <PersonIcon sx={{ fontSize: 15, color: T.sidebarAccent }} />
                    {!collapsed && (
                      <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: T.sidebarText }}>Profile</Typography>
                    )}
                  </Box>

                  <Box sx={{ height: '1px', backgroundColor: T.sidebarDivider, mx: 1 }} />

                  <Box
                    onClick={() => { setMenuOpen(false); onLogout?.(); }}
                    sx={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      gap: collapsed ? 0 : 1,
                      px: collapsed ? 0 : 1.5, py: 1.1, cursor: 'pointer',
                      transition: 'background 0.13s',
                      '&:hover': { backgroundColor: '#FEF2F2' },
                    }}
                  >
                    <LogoutIcon sx={{ fontSize: 15, color: '#EF4444' }} />
                    {!collapsed && (
                      <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: '#EF4444' }}>Sign out</Typography>
                    )}
                  </Box>
                </Box>
              )}

              <Tooltip title={collapsed ? (fullName || email || username) : ''} placement="right">
                <Box
                  onClick={() => setMenuOpen(o => !o)}
                  sx={{
                    px: collapsed ? 0 : 1.5, py: 1.25,
                    display: 'flex', alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: collapsed ? 0 : 1.125,
                    cursor: 'pointer', transition: 'background 0.13s',
                    '&:hover': { backgroundColor: T.sidebarHover },
                  }}
                >
                  <Box sx={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    backgroundColor: T.blueDim,
                    border: `1.5px solid ${menuOpen ? T.primary : '#BFDBFE'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'border 0.13s',
                  }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: T.blue, lineHeight: 1 }}>
                      {initials || '👤'}
                    </Typography>
                  </Box>

                  {!collapsed && (
                    <>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{
                          fontSize: 12, fontWeight: 600, color: T.sidebarText,
                          lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {fullName || username}
                        </Typography>
                        <Typography sx={{
                          fontSize: 10, color: T.sidebarMute,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {email || username}
                        </Typography>
                      </Box>
                      <ArrowUpIcon sx={{
                        fontSize: 14, color: T.sidebarMute, flexShrink: 0,
                        transition: 'transform 0.2s',
                        transform: menuOpen ? 'rotate(0deg)' : 'rotate(180deg)',
                      }} />
                    </>
                  )}
                </Box>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>

      {/* ── Profile Dialog ── */}
      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
};

export default Sidebar;