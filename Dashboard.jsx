import { forecastAll, getSavedForecast, getDiseaseBreakdown } from './services/api';
import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Button,
  Alert, LinearProgress, Select, MenuItem as MenuItemComponent,
  CircularProgress, Skeleton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from '@mui/material';
import {
  InfoOutlined as InfoOutlinedIcon,
  Psychology as PsychologyIcon,
  CheckCircle as CheckCircleIcon,
  Group as GroupIcon,
  LocationOn as LocationOnIcon,
  CalendarMonth as CalendarIcon,
  TrendingUp as TrendIcon,
  ExpandMore as ExpandMoreIcon,
  Male as MaleIcon,
  Female as FemaleIcon,
  Warning as WarningIcon,
  ErrorOutline as ErrorOutlineIcon,
} from '@mui/icons-material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import Sidebar, { T } from './Sidebar';

const ALL_BARANGAYS = '__ALL__';

// ── Forecast months = from Jan to December of the forecast year (based on uploaded data)
const computeForecastParams = () => {
  const now = new Date();
  const datasetEndRaw = localStorage.getItem('datasetEndDate') || '';
  let forecastYear = now.getFullYear();

  if (datasetEndRaw) {
    const parsed = new Date(datasetEndRaw);
    if (!Number.isNaN(parsed.getTime())) {
      forecastYear = parsed.getFullYear() + (parsed.getMonth() === 11 ? 1 : 0); // If data ends Dec, forecast next year
    }
  }

  const reference = new Date(forecastYear, 0, 1); // Jan 1 of forecast year
  const endOfYear = new Date(forecastYear, 11, 1);
  const months = (endOfYear.getFullYear() - reference.getFullYear()) * 12
    + (endOfYear.getMonth() - reference.getMonth()) + 1;
  return { forecastMonths: Math.max(months, 1), referenceDate: reference };
};

const CATEGORY_MAP = {
  respiratory_cases:      { label: 'Respiratory',      color: '#0EA5E9', icon: '🫁' },
  dengue_cases:           { label: 'Dengue',            color: T.danger,  icon: '🦟' },
  covid_cases:            { label: 'COVID-19',          color: '#7C3AED', icon: '🦠' },
  cardiovascular_cases:   { label: 'Cardiovascular',   color: '#EF4444', icon: '❤️' },
  urinary_cases:          { label: 'Urinary/Renal',    color: '#F59E0B', icon: '🩺' },
  gastrointestinal_cases: { label: 'Gastrointestinal', color: '#10B981', icon: '🫃' },
  diabetes_cases:         { label: 'Diabetes',         color: T.warn,    icon: '🩸' },
  skin_cases:             { label: 'Skin Disease',     color: '#F97316', icon: '🩹' },
  musculoskeletal_cases:  { label: 'Musculoskeletal',  color: '#6366F1', icon: '🦴' },
  injury_cases:           { label: 'Injury/Trauma',    color: '#DC2626', icon: '🏥' },
  infectious_cases:       { label: 'Other Infectious', color: '#059669', icon: '🦠' },
  tuberculosis_cases:     { label: 'Tuberculosis',     color: '#92400E', icon: '🫁' },
  viral_infection_cases:  { label: 'Viral Infection',  color: '#8B5CF6', icon: '🧬' },
  blood_metabolic_cases:  { label: 'Blood/Metabolic',  color: '#BE185D', icon: '🩸' },
  neurological_cases:     { label: 'Neurological',     color: '#1D4ED8', icon: '🧠' },
  sensory_cases:          { label: 'Eye/Ear',          color: '#0891B2', icon: '👁️' },
  mental_health_cases:    { label: 'Mental Health',    color: '#7C3AED', icon: '🧠' },
  maternal_cases:         { label: 'Maternal/OB',      color: '#EC4899', icon: '👶' },
  neoplasm_cases:         { label: 'Neoplasm/Cancer',  color: '#374151', icon: '🔬' },
  leptospirosis_cases:    { label: 'Leptospirosis',    color: '#065F46', icon: '🐀' },
  diarrhea_cases:         { label: 'Diarrhea',         color: '#0EA5E9', icon: '💧' },
  hypertension_cases:     { label: 'Hypertension',     color: '#F87171', icon: '❤️' },
  malnutrition_cases:     { label: 'Malnutrition',     color: '#A3A3A3', icon: '⚕️' },
  malnutrition_prevalence_pct: { label: 'Malnutrition %', color: '#A3A3A3', icon: '⚕️' },
};

const getDiseaseInfo = (col) => {
  if (CATEGORY_MAP[col]) return CATEGORY_MAP[col];
  const label = col
    .replace(/_cases$/, '').replace(/_prevalence_pct$/, ' %')
    .replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return { label, color: T.blue, icon: '🏥' };
};

const trendColor  = (t) => t === 'increasing' ? T.danger   : t === 'decreasing' ? T.ok      : T.textMuted;
const trendBg     = (t) => t === 'increasing' ? T.dangerBg : t === 'decreasing' ? T.okBg    : T.borderSoft;
const trendBorder = (t) => t === 'increasing' ? T.dangerBorder : t === 'decreasing' ? T.okBorder : T.border;

const getTrend = (preds) => {
  if (!preds || preds.length < 2) return 'stable';
  const diff = preds[preds.length - 1] - preds[0];
  return diff > 0.5 ? 'increasing' : diff < -0.5 ? 'decreasing' : 'stable';
};

const isForecastValid = (forecastDates) => {
  if (!forecastDates || forecastDates.length === 0) return false;
  const now       = new Date();
  const endOfYear = `${now.getFullYear()}-12`;
  return forecastDates[forecastDates.length - 1] >= endOfYear;
};

const SCard = ({ children, sx = {} }) => (
  <Card sx={{ borderRadius: '10px', backgroundColor: '#FFFFFF',
    border: `1px solid ${T.border}`, boxShadow: 'none', ...sx }}>
    {children}
  </Card>
);

const SelectSx = {
  backgroundColor: '#FFFFFF', borderRadius: '8px', fontSize: 13,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.blue },
  '& .MuiSelect-select': { py: '7px', px: '12px' },
};

