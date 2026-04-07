import React, { useEffect, useState } from 'react';
import {
  Box, Typography, CircularProgress, Alert, Button,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';

const API_BASE_URL = 'http://localhost:5000/api';

const T = {
  blue:      '#1B4F8A',
  blueMid:   '#2260A8',
  bg:        '#F4F6F8',
  border:    '#DDE1E7',
  t1:        '#111827',
  t2:        '#374151',
  t3:        '#6B7280',
  t4:        '#9CA3AF',
  sidebarBg: '#162032',
};

const VerifyEmail = ({ onGoToLogin }) => {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the URL.');
      return;
    }

    fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setStatus('error');
          setMessage(data.error);
        } else {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully!');
          window.history.replaceState({}, '', '/');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Cannot connect to server. Make sure the backend is running.');
      });
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', backgroundColor: T.sidebarBg, overflow: 'hidden' }}>

      {/* ── Left panel (branding) ── */}
      <Box sx={{
        flex: 1, display: { xs: 'none', md: 'flex' },
        flexDirection: 'column', justifyContent: 'center',
        px: '8%', position: 'relative', gap: 3,
      }}>
        <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <Box sx={{ position: 'absolute', width: 350, height: 350, top: '-80px', left: '-80px', borderRadius: '50%', background: 'radial-gradient(circle, #4A90D9 0%, transparent 70%)', opacity: 0.07 }} />
          <Box sx={{ position: 'absolute', width: 220, height: 220, bottom: '30px', right: '-20px', borderRadius: '50%', background: 'radial-gradient(circle, #4A90D9 0%, transparent 70%)', opacity: 0.05 }} />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 46, height: 46, borderRadius: '12px', backgroundColor: T.blue,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 4px rgba(27,79,138,0.28), 0 6px 18px rgba(27,79,138,0.4)',
          }}>
            <HealthAndSafetyIcon sx={{ fontSize: 23, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
              PredictHealth
            </Typography>
            <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.32)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Barangay Health Forecasting System
            </Typography>
          </Box>
        </Box>

        <Box>
          <Typography sx={{ fontSize: 26, fontWeight: 800, color: 'rgba(255,255,255,0.93)', letterSpacing: '-0.5px', lineHeight: 1.3, mb: 1.5 }}>
            Email Verification
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.75, maxWidth: 340 }}>
            We're confirming your email address to ensure secure access to the PredictHealth platform.
          </Typography>
        </Box>

        <Box sx={{ position: 'absolute', right: 0, top: '10%', bottom: '10%', width: '1px', backgroundColor: 'rgba(255,255,255,0.06)' }} />
      </Box>

      {/* ── Right panel (status card) ── */}
      <Box sx={{
        width: { xs: '100%', md: 420 }, flexShrink: 0,
        backgroundColor: T.bg, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        px: '36px', py: 4,
      }}>
        <Box sx={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>

          {/* Mobile logo */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mb: 3.5, justifyContent: 'center' }}>
            <Box sx={{ width: 38, height: 38, borderRadius: '10px', backgroundColor: T.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HealthAndSafetyIcon sx={{ fontSize: 20, color: '#fff' }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: T.t1 }}>PredictHealth</Typography>
              <Typography sx={{ fontSize: 10, color: T.t4, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Barangay Health Forecasting</Typography>
            </Box>
          </Box>

          {/* ── Loading ── */}
          {status === 'loading' && (
            <>
              <CircularProgress size={48} sx={{ color: T.blue, mb: 2.5 }} />
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: T.t1, letterSpacing: '-0.3px', mb: 0.5 }}>
                Verifying Your Email
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: T.t3 }}>
                Please wait while we confirm your email address…
              </Typography>
            </>
          )}

          {/* ── Success ── */}
          {status === 'success' && (
            <>
              <Box sx={{
                width: 64, height: 64, borderRadius: '16px', mx: 'auto', mb: 2.5,
                backgroundColor: 'rgba(76,175,80,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckCircleIcon sx={{ fontSize: 36, color: '#4CAF50' }} />
              </Box>
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: T.t1, letterSpacing: '-0.3px', mb: 0.5 }}>
                Email Verified!
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: T.t3, mb: 2.5 }}>
                {message}
              </Typography>
              <Alert severity="success" sx={{ mb: 3, borderRadius: '9px', fontSize: 12, py: 0.5, textAlign: 'left' }}>
                Your account is now active. You can sign in to access the dashboard.
              </Alert>
              <Button fullWidth variant="contained" onClick={onGoToLogin}
                endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                sx={{
                  py: 1.15, backgroundColor: T.blue, fontSize: 13.5, fontWeight: 700,
                  textTransform: 'none', borderRadius: '9px',
                  boxShadow: '0 2px 12px rgba(27,79,138,0.28)', letterSpacing: '0.1px',
                  '&:hover': { backgroundColor: T.blueMid, boxShadow: '0 4px 18px rgba(27,79,138,0.36)', transform: 'translateY(-1px)' },
                  '&:active': { transform: 'translateY(0px)' },
                  transition: 'all 0.18s ease',
                }}>
                Go to Sign In
              </Button>
            </>
          )}

          {/* ── Error ── */}
          {status === 'error' && (
            <>
              <Box sx={{
                width: 64, height: 64, borderRadius: '16px', mx: 'auto', mb: 2.5,
                backgroundColor: 'rgba(233,78,119,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ErrorIcon sx={{ fontSize: 36, color: '#E94E77' }} />
              </Box>
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: T.t1, letterSpacing: '-0.3px', mb: 0.5 }}>
                Verification Failed
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: T.t3, mb: 2.5 }}>
                We couldn't verify your email address.
              </Typography>
              <Alert severity="error" sx={{ mb: 3, borderRadius: '9px', fontSize: 12, py: 0.5, textAlign: 'left' }}>
                {message}
              </Alert>
              <Button fullWidth variant="contained" onClick={onGoToLogin}
                endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                sx={{
                  py: 1.15, backgroundColor: T.blue, fontSize: 13.5, fontWeight: 700,
                  textTransform: 'none', borderRadius: '9px',
                  boxShadow: '0 2px 12px rgba(27,79,138,0.28)', letterSpacing: '0.1px',
                  '&:hover': { backgroundColor: T.blueMid, boxShadow: '0 4px 18px rgba(27,79,138,0.36)', transform: 'translateY(-1px)' },
                  '&:active': { transform: 'translateY(0px)' },
                  transition: 'all 0.18s ease',
                }}>
                Go to Sign In
              </Button>
            </>
          )}

          <Typography sx={{ fontSize: 11, color: T.t4, textAlign: 'center', mt: 2.5, lineHeight: 1.6 }}>
            Authorized barangay health personnel only.
          </Typography>

        </Box>
      </Box>
    </Box>
  );
};

export default VerifyEmail;