const tooltipStyle = {
  borderRadius: '8px', border: `1px solid ${T.border}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: 12, color: T.textBody, background: '#FFFFFF',
};

const TrendRowIcon = ({ type }) => {
  const cfg = {
    increasing: { color: T.danger,    bg: T.dangerBg,   icon: '↑' },
    decreasing: { color: T.ok,        bg: T.okBg,       icon: '↓' },
    warning:    { color: T.warn,      bg: T.warnBg,     icon: '⚠' },
    stable:     { color: T.textMuted, bg: T.borderSoft, icon: '—' },
  };
  const c = cfg[type] || cfg.stable;
  return (
    <Box sx={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
      backgroundColor: c.bg, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: 11, fontWeight: 700, color: c.color }}>
      {c.icon}
    </Box>
  );
};

// ── Generation Progress Overlay ───────────────────────────────────────────────
const GenerationOverlay = ({ progress, total, currentBarangay, completedBarangays, failedBarangays, forecastMonths, referenceDate }) => {
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
  const startLabel = referenceDate
    ? referenceDate.toLocaleDateString('en-PH', { month: 'long' })
    : '—';
  const decYear = referenceDate ? referenceDate.getFullYear() : new Date().getFullYear();

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 1500,
      backgroundColor: 'rgba(15,23,42,0.72)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Box sx={{
        width: '92vw', maxWidth: 520,
        backgroundColor: '#FFFFFF', borderRadius: '16px',
        border: `1px solid ${T.border}`,
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        overflow: 'hidden',
      }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: `1px solid ${T.borderSoft}`, backgroundColor: T.pageBg }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '10px', backgroundColor: T.blueDim,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PsychologyIcon sx={{ fontSize: 18, color: T.blue }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textHead }}>Generating Forecasts</Typography>
              <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
                {startLabel} – December {decYear} · {forecastMonths} month{forecastMonths > 1 ? 's' : ''}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box sx={{ px: 3, pt: 2.5, pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.textBody }}>
              {progress} of {total} barangays
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.blue }}>{pct}%</Typography>
          </Box>
          <Box sx={{ height: 8, borderRadius: 4, backgroundColor: T.borderSoft, overflow: 'hidden' }}>
            <Box sx={{ height: '100%', borderRadius: 4, width: `${pct}%`,
              background: `linear-gradient(90deg, ${T.blue}, #3B82F6)`,
              transition: 'width 0.5s ease', boxShadow: `0 0 10px rgba(37,99,235,0.4)` }} />
          </Box>
          {currentBarangay && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.75, p: '9px 12px',
              borderRadius: '8px', backgroundColor: T.blueDim, border: `1px solid rgba(27,79,138,0.18)` }}>
              <CircularProgress size={12} thickness={5} sx={{ color: T.blue, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12, color: T.blue, fontWeight: 500 }}>
                Training model for <strong>{currentBarangay}</strong>…
              </Typography>
            </Box>
          )}
        </Box>
        {completedBarangays.length > 0 && (
          <Box sx={{ px: 3, pb: 1.5, maxHeight: 160, overflowY: 'auto' }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: T.textFaint,
              textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.75 }}>
              Completed ({completedBarangays.length})
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[...completedBarangays].reverse().map((b) => (
                <Box key={b} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '6px 10px',
                  borderRadius: '6px', backgroundColor: T.okBg, border: `1px solid ${T.okBorder}` }}>
                  <CheckCircleIcon sx={{ fontSize: 12, color: T.ok, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 12, color: T.ok, fontWeight: 500 }}>{b}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
        {failedBarangays.length > 0 && (
          <Box sx={{ px: 3, pb: 1.5 }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: T.textFaint,
              textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.75 }}>
              Failed ({failedBarangays.length})
            </Typography>
            {failedBarangays.map((b) => (
              <Box key={b} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '6px 10px',
                borderRadius: '6px', mb: '5px', backgroundColor: T.dangerBg, border: `1px solid ${T.dangerBorder}` }}>
                <ErrorOutlineIcon sx={{ fontSize: 12, color: T.danger, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12, color: T.danger, fontWeight: 500 }}>{b}</Typography>
              </Box>
            ))}
          </Box>
        )}
        <Box sx={{ mx: 3, mb: 2.5, p: '10px 12px', borderRadius: '8px',
          backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
          display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <WarningIcon sx={{ fontSize: 14, color: '#D97706', mt: '1px', flexShrink: 0 }} />
          <Typography sx={{ fontSize: 11.5, color: '#92400E', lineHeight: 1.55 }}>
            <strong>Please don't close or navigate away.</strong> The model is still training.
            Interrupting may result in incomplete or missing forecasts.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

// ── Navigate-Away Warning Dialog ──────────────────────────────────────────────
const NavigationBlockDialog = ({ open, onStay, onLeave }) => (
  <Dialog open={open} onClose={onStay} maxWidth="xs" fullWidth
    PaperProps={{ sx: { borderRadius: '14px', border: `1px solid ${T.border}` } }}>
    <DialogTitle sx={{ pb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: '8px', backgroundColor: T.dangerBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <WarningIcon sx={{ fontSize: 16, color: T.danger }} />
        </Box>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: T.textHead }}>Forecast in Progress</Typography>
      </Box>
    </DialogTitle>
    <Box sx={{ borderBottom: `1px solid ${T.borderSoft}`, mx: 3 }} />
    <DialogContent sx={{ pt: 2 }}>
      <Typography sx={{ fontSize: 13, color: T.textBody, lineHeight: 1.7, mb: 1.5 }}>
        A forecast generation is currently running. If you leave now, the process may be interrupted and some barangays may not have forecasts.
      </Typography>
      <Box sx={{ p: '10px 14px', borderRadius: '8px', backgroundColor: T.dangerBg, border: `1px solid ${T.dangerBorder}` }}>
        <Typography sx={{ fontSize: 12.5, color: T.danger, lineHeight: 1.6 }}>
          ⚠️ Incomplete forecasts cannot be recovered. You will need to run Generate All again.
        </Typography>
      </Box>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
      <Button onClick={onLeave} sx={{ textTransform: 'none', fontSize: 13, color: T.textMuted,
        border: `1px solid ${T.border}`, borderRadius: '8px', px: 2 }}>
        Leave Anyway
      </Button>
      <Button onClick={onStay} variant="contained"
        sx={{ textTransform: 'none', fontSize: 13, fontWeight: 600,
          backgroundColor: T.blue, borderRadius: '8px', px: 2, '&:hover': { backgroundColor: T.blueMid } }}>
        Stay on Page
      </Button>
    </DialogActions>
  </Dialog>
);

// ── Regenerate Confirm Dialog ──────────────────────────────────────────────────
const RegenerateConfirmDialog = ({ open, forecastMonths, barangayCount, referenceDate, onConfirm, onCancel }) => {
  const startLabel = referenceDate ? referenceDate.toLocaleDateString('en-PH', { month: 'long' }) : '—';
  const decYear = referenceDate ? referenceDate.getFullYear() : new Date().getFullYear();
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: '14px', border: `1px solid ${T.border}` } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: '8px', backgroundColor: T.warnBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <WarningIcon sx={{ fontSize: 16, color: T.warn }} />
          </Box>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: T.textHead }}>Regenerate Forecasts?</Typography>
        </Box>
      </DialogTitle>
      <Box sx={{ borderBottom: `1px solid ${T.borderSoft}`, mx: 3 }} />
      <DialogContent sx={{ pt: 2 }}>
        <Typography sx={{ fontSize: 13, color: T.textBody, lineHeight: 1.7, mb: 1.5 }}>
          You already have saved forecasts. Generating again will <strong>delete all existing forecasts</strong> and replace them with new ones.
        </Typography>
        <Box sx={{ p: '10px 14px', borderRadius: '8px', backgroundColor: T.warnBg, border: `1px solid ${T.warnBorder}` }}>
          <Typography sx={{ fontSize: 12.5, color: T.textBody, lineHeight: 1.6 }}>
            📅 Will generate <strong>{forecastMonths} month{forecastMonths > 1 ? 's' : ''}</strong> of forecasts
            ({startLabel} – December {decYear}) for <strong>{barangayCount} barangay{barangayCount > 1 ? 's' : ''}</strong>.
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 1.5 }}>
          This action cannot be undone. Are you sure you want to continue?
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onCancel} sx={{ textTransform: 'none', fontSize: 13, color: T.textMuted,
          border: `1px solid ${T.border}`, borderRadius: '8px', px: 2 }}>
          Cancel
        </Button>
        <Button onClick={onConfirm} variant="contained"
          sx={{ textTransform: 'none', fontSize: 13, fontWeight: 600,
            backgroundColor: T.warn, borderRadius: '8px', px: 2, '&:hover': { backgroundColor: '#D97706' } }}>
          Yes, Regenerate
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Expandable Result Row ──────────────────────────────────────────────────────
const ResultRow = ({ item, forecastData, selectedBarangay }) => {
  const [isOpen,    setIsOpen]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [breakdown, setBreakdown] = useState(null);
  const city = localStorage.getItem('datasetCity') || '';

  useEffect(() => { setIsOpen(false); setBreakdown(null); }, [selectedBarangay]);

  const handleToggle = async () => {
    if (item.type === 'warning' || !item.disease) return;
    const next = !isOpen;
    setIsOpen(next);
    if (next && !breakdown) {
      setLoading(true);
      try {
        const catKey = item.disease.replace('_cases', '');
        const data   = await getDiseaseBreakdown(catKey, selectedBarangay, city, 6);
        setBreakdown(data);
      } catch (e) {
        setBreakdown({ breakdown: [], monthly_trend: [] });
      } finally {
        setLoading(false);
      }
    }
  };

  const info          = item.disease ? getDiseaseInfo(item.disease) : null;
  const preds         = item.disease ? (forecastData?.predictions?.[item.disease] || []) : [];
  const nextVal       = Math.round(preds[0] ?? 0);
  const canExpand     = item.type !== 'warning' && !!item.disease;
  const effectiveType = item.type === 'warning' ? 'increasing' : item.type;

  return (
    <Box>
      <Box onClick={canExpand ? handleToggle : undefined} sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, p: '10px 14px',
        borderRadius: isOpen ? '8px 8px 0 0' : '8px',
        backgroundColor: trendBg(effectiveType), border: `1px solid ${trendBorder(effectiveType)}`,
        cursor: canExpand ? 'pointer' : 'default', transition: 'all 0.15s',
        '&:hover': canExpand ? { opacity: 0.88 } : {},
      }}>
        <TrendRowIcon type={item.type} />
        <Typography sx={{ fontSize: 12.5, color: T.textBody, lineHeight: 1.5, flex: 1 }}>{item.text}</Typography>
        {canExpand && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0,
            px: '10px', py: '3px', borderRadius: '20px',
            backgroundColor: '#FFFFFF', border: `1px solid ${trendBorder(effectiveType)}` }}>
            <Typography sx={{ fontSize: 11, color: trendColor(effectiveType), fontWeight: 600 }}>
              {isOpen ? 'Hide' : 'Details'}
            </Typography>
            <ExpandMoreIcon sx={{ fontSize: 14, color: trendColor(effectiveType),
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </Box>
        )}
      </Box>

      {isOpen && canExpand && (
        <Box sx={{ borderRadius: '0 0 8px 8px', border: `1px solid ${trendBorder(effectiveType)}`,
          borderTop: 'none', backgroundColor: '#FAFBFC' }}>
          {loading ? (
            <Box sx={{ p: '14px 16px', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[1,2,3].map(i => <Skeleton key={i} variant="rectangular" height={34} sx={{ borderRadius: '6px' }} />)}
            </Box>
          ) : breakdown?.breakdown?.length > 0 ? (
            <Box sx={{ p: '14px 16px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Box sx={{ fontSize: 14 }}>{info?.icon}</Box>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: T.textFaint,
                  textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Top specific diseases — {info?.label}
                </Typography>
                {nextVal > 0 && (
                  <Box sx={{ ml: 'auto', px: '8px', py: '2px', borderRadius: '20px',
                    backgroundColor: trendBg(item.type), border: `1px solid ${trendBorder(item.type)}` }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: trendColor(item.type) }}>
                      {nextVal.toLocaleString()} projected next month
                    </Typography>
                  </Box>
                )}
              </Box>
              {breakdown.breakdown.map((entry, idx) => {
                const maxCases  = breakdown.breakdown[0]?.total_cases || 1;
                const pct       = Math.round((entry.total_cases / maxCases) * 100);
                const barColors = [info?.color || T.blue, '#60A5FA', '#34D399', '#FBBF24', '#A78BFA'];
                const barColor  = barColors[idx] || info?.color || T.blue;
                return (
                  <Box key={idx} sx={{ mb: 1.25 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: idx === 0 ? 600 : 400,
                        color: idx === 0 ? T.textHead : T.textBody, flex: 1, mr: 1, lineHeight: 1.4 }}>
                        {idx === 0 ? '★ ' : ''}{entry.label}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                        {entry.total_male > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                            <MaleIcon sx={{ fontSize: 11, color: '#3B82F6' }} />
                            <Typography sx={{ fontSize: 11, color: T.textMuted }}>{entry.total_male.toLocaleString()}</Typography>
                          </Box>
                        )}
                        {entry.total_female > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                            <FemaleIcon sx={{ fontSize: 11, color: '#EC4899' }} />
                            <Typography sx={{ fontSize: 11, color: T.textMuted }}>{entry.total_female.toLocaleString()}</Typography>
                          </Box>
                        )}
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.textHead, minWidth: 48, textAlign: 'right' }}>
                          {entry.total_cases.toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ height: 5, borderRadius: 3, backgroundColor: T.borderSoft, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', borderRadius: 3, width: `${pct}%`,
                        backgroundColor: barColor, transition: 'width 0.45s ease' }} />
                    </Box>
                  </Box>
                );
              })}
              {breakdown.monthly_trend?.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: T.textFaint,
                    textTransform: 'uppercase', letterSpacing: '0.5px', mb: 1 }}>
                    Historical trend — {breakdown.breakdown[0]?.label}
                  </Typography>
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={breakdown.monthly_trend} margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                      <XAxis dataKey="period" axisLine={false} tickLine={false}
                        tick={{ fontSize: 9, fill: T.textFaint }} tickFormatter={v => v.slice(5)} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: T.textFaint }} />
                      <RechartsTooltip contentStyle={{ ...tooltipStyle, fontSize: 11 }} />
                      <Line type="monotone" dataKey="cases" stroke={info?.color || T.blue}
                        strokeWidth={2} dot={false} activeDot={{ r: 3, fill: info?.color || T.blue }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}
              {breakdown.breakdown[0] && (
                <Box sx={{ mt: 1.5, p: '8px 12px', borderRadius: '6px',
                  backgroundColor: trendBg(item.type), border: `1px solid ${trendBorder(item.type)}` }}>
                  <Typography sx={{ fontSize: 12, lineHeight: 1.55,
                    color: trendColor(item.type) === T.textMuted ? T.textBody : trendColor(item.type) }}>
                    <strong>{breakdown.breakdown[0].label?.replace(/^[A-Z0-9]+\.?[0-9]*;\s*/, '')}</strong> has the highest recorded cases
                    in the <strong>{info?.label}</strong> category
                    {selectedBarangay !== ALL_BARANGAYS ? ` in ${selectedBarangay}` : ''}.
                    {item.type === 'increasing' && ` Monitor this closely — ${info?.label} cases is rising.`}
                    {item.type === 'decreasing' && ` ${info?.label} cases is declining — maintain interventions.`}
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ p: '14px 16px', textAlign: 'center' }}>
              <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>No specific disease breakdown available.</Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────────
const Dashboard = ({ onNavigate, onLogout }) => {
  const [selectedBarangay,    setSelectedBarangay]   = useState(() => localStorage.getItem('cachedForecastBarangay') || ALL_BARANGAYS);
  const [selectedDisease,     setSelectedDisease]    = useState(() => localStorage.getItem('cachedForecastDisease')  || 'all');
  const [availableBarangays,  setAvailableBarangays] = useState([]);
  const [availableDiseases,   setAvailableDiseases]  = useState([]);
  const [forecastLoading,     setForecastLoading]    = useState(false);
  const [fetchingForecast,    setFetchingForecast]   = useState(false);
  const [forecastError,       setForecastError]      = useState('');
  const [forecastData,        setForecastData]       = useState(() => {
    try { const s = localStorage.getItem('cachedForecastData'); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });
  const [generateAllProgress, setGenerateAllProgress] = useState(null);
  const [hasSavedForecasts,   setHasSavedForecasts]  = useState(false);
  const [forecastIsValid,     setForecastIsValid]    = useState(false);
  const [showConfirmDialog,   setShowConfirmDialog]  = useState(false);
  const [hasData,             setHasData]            = useState(false);
  const [uploadedInfo,        setUploadedInfo]       = useState(null);
  const [forecastHistory,     setForecastHistory]    = useState([]);
  const [diseaseSummary,      setDiseaseSummary]     = useState([]);
  const [totalForecasted,     setTotalForecasted]    = useState(0);
  const [latestForecastMonth, setLatestForecastMonth]= useState('N/A');
  const [hasDbData,           setHasDbData]          = useState(false);
  const [checkingData,        setCheckingData]       = useState(true);
  // ── Detects if a new file was uploaded after the last forecast generation ──
  const [hasNewUpload,        setHasNewUpload]       = useState(false);

  const [accumulatedChart, setAccumulatedChart] = useState(() => {
    try { const s = localStorage.getItem('cachedChartData'); return s ? JSON.parse(s) : {}; }
    catch { return {}; }
  });

  // ── Generation overlay state ────────────────────────────────────────────
  const [genOverlay, setGenOverlay] = useState({
    visible: false, progress: 0, total: 0, current: null, completed: [], failed: [],
  });

  // ── Navigation block state ──────────────────────────────────────────────
  const [navBlockDialog, setNavBlockDialog] = useState(false);
  const pendingNavRef   = useRef(null);
  const isGeneratingRef = useRef(false);

  const cityLabel = localStorage.getItem('datasetCity') || '';

  // ── Forecast params always based on current date ────────────────────────
  const { forecastMonths, referenceDate } = computeForecastParams();

  // Real current & next month (for stat cards)
  const realNow          = new Date();
  const realCurrentMonth = new Date(realNow.getFullYear(), realNow.getMonth(), 1);
  const realNextMonth    = new Date(realNow.getFullYear(), realNow.getMonth() + 1, 1);
  const realCurrentKey   = `${realCurrentMonth.getFullYear()}-${String(realCurrentMonth.getMonth() + 1).padStart(2, '0')}`;
  const realNextKey      = `${realNextMonth.getFullYear()}-${String(realNextMonth.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthLabel = realCurrentMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const nextMonthLabel    = realNextMonth.toLocaleDateString('en-PH',    { month: 'long', year: 'numeric' });

  // Chart range keys (same as referenceDate = today's month)
  const thisMonthDate = referenceDate;
  const thisMonthKey  = `${thisMonthDate.getFullYear()}-${String(thisMonthDate.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => { isGeneratingRef.current = forecastLoading; }, [forecastLoading]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isGeneratingRef.current) return;
      e.preventDefault();
      e.returnValue = 'A forecast is still generating. Are you sure you want to leave?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleNavigate = (page) => {
    if (isGeneratingRef.current) { pendingNavRef.current = page; setNavBlockDialog(true); return; }
    onNavigate?.(page);
  };
  const handleNavBlockStay  = () => { setNavBlockDialog(false); pendingNavRef.current = null; };
  const handleNavBlockLeave = () => {
    setNavBlockDialog(false);
    const page = pendingNavRef.current; pendingNavRef.current = null;
    onNavigate?.(page);
  };
  const handleLogout = () => {
    if (isGeneratingRef.current) { pendingNavRef.current = '__logout__'; setNavBlockDialog(true); return; }
    onLogout?.();
  };

  useEffect(() => {
    try {
      const up  = localStorage.getItem('uploadedData');
      if (up) setUploadedInfo(JSON.parse(up));
      const bar = localStorage.getItem('availableBarangays');
      if (bar) { const p = JSON.parse(bar); if (Array.isArray(p) && p.length > 0) { setAvailableBarangays(p); setHasDbData(true); } }
      const dis = localStorage.getItem('diseaseColumns');
      if (dis) setAvailableDiseases(JSON.parse(dis));
      const raw = localStorage.getItem('forecastHistory');
      if (raw) { const h = JSON.parse(raw); setForecastHistory(h); setHasData(h.length > 0); computeInsights(h); }
    } catch (e) { console.error(e); }

    const fetchDatasetInfo = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { setCheckingData(false); return; }
        const res = await fetch('http://localhost:5000/api/dataset-info', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) { setCheckingData(false); return; }
        const data = await res.json();
        if (data.barangays?.length > 0) {
          setAvailableBarangays(data.barangays);
          setHasDbData(true);
          localStorage.setItem('availableBarangays', JSON.stringify(data.barangays));
        }
        if (data.disease_columns?.length > 0) {
          setAvailableDiseases(data.disease_columns);
          localStorage.setItem('diseaseColumns', JSON.stringify(data.disease_columns));
        }
        if (data.city) localStorage.setItem('datasetCity', data.city);

        // ── Detect new upload vs last forecast generation ─────────────────
        try {
          const histRes = await fetch('http://localhost:5000/api/upload-history', {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (histRes.ok) {
            const histData = await histRes.json();
            if (Array.isArray(histData) && histData.length > 0) {
              const latest = histData.find(u => u.status === 'success');
              if (latest?.uploaded_at) {
                const latestUploadTime  = new Date(latest.uploaded_at).getTime();
                const lastForecastTime  = localStorage.getItem('lastForecastGeneratedAt')
                  ? new Date(localStorage.getItem('lastForecastGeneratedAt')).getTime()
                  : 0;
                if (latestUploadTime > lastForecastTime) {
                  setHasNewUpload(true);
                }
              }
            }
          }
        } catch (e) {
          console.error('Failed to fetch upload history:', e);
        }

        setHasSavedForecasts(data.has_saved_forecasts || false);
        if (data.has_saved_forecasts) {
          try {
            const city  = data.city || localStorage.getItem('datasetCity') || '';
            const saved = await getSavedForecast(ALL_BARANGAYS, city);
            if (saved) setForecastIsValid(isForecastValid(saved.forecast_dates));
          } catch (e) {}
        }
      } catch (e) {
        console.error('dataset-info fetch failed:', e);
      } finally {
        setCheckingData(false);
      }
    };
    fetchDatasetInfo();
  }, []);

  useEffect(() => {
    if (availableDiseases.length > 0 && selectedDisease !== 'all' && !availableDiseases.includes(selectedDisease)) {
      setSelectedDisease('all');
    }
  }, [availableDiseases]);

  useEffect(() => { if (selectedBarangay) localStorage.setItem('cachedForecastBarangay', selectedBarangay); }, [selectedBarangay]);
  useEffect(() => { localStorage.setItem('cachedForecastDisease', selectedDisease); }, [selectedDisease]);
  useEffect(() => {
    if (forecastData) { try { localStorage.setItem('cachedForecastData', JSON.stringify(forecastData)); } catch {} }
  }, [forecastData]);
  useEffect(() => {
    try { localStorage.setItem('cachedChartData', JSON.stringify(accumulatedChart)); } catch {}
  }, [accumulatedChart]);

  useEffect(() => {
    if (!hasDbData) return;
    const city = localStorage.getItem('datasetCity') || '';
    setFetchingForecast(true);
    setForecastError('');
    getSavedForecast(selectedBarangay, city)
      .then(result => {
        if (result) {
          setForecastData(result);
          setForecastIsValid(isForecastValid(result.forecast_dates));
          const diseases = result.disease_columns || Object.keys(result.predictions || {});
          setAccumulatedChart(prev => {
            const updated = { ...prev };
            (result.forecast_dates || []).forEach((date, i) => {
              const month = date.slice(0, 7);
              if (!(month in updated)) {
                let total = 0;
                diseases.forEach(d => { total += (result.predictions[d] || [])[i] || 0; });
                updated[month] = Math.round(total);
              }
            });
            return updated;
          });
        }
      })
      .catch(() => {})
      .finally(() => setFetchingForecast(false));
  }, [selectedBarangay, hasDbData]);

  const computeInsights = (history) => {
    if (!history?.length) return;
    const periods = history.map(h => h.period).filter(Boolean).sort();
    const latest  = periods[periods.length - 1] || 'N/A';
    setLatestForecastMonth(latest);
    setTotalForecasted(history.filter(h => h.period === latest).reduce((s, h) => s + (h.predictedValue || 0), 0));
    const dMap = {};
    history.forEach(item => {
      if (!dMap[item.disease]) dMap[item.disease] = { disease: item.disease, label: item.label || getDiseaseInfo(item.disease).label, values: [], trend: 'stable', latestValue: 0 };
      dMap[item.disease].values.push(item.predictedValue || 0);
      if (!dMap[item.disease].latestPeriod || item.period > dMap[item.disease].latestPeriod) {
        Object.assign(dMap[item.disease], { latestPeriod: item.period, latestValue: item.predictedValue || 0, trend: item.trend || 'stable' });
      }
    });
    setDiseaseSummary(Object.values(dMap));
  };

  const activeDiseases = forecastData
    ? (selectedDisease === 'all'
        ? Object.keys(forecastData.predictions || {})
        : [selectedDisease].filter(d => forecastData.predictions?.[d]))
    : [];

  const getSummaryStats = () => {
    if (!forecastData || activeDiseases.length === 0) return null;
    const dates    = forecastData.forecast_dates || [];
    if (dates.length === 0) return null;
    const dateKeys = dates.map(d => d.slice(0, 7));
    let currentIdx = dateKeys.indexOf(realCurrentKey);
    if (currentIdx < 0) {
      currentIdx = realCurrentKey < dateKeys[0] ? 0 : dateKeys.length - 1;
    }
    const nextIdx = Math.min(currentIdx + 1, dates.length - 1);
    const getValueAt = (idx, disease) => {
      if (idx < 0 || idx >= dates.length) return 0;
      return (forecastData.predictions[disease] || [])[idx] ?? 0;
    };
    const sumAt = (idx) => {
      if (idx < 0 || idx >= dates.length) return 0;
      return activeDiseases.reduce((s, d) => s + getValueAt(idx, d), 0);
    };
    // For single disease: round each value individually
    // For all diseases: round the sum
    let currentVal, nextVal;
    if (selectedDisease === 'all') {
      currentVal = Math.round(sumAt(currentIdx));
      nextVal    = Math.round(sumAt(nextIdx));
    } else {
      currentVal = Math.round(getValueAt(currentIdx, selectedDisease));
      nextVal    = Math.round(getValueAt(nextIdx, selectedDisease));
    }
    const diff       = nextVal - currentVal;
    const pct        = (diff / (currentVal || 1)) * 100;
    const trend      = diff > 0.5 ? 'increasing' : diff < -0.5 ? 'decreasing' : 'stable';
    return {
      currentVal, nextVal, trend,
      pct: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%',
      periodLabel: dates.length ? `${dateKeys[0]} – ${dateKeys[dateKeys.length - 1]}` : '',
      currentMonthFound: dateKeys[currentIdx],
      nextMonthFound:    dateKeys[nextIdx],
    };
  };

  const buildChartData = () => {
    const now = new Date();
    const forecastYear = forecastData?.forecast_dates?.[0]?.slice(0, 4) || now.getFullYear();

    // If the year is finished (current date > Dec 31 of forecast year), show no data
    if (now > new Date(parseInt(forecastYear), 11, 31)) {
      return [];
    }

    const historical = forecastData?.historical_data;
    const forecastDates = forecastData?.forecast_dates || [];
    const months = [];
    for (let month = 0; month < 12; month++) {
      const date = new Date(forecastYear, month, 1);
      months.push({
        month: date.toISOString().slice(0, 7), // YYYY-MM
        dateObj: date,
        isActual: false,
        value: null
      });
    }

    // Fill actual data where available
    if (historical?.dates) {
      historical.dates.forEach((histDate, idx) => {
        const histMonth = histDate.slice(0, 7);
        const monthEntry = months.find(m => m.month === histMonth);
        if (monthEntry) {
          let actualValue = 0;
          if (selectedDisease === 'all') {
            activeDiseases.forEach(d => {
              const series = historical[d] || [];
              actualValue += series[idx] || 0;
            });
          } else {
            const series = historical[selectedDisease] || [];
            actualValue = series[idx] || 0;
          }
          monthEntry.isActual = true;
          monthEntry.value = Math.round(actualValue);
        }
      });
    }

    // Fill forecast data where actual is not available
    forecastDates.forEach((fcDate, idx) => {
      const fcMonth = fcDate.slice(0, 7);
      const monthEntry = months.find(m => m.month === fcMonth);
      if (monthEntry && !monthEntry.isActual) {
        let forecastValue = 0;
        if (selectedDisease === 'all') {
          activeDiseases.forEach(d => {
            forecastValue += (forecastData.predictions[d] || [])[idx] || 0;
          });
        } else {
          forecastValue = (forecastData.predictions[selectedDisease] || [])[idx] || 0;
        }
        monthEntry.value = Math.round(forecastValue);
      }
    });

    // Return months with data, separating actual and predicted
    const actualData = months.filter(m => m.isActual).map(m => ({
      month: m.month,
      actual: m.value
    }));
    const predictedData = months.filter(m => !m.isActual && m.value !== null).map(m => ({
      month: m.month,
      predicted: m.value
    }));

    // Merge into a single array with both keys
    const allMonths = [...new Set([...actualData.map(d => d.month), ...predictedData.map(d => d.month)])].sort();
    return allMonths.map(month => {
      const actualEntry = actualData.find(d => d.month === month);
      const predictedEntry = predictedData.find(d => d.month === month);
      return {
        month,
        actual: actualEntry ? actualEntry.actual : null,
        predicted: predictedEntry ? predictedEntry.predicted : null
      };
    });
  };

  const buildTrendSummary = () => {
    const sourceData = forecastData
      ? activeDiseases.map(d => ({
          disease: d, label: getDiseaseInfo(d).label,
          trend: getTrend(forecastData.predictions?.[d] || []),
          pct: (() => {
            const p = forecastData.predictions?.[d] || [];
            if (p.length < 2) return '0%';
            const pct = ((p[p.length - 1] - p[0]) / (p[0] || 1)) * 100;
            return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
          })(),
        }))
      : (selectedDisease === 'all' ? diseaseSummary : diseaseSummary.filter(d => d.disease === selectedDisease));
    if (!sourceData.length) return [];
    const filtered = selectedDisease === 'all' ? sourceData : sourceData.filter(d => d.disease === selectedDisease);
    const items = [];
    filtered.forEach(d => {
      const loc = selectedBarangay === ALL_BARANGAYS ? 'all barangays' : selectedBarangay;
      if (d.trend === 'increasing')      items.push({ type: 'increasing', disease: d.disease, text: `${d.label} cases are projected to increase${d.pct ? ' by ' + d.pct : ''} in ${loc} — increased monitoring recommended.` });
      else if (d.trend === 'decreasing') items.push({ type: 'decreasing', disease: d.disease, text: `${d.label} cases are projected to decline${d.pct ? ' by ' + d.pct : ''} in ${loc} — positive outlook.` });
      else                               items.push({ type: 'stable',     disease: d.disease, text: `${d.label} cases are expected to remain stable in ${loc}.` });
    });
    const increasing = filtered.filter(d => d.trend === 'increasing');
    if (selectedDisease === 'all' && increasing.length >= 2)
      items.unshift({ type: 'warning', text: `${increasing.length} disease categories are trending upward simultaneously — consider prioritizing resources.` });
    return items;
  };

  // ── Generate click: new upload or no forecasts → go directly, else confirm ─
  const handleGenerateClick = () => {
    if (!hasDbData || availableBarangays.length === 0) {
      setForecastError('No dataset found. Please upload in Data Import first.');
      return;
    }
    if (!hasSavedForecasts || hasNewUpload) {
      runGenerate();
    } else {
      setShowConfirmDialog(true);
    }
  };

  const runGenerate = async () => {
    setShowConfirmDialog(false);
    setForecastLoading(true);
    setForecastError('');
    setAccumulatedChart({});
    localStorage.removeItem('cachedChartData');

    const total = availableBarangays.length;
    setGenOverlay({ visible: true, progress: 0, total, current: null, completed: [], failed: [] });

    try {
      const city  = localStorage.getItem('datasetCity') || '';
      const token = localStorage.getItem('token');
      const completedList = [];
      const failedList    = [];

      for (let i = 0; i < availableBarangays.length; i++) {
        const brgy = availableBarangays[i];
        setGenOverlay(prev => ({ ...prev, current: brgy, progress: i }));
        try {
          const res = await fetch('http://localhost:5000/api/forecast-from-db', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:    JSON.stringify({ barangay: brgy, diseases: availableDiseases, forecast_months: forecastMonths, city }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          completedList.push(brgy);
        } catch (e) {
          console.error(`Forecast failed for ${brgy}:`, e);
          failedList.push(brgy);
        }
        setGenOverlay(prev => ({ ...prev, progress: i + 1, completed: [...completedList], failed: [...failedList] }));
      }

      setHasSavedForecasts(true);
      setHasNewUpload(false);
      localStorage.setItem('lastForecastGeneratedAt', new Date().toISOString());
      setGenerateAllProgress({ completed: completedList.length, total });

      const saved = await getSavedForecast(selectedBarangay, city);
      if (saved) {
        setForecastData(saved);
        setForecastIsValid(isForecastValid(saved.forecast_dates));
        const diseases = saved.disease_columns || Object.keys(saved.predictions || {});
        setAccumulatedChart(() => {
          const updated = {};
          (saved.forecast_dates || []).forEach((date, idx) => {
            const month = date.slice(0, 7);
            let total = 0;
            diseases.forEach(d => { total += (saved.predictions[d] || [])[idx] || 0; });
            updated[month] = Math.round(total);
          });
          return updated;
        });
      }
      if (failedList.length > 0)
        setForecastError(`Done! ${completedList.length}/${total} barangays completed. ${failedList.length} failed.`);
    } catch (err) {
      setForecastError(err.message || 'Generate failed. Please try again.');
    } finally {
      setForecastLoading(false);
      setGenOverlay(prev => ({ ...prev, current: null }));
      setTimeout(() => {
        setGenOverlay(prev => ({ ...prev, visible: false }));
        setTimeout(() => setGenerateAllProgress(null), 4000);
      }, 1500);
    }
  };

  const stats      = getSummaryStats();
  const chartData  = buildChartData();
  const trendItems = buildTrendSummary();
  const totalThisMonth = forecastHistory.filter(h => h.period === realCurrentKey).reduce((s, h) => s + (h.predictedValue || 0), 0);
  const chartColor = selectedDisease !== 'all' && CATEGORY_MAP[selectedDisease]
    ? CATEGORY_MAP[selectedDisease].color : T.blue;

  const forecastPeriodLabel = (() => {
    if (stats?.periodLabel) return stats.periodLabel;
    if (forecastData?.forecast_dates?.length) {
      const dates = forecastData.forecast_dates;
      return `${dates[0].slice(0,7)} – ${dates[dates.length - 1].slice(0,7)}`;
    }
    const endOfYear = `${thisMonthDate.getFullYear()}-12`;
    return `${thisMonthKey} – ${endOfYear}`;
  })();

  const buttonDisabled = forecastLoading || !hasDbData;
  const buttonLabel    = forecastLoading ? 'Generating…' : 'Generate All';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: T.pageBg }}>

      {genOverlay.visible && (
        <GenerationOverlay
          progress={genOverlay.progress} total={genOverlay.total}
          currentBarangay={genOverlay.current} completedBarangays={genOverlay.completed}
          failedBarangays={genOverlay.failed} forecastMonths={forecastMonths}
          referenceDate={referenceDate}
        />
      )}

      <NavigationBlockDialog open={navBlockDialog} onStay={handleNavBlockStay} onLeave={handleNavBlockLeave} />

      <Sidebar currentPage="dashboard" onNavigate={handleNavigate} onLogout={handleLogout} />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        <Box sx={{ px: '24px', minHeight: 64, display: 'flex', alignItems: 'center', backgroundColor: '#FFFFFF',
          position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: T.textHead, letterSpacing: '-0.2px' }}>
            Barangay Health Dashboard
          </Typography>
        </Box>

        <Box sx={{ px: '24px', pt: '20px', pb: '28px', overflow: 'auto', flex: 1 }}>

          {!checkingData && !hasDbData && (
            <Alert severity="info" icon={<InfoOutlinedIcon fontSize="small" />}
              sx={{ mb: 2.5, borderRadius: '10px', backgroundColor: T.blueDim, color: T.textHead,
                border: `1px solid rgba(37,99,235,0.18)`, fontSize: 13, '& .MuiAlert-icon': { color: T.blue } }}>
              <strong>No dataset found.</strong>{' '}
              <Typography component="span" onClick={() => handleNavigate('dataimport')}
                sx={{ fontWeight: 600, fontSize: 13, cursor: 'pointer', color: T.blue, '&:hover': { opacity: 0.75 }, display: 'inline' }}>
                Upload your health dataset →
              </Typography>
            </Alert>
          )}

          {checkingData && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, mb: '14px',
              borderRadius: '8px', backgroundColor: T.blueDim, border: `1px solid rgba(37,99,235,0.18)` }}>
              <CircularProgress size={12} sx={{ color: T.blue }} />
              <Typography sx={{ fontSize: 12.5, color: T.textBody }}>Loading dataset info…</Typography>
            </Box>
          )}

          {/* Controls */}
          <SCard sx={{ mb: '14px' }}>
            <CardContent sx={{ p: '14px 16px', '&:last-child': { pb: '14px' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 12, color: T.textMuted, fontWeight: 500, whiteSpace: 'nowrap' }}>Barangay:</Typography>
                  <Select value={selectedBarangay} size="small" sx={{ ...SelectSx, minWidth: 150 }} displayEmpty
                    onChange={(e) => setSelectedBarangay(e.target.value)}>
                    <MenuItemComponent value={ALL_BARANGAYS} sx={{ fontSize: 13 }}>All Barangays</MenuItemComponent>
                    {availableBarangays.map(b => <MenuItemComponent key={b} value={b} sx={{ fontSize: 13 }}>{b}</MenuItemComponent>)}
                  </Select>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 12, color: T.textMuted, fontWeight: 500, whiteSpace: 'nowrap' }}>Disease:</Typography>
                  <Select value={selectedDisease} size="small" sx={{ ...SelectSx, minWidth: 140 }}
                    onChange={(e) => setSelectedDisease(e.target.value)}>
                    <MenuItemComponent value="all" sx={{ fontSize: 13 }}>All Categories</MenuItemComponent>
                    {availableDiseases.map(col => (
                      <MenuItemComponent key={col} value={col} sx={{ fontSize: 13 }}>{getDiseaseInfo(col).label}</MenuItemComponent>
                    ))}
                  </Select>
                </Box>
                <Button variant="contained" onClick={handleGenerateClick}
                  disabled={buttonDisabled}
                  startIcon={forecastLoading ? <CircularProgress size={13} color="inherit" /> : <PsychologyIcon sx={{ fontSize: 15 }} />}
                  sx={{ ml: 'auto', textTransform: 'none', fontWeight: 600, fontSize: 13, borderRadius: '8px',
                    px: 2.5, py: '7px', backgroundColor: T.blue, color: '#fff',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.2)',
                    '&:hover': { backgroundColor: T.blueMid }, '&:disabled': { opacity: 0.5 } }}>
                  {buttonLabel}
                </Button>
              </Box>
              <Box sx={{ mt: 1.5, px: '2px' }}>
                {/* New upload detected — show amber banner */}
                {hasNewUpload && hasDbData && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75,
                    px: 1.5, py: 0.9, borderRadius: '7px',
                    backgroundColor: T.warnBg, border: `1px solid ${T.warnBorder}` }}>
                    <WarningIcon sx={{ fontSize: 13, color: T.warn, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 11.5, color: T.textBody }}>
                      <strong>New data detected.</strong> Click <strong>Generate All</strong> to update forecasts
                      ({thisMonthDate.toLocaleDateString('en-PH', { month: 'long' })} – December {thisMonthDate.getFullYear()}).
                    </Typography>
                  </Box>
                )}
                {!hasNewUpload && !hasSavedForecasts && hasDbData && (
                  <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
                    💡 Click <strong>Generate All</strong> to train {forecastMonths}-month forecasts
                    ({thisMonthDate.toLocaleDateString('en-PH', { month: 'long' })} – December {thisMonthDate.getFullYear()})
                    for all {availableBarangays.length} barangays.
                  </Typography>
                )}
                {!hasNewUpload && hasSavedForecasts && forecastData && (
                  <Typography sx={{ fontSize: 11.5, color: T.ok }}>
                    ✅ Saved forecasts available — switching barangays loads instantly.
                  </Typography>
                )}
              </Box>
            </CardContent>
          </SCard>

          <RegenerateConfirmDialog
            open={showConfirmDialog} forecastMonths={forecastMonths}
            barangayCount={availableBarangays.length} referenceDate={referenceDate}
            onConfirm={runGenerate} onCancel={() => setShowConfirmDialog(false)}
          />

          {fetchingForecast && !forecastLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, mb: '14px',
              borderRadius: '8px', backgroundColor: T.blueDim, border: `1px solid rgba(37,99,235,0.18)` }}>
              <CircularProgress size={12} sx={{ color: T.blue }} />
              <Typography sx={{ fontSize: 12.5, color: T.textBody }}>
                Loading forecast for <strong>{selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : selectedBarangay}</strong>…
              </Typography>
            </Box>
          )}

          {forecastError && (
            <Alert severity={forecastError.startsWith('Done') ? 'success' : 'error'}
              sx={{ mb: 2, borderRadius: '10px', fontSize: 13 }}>
              {forecastError}
            </Alert>
          )}

          {generateAllProgress && !forecastLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, mb: '14px',
              borderRadius: '8px', backgroundColor: T.okBg, border: `1px solid ${T.okBorder}` }}>
              <CheckCircleIcon sx={{ fontSize: 14, color: T.ok }} />
              <Typography sx={{ fontSize: 12.5, color: T.textBody }}>
                Generated forecasts for <strong>{generateAllProgress.completed}</strong> of <strong>{generateAllProgress.total}</strong> barangays successfully.
              </Typography>
            </Box>
          )}

          {forecastData && !fetchingForecast && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, mb: '14px',
              borderRadius: '8px', backgroundColor: T.okBg, border: `1px solid ${T.okBorder}` }}>
              <CheckCircleIcon sx={{ fontSize: 14, color: T.ok }} />
              <Typography sx={{ fontSize: 12.5, color: T.textBody }}>
                Showing forecast for <strong>{selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : selectedBarangay}</strong>
                {selectedDisease !== 'all' ? ` — ${getDiseaseInfo(selectedDisease).label}` : ''}
                {forecastData.is_saved ? ' — loaded from saved results' : ''}
              </Typography>
            </Box>
          )}

          {/* Stat cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', mb: '14px' }}>
            <SCard sx={{ borderTop: `3px solid ${T.blue}` }}>
              <CardContent sx={{ p: '16px', '&:last-child': { pb: '16px' } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: T.textFaint }}>Location</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '6px', backgroundColor: T.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LocationOnIcon sx={{ fontSize: 15, color: T.blue }} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textHead, lineHeight: 1.3 }}>{cityLabel || '—'}</Typography>
                <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.25 }}>{selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : (selectedBarangay || '—')}</Typography>
                <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {uploadedInfo?.fileName || 'No dataset loaded'}
                </Typography>
              </CardContent>
            </SCard>

            <SCard sx={{ borderTop: `3px solid ${T.blue}` }}>
              <CardContent sx={{ p: '16px', '&:last-child': { pb: '16px' } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: T.textFaint }}>This Month</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '6px', backgroundColor: T.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GroupIcon sx={{ fontSize: 15, color: T.blue }} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, color: T.textHead, lineHeight: 1, letterSpacing: '-0.5px' }}>
                  {stats ? stats.currentVal.toLocaleString() : hasData ? totalThisMonth.toLocaleString() : '—'}
                </Typography>
                <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 0.25 }}>{currentMonthLabel}</Typography>
                {stats && stats.currentMonthFound !== realCurrentKey && (
                  <Typography sx={{ fontSize: 9.5, color: T.textFaint, mt: 0.25, fontStyle: 'italic' }}>
                    Showing closest: {stats.currentMonthFound}
                  </Typography>
                )}
              </CardContent>
            </SCard>

            <SCard sx={{ borderTop: `3px solid ${trendColor(stats?.trend || 'stable')}` }}>
              <CardContent sx={{ p: '16px', '&:last-child': { pb: '16px' } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: T.textFaint }}>Next Month</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '6px', backgroundColor: trendBg(stats?.trend || 'stable'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendIcon sx={{ fontSize: 15, color: trendColor(stats?.trend || 'stable') }} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, color: T.textHead, lineHeight: 1, letterSpacing: '-0.5px' }}>
                  {stats ? stats.nextVal.toLocaleString() : hasData ? totalForecasted.toLocaleString() : '—'}
                </Typography>
                <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 0.25 }}>{nextMonthLabel}</Typography>
                {stats && stats.nextMonthFound !== realNextKey && (
                  <Typography sx={{ fontSize: 9.5, color: T.textFaint, mt: 0.25, fontStyle: 'italic' }}>
                    Showing closest: {stats.nextMonthFound}
                  </Typography>
                )}
              </CardContent>
            </SCard>

            <SCard sx={{ borderTop: `3px solid ${T.ok}` }}>
              <CardContent sx={{ p: '16px', '&:last-child': { pb: '16px' } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: T.textFaint }}>Forecast Period</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '6px', backgroundColor: T.okBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarIcon sx={{ fontSize: 15, color: T.ok }} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, color: T.textHead, lineHeight: 1, letterSpacing: '-0.5px' }}>
                  {forecastMonths}{' '}
                  <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color: T.textMuted }}>
                    Month{forecastMonths > 1 ? 's' : ''}
                  </Typography>
                </Typography>
                <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 0.5 }}>{forecastPeriodLabel}</Typography>
              </CardContent>
            </SCard>
          </Box>

          {/* Chart */}
          <SCard sx={{ mb: '14px' }}>
            <CardContent sx={{ p: '18px 20px 14px', '&:last-child': { pb: '14px' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>Predicted Patient Volume</Typography>
                {selectedDisease !== 'all' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: '10px', py: '3px', borderRadius: '20px',
                    backgroundColor: `${chartColor}18`, border: `1px solid ${chartColor}40` }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: chartColor }} />
                    <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: chartColor }}>{getDiseaseInfo(selectedDisease).label}</Typography>
                  </Box>
                )}
              </Box>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                    <YAxis axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                    <RechartsTooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="actual" name="Actual" stroke={chartColor}
                      strokeWidth={2} strokeDasharray="0"
                      dot={{ fill: chartColor, r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 4, fill: chartColor, stroke: '#fff', strokeWidth: 2 }}
                      connectNulls={false} />
                    <Line type="monotone" dataKey="predicted" name="Predicted" stroke={chartColor}
                      strokeWidth={2} strokeDasharray="5 3"
                      dot={{ fill: chartColor, r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 4, fill: chartColor, stroke: '#fff', strokeWidth: 2 }}
                      connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}>
                  <Typography sx={{ fontSize: 13, color: T.textMuted }}>
                    {hasSavedForecasts ? 'Select a barangay to view its forecast' : 'Click Generate All to create forecasts'}
                  </Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 2, borderRadius: 1, backgroundColor: chartColor }} />
                  <Typography sx={{ fontSize: 11, color: T.textMuted }}>Actual</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 2, borderRadius: 1, backgroundColor: chartColor, border: '1px dashed' }} />
                  <Typography sx={{ fontSize: 11, color: T.textMuted }}>Predicted</Typography>
                </Box>
              </Box>
            </CardContent>
          </SCard>

          {/* Results */}
          <SCard>
            <CardContent sx={{ p: '18px 20px', '&:last-child': { pb: '20px' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.75 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>Results</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
                    {selectedDisease === 'all' ? 'All Categories' : getDiseaseInfo(selectedDisease).label}
                  </Typography>
                  <Box sx={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: T.textFaint }} />
                  <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
                    {selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : selectedBarangay}
                  </Typography>
                </Box>
              </Box>
              {trendItems.length === 0 ? (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 13, color: T.textMuted }}>
                    {hasSavedForecasts ? 'Select a barangay to see results' : 'Generate forecasts to see results'}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {trendItems.map((item, i) => (
                    <ResultRow key={`${selectedBarangay}-${item.disease || 'warning'}-${i}`}
                      item={item} forecastData={forecastData} selectedBarangay={selectedBarangay} />
                  ))}
                </Box>
              )}
            </CardContent>
          </SCard>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;