import { forecastAll, getSavedForecast, getDiseaseBreakdown } from './services/api';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Button,
  Alert, Select, MenuItem as MenuItemComponent,
  CircularProgress, Skeleton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, Checkbox, Chip,
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
  Lock as LockIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import Sidebar, { T } from './Sidebar';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const ALL_BARANGAYS = '__ALL__';
const MAX_BARANGAY_SELECTION = 5;

const computeForecastParams = () => {
  const now = new Date();
  const datasetEndRaw = localStorage.getItem('datasetEndDate') || '';
  let forecastYear = now.getFullYear();
  let startMonth = 0;

  if (datasetEndRaw) {
    const parsed = new Date(datasetEndRaw);
    if (!Number.isNaN(parsed.getTime())) {
      const endMonth = parsed.getMonth();
      const endYear  = parsed.getFullYear();
      if (endMonth === 11) {
        forecastYear = endYear + 1;
        startMonth = 0;
      } else {
        forecastYear = endYear;
        startMonth = endMonth + 1;
      }
    }
  }

  const reference = new Date(forecastYear, startMonth, 1);
  const endOfYear = new Date(forecastYear, 11, 1);
  const months = (endOfYear.getFullYear() - reference.getFullYear()) * 12
    + (endOfYear.getMonth() - reference.getMonth()) + 1;
  return { forecastMonths: Math.max(months, 1), referenceDate: reference, forecastYear };
};

const checkDatasetReadyForForecast = () => {
  const datasetEndRaw = localStorage.getItem('datasetEndDate') || '';
  if (!datasetEndRaw) return { ready: false, reason: 'no_data' };
  const parsed = new Date(datasetEndRaw);
  if (Number.isNaN(parsed.getTime())) return { ready: false, reason: 'invalid_date' };

  const endMonth = parsed.getMonth();
  const endYear  = parsed.getFullYear();
  const { forecastYear } = computeForecastParams();

  if (forecastYear > endYear) {
    if (endMonth !== 11) {
      const endMonthLabel = parsed.toLocaleDateString('en-PH', { month: 'long' });
      return { ready: false, reason: 'incomplete_year', endMonth: endMonthLabel, endYear, forecastYear };
    }
  }

  return { ready: true, endYear, forecastYear };
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
  const label = col.replace(/_cases$/, '').replace(/_prevalence_pct$/, ' %')
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
  const now = new Date();
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

const BarangaySelectDialog = ({
  open, allBarangays, forecastedBarangays = [], forecastMonths, referenceDate, onConfirm, onCancel,
}) => {
  const [selected, setSelected] = useState([]);
  const decYear    = referenceDate ? referenceDate.getFullYear() : new Date().getFullYear();
  const startLabel = referenceDate ? referenceDate.toLocaleDateString('en-PH', { month: 'long' }) : '—';
  const selectableBarangays = allBarangays.filter(b => !forecastedBarangays.includes(b));
  const lockedCount = forecastedBarangays.length;
  const allDone = selectableBarangays.length === 0;
  useEffect(() => { if (open) setSelected([]); }, [open]);
  const toggle = (brgy) => {
    if (forecastedBarangays.includes(brgy)) return;
    setSelected(prev =>
      prev.includes(brgy) ? prev.filter(b => b !== brgy)
        : prev.length < MAX_BARANGAY_SELECTION ? [...prev, brgy] : prev
    );
  };
  const atLimit = selected.length >= MAX_BARANGAY_SELECTION;
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: '14px', border: `1px solid ${T.border}` } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: '8px', backgroundColor: T.blueDim,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PsychologyIcon sx={{ fontSize: 16, color: T.blue }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: T.textHead }}>Select Barangays to Forecast</Typography>
            <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
              {startLabel} – December {decYear} · {forecastMonths} month{forecastMonths > 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      <Box sx={{ borderBottom: `1px solid ${T.borderSoft}`, mx: 3 }} />
      <DialogContent sx={{ pt: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: '9px 12px', mb: 2,
          borderRadius: '8px', backgroundColor: T.blueDim, border: `1px solid rgba(37,99,235,0.18)` }}>
          <InfoOutlinedIcon sx={{ fontSize: 14, color: T.blue, flexShrink: 0, mt: '1px' }} />
          <Typography sx={{ fontSize: 12, color: T.textBody }}>
            Select <strong>up to {MAX_BARANGAY_SELECTION} barangays</strong> to generate {decYear} forecasts.
          </Typography>
        </Box>
        {allDone && (
          <Box sx={{ p: '10px 14px', mb: 2, borderRadius: '8px', backgroundColor: T.okBg, border: `1px solid ${T.okBorder}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon sx={{ fontSize: 15, color: T.ok }} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.ok }}>
                All {lockedCount} barangays already have {decYear} forecasts.
              </Typography>
            </Box>
          </Box>
        )}
        {selected.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
            {selected.map(b => (
              <Chip key={b} label={b} size="small" onDelete={() => toggle(b)}
                sx={{ fontSize: 11.5, backgroundColor: T.blueDim, color: T.blue,
                  border: `1px solid rgba(37,99,235,0.25)`,
                  '& .MuiChip-deleteIcon': { color: T.blue, '&:hover': { color: T.blueMid } } }} />
            ))}
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            All Barangays ({allBarangays.length})
            {lockedCount > 0 && (
              <Typography component="span" sx={{ fontSize: 11, color: T.ok, fontWeight: 500, textTransform: 'none', letterSpacing: 0, ml: 0.75 }}>
                · {lockedCount} done this year
              </Typography>
            )}
          </Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: atLimit ? T.danger : T.textMuted }}>
            {selected.length} / {MAX_BARANGAY_SELECTION} selected
          </Typography>
        </Box>
        <Box sx={{ maxHeight: 280, overflowY: 'auto', border: `1px solid ${T.border}`, borderRadius: '8px', backgroundColor: '#FAFBFC' }}>
          {allBarangays.map((brgy, idx) => {
            const isForecasted = forecastedBarangays.includes(brgy);
            const isChecked    = selected.includes(brgy);
            const isLocked     = isForecasted || (atLimit && !isChecked);
            return (
              <Box key={brgy} onClick={() => !isLocked && toggle(brgy)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.1,
                  borderBottom: idx < allBarangays.length - 1 ? `1px solid ${T.borderSoft}` : 'none',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  backgroundColor: isForecasted ? '#F8FFF8' : isChecked ? T.blueDim : 'transparent',
                  opacity: isForecasted ? 0.7 : atLimit && !isChecked ? 0.45 : 1,
                  transition: 'background 0.12s',
                  '&:hover': (!isLocked) ? { backgroundColor: isChecked ? T.blueDim : T.pageBg } : {},
                }}>
                {isForecasted ? (
                  <CheckCircleIcon sx={{ fontSize: 18, color: T.ok, flexShrink: 0 }} />
                ) : (
                  <Checkbox checked={isChecked} size="small" disabled={isLocked}
                    sx={{ p: 0, color: T.border, '&.Mui-checked': { color: T.blue } }} />
                )}
                <Typography sx={{ fontSize: 13, color: isForecasted ? T.ok : isLocked ? T.textFaint : T.textBody, fontWeight: isForecasted ? 600 : isChecked ? 600 : 400, flex: 1 }}>
                  {brgy}
                </Typography>
                {isForecasted && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, px: '8px', py: '2px', borderRadius: '20px', backgroundColor: T.okBg, border: `1px solid ${T.okBorder}`, flexShrink: 0 }}>
                    <Typography sx={{ fontSize: 10.5, color: T.ok, fontWeight: 600 }}>Done</Typography>
                  </Box>
                )}
                {!isForecasted && atLimit && !isChecked && (
                  <LockIcon sx={{ fontSize: 12, color: T.textFaint, ml: 'auto' }} />
                )}
              </Box>
            );
          })}
        </Box>
        {atLimit && (
          <Box sx={{ mt: 1.25, p: '8px 12px', borderRadius: '7px', backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
            <Typography sx={{ fontSize: 11.5, color: '#C2410C' }}>
              ⚠️ Maximum of {MAX_BARANGAY_SELECTION} barangays reached. Deselect one to choose another.
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, gap: 1 }}>
        <Button onClick={onCancel} sx={{ textTransform: 'none', fontSize: 13, color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: '8px', px: 2 }}>
          Cancel
        </Button>
        <Button onClick={() => onConfirm(selected)} variant="contained"
          disabled={selected.length === 0 || allDone}
          startIcon={<PsychologyIcon sx={{ fontSize: 15 }} />}
          sx={{ textTransform: 'none', fontSize: 13, fontWeight: 600, backgroundColor: T.blue, borderRadius: '8px', px: 2.5, '&:hover': { backgroundColor: T.blueMid }, '&:disabled': { opacity: 0.45 } }}>
          {allDone ? `All ${decYear} forecasts done` : `Generate for ${selected.length > 0 ? `${selected.length} Barangay${selected.length > 1 ? 's' : ''}` : '…'}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const DatasetNotReadyBanner = ({ endMonth, endYear, forecastYear }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, p: '12px 16px', mb: '14px', borderRadius: '10px', backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
    <LockIcon sx={{ fontSize: 16, color: '#C2410C', mt: '1px', flexShrink: 0 }} />
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#9A3412', mb: 0.4 }}>Forecast generation not yet available</Typography>
      <Typography sx={{ fontSize: 12.5, color: '#C2410C', lineHeight: 1.6 }}>
        Your dataset only goes up to <strong>{endMonth} {endYear}</strong>.
        Forecasting for <strong>{forecastYear}</strong> requires a complete dataset through <strong>December {endYear}</strong>. Please upload the full-year data first.
      </Typography>
    </Box>
  </Box>
);

const GenerationOverlay = ({ progress, total, currentBarangay, completedBarangays, failedBarangays, forecastMonths, referenceDate }) => {
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
  const startLabel = referenceDate ? referenceDate.toLocaleDateString('en-PH', { month: 'long' }) : '—';
  const decYear = referenceDate ? referenceDate.getFullYear() : new Date().getFullYear();
  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1500, backgroundColor: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box sx={{ width: '92vw', maxWidth: 520, backgroundColor: '#FFFFFF', borderRadius: '16px', border: `1px solid ${T.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        <Box sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: `1px solid ${T.borderSoft}`, backgroundColor: T.pageBg }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '10px', backgroundColor: T.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PsychologyIcon sx={{ fontSize: 18, color: T.blue }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textHead }}>Generating Forecasts</Typography>
              <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>{startLabel} – December {decYear} · {forecastMonths} month{forecastMonths > 1 ? 's' : ''}</Typography>
            </Box>
          </Box>
        </Box>
        <Box sx={{ px: 3, pt: 2.5, pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.textBody }}>{progress} of {total} barangays</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.blue }}>{pct}%</Typography>
          </Box>
          <Box sx={{ height: 8, borderRadius: 4, backgroundColor: T.borderSoft, overflow: 'hidden' }}>
            <Box sx={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: `linear-gradient(90deg, ${T.blue}, #3B82F6)`, transition: 'width 0.5s ease', boxShadow: `0 0 10px rgba(37,99,235,0.4)` }} />
          </Box>
          {currentBarangay && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.75, p: '9px 12px', borderRadius: '8px', backgroundColor: T.blueDim, border: `1px solid rgba(27,79,138,0.18)` }}>
              <CircularProgress size={12} thickness={5} sx={{ color: T.blue, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12, color: T.blue, fontWeight: 500 }}>Training model for <strong>{currentBarangay}</strong>…</Typography>
            </Box>
          )}
        </Box>
        {completedBarangays.length > 0 && (
          <Box sx={{ px: 3, pb: 1.5, maxHeight: 160, overflowY: 'auto' }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.75 }}>Completed ({completedBarangays.length})</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[...completedBarangays].reverse().map(b => (
                <Box key={b} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '6px 10px', borderRadius: '6px', backgroundColor: T.okBg, border: `1px solid ${T.okBorder}` }}>
                  <CheckCircleIcon sx={{ fontSize: 12, color: T.ok, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 12, color: T.ok, fontWeight: 500 }}>{b}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
        {failedBarangays.length > 0 && (
          <Box sx={{ px: 3, pb: 1.5 }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.75 }}>Failed ({failedBarangays.length})</Typography>
            {failedBarangays.map(b => (
              <Box key={b} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '6px 10px', borderRadius: '6px', mb: '5px', backgroundColor: T.dangerBg, border: `1px solid ${T.dangerBorder}` }}>
                <ErrorOutlineIcon sx={{ fontSize: 12, color: T.danger, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12, color: T.danger, fontWeight: 500 }}>{b}</Typography>
              </Box>
            ))}
          </Box>
        )}
        <Box sx={{ mx: 3, mb: 2.5, p: '10px 12px', borderRadius: '8px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <WarningIcon sx={{ fontSize: 14, color: '#D97706', mt: '1px', flexShrink: 0 }} />
          <Typography sx={{ fontSize: 11.5, color: '#92400E', lineHeight: 1.55 }}><strong>Please don't close or navigate away.</strong> The model is still training.</Typography>
        </Box>
      </Box>
    </Box>
  );
};

const NavigationBlockDialog = ({ open, onStay, onLeave }) => (
  <Dialog open={open} onClose={onStay} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '14px', border: `1px solid ${T.border}` } }}>
    <DialogTitle sx={{ pb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: '8px', backgroundColor: T.dangerBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <WarningIcon sx={{ fontSize: 16, color: T.danger }} />
        </Box>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: T.textHead }}>Forecast in Progress</Typography>
      </Box>
    </DialogTitle>
    <Box sx={{ borderBottom: `1px solid ${T.borderSoft}`, mx: 3 }} />
    <DialogContent sx={{ pt: 2 }}>
      <Typography sx={{ fontSize: 13, color: T.textBody, lineHeight: 1.7, mb: 1.5 }}>A forecast generation is currently running. If you leave now, the process may be interrupted.</Typography>
      <Box sx={{ p: '10px 14px', borderRadius: '8px', backgroundColor: T.dangerBg, border: `1px solid ${T.dangerBorder}` }}>
        <Typography sx={{ fontSize: 12.5, color: T.danger, lineHeight: 1.6 }}>⚠️ Incomplete forecasts cannot be recovered.</Typography>
      </Box>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
      <Button onClick={onLeave} sx={{ textTransform: 'none', fontSize: 13, color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: '8px', px: 2 }}>Leave Anyway</Button>
      <Button onClick={onStay} variant="contained" sx={{ textTransform: 'none', fontSize: 13, fontWeight: 600, backgroundColor: T.blue, borderRadius: '8px', px: 2, '&:hover': { backgroundColor: T.blueMid } }}>Stay on Page</Button>
    </DialogActions>
  </Dialog>
);

const ResultRow = ({ item, forecastData, selectedBarangay }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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
        const data = await getDiseaseBreakdown(catKey, selectedBarangay, city, 6);
        setBreakdown(data);
      } catch (e) {
        setBreakdown({ breakdown: [], monthly_trend: [] });
      } finally {
        setLoading(false);
      }
    }
  };
  const info = item.disease ? getDiseaseInfo(item.disease) : null;
  const preds = item.disease ? (forecastData?.predictions?.[item.disease] || []) : [];
  const nextVal = Math.round(preds[0] ?? 0);
  const canExpand = item.type !== 'warning' && !!item.disease;
  const effectiveType = item.type === 'warning' ? 'increasing' : item.type;
  return (
    <Box>
      <Box onClick={canExpand ? handleToggle : undefined} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '10px 14px', borderRadius: isOpen ? '8px 8px 0 0' : '8px', backgroundColor: trendBg(effectiveType), border: `1px solid ${trendBorder(effectiveType)}`, cursor: canExpand ? 'pointer' : 'default', transition: 'all 0.15s', '&:hover': canExpand ? { opacity: 0.88 } : {} }}>
        <TrendRowIcon type={item.type} />
        <Typography sx={{ fontSize: 12.5, color: T.textBody, lineHeight: 1.5, flex: 1 }}>{item.text}</Typography>
        {canExpand && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, px: '10px', py: '3px', borderRadius: '20px', backgroundColor: '#FFFFFF', border: `1px solid ${trendBorder(effectiveType)}` }}>
            <Typography sx={{ fontSize: 11, color: trendColor(effectiveType), fontWeight: 600 }}>{isOpen ? 'Hide' : 'Details'}</Typography>
            <ExpandMoreIcon sx={{ fontSize: 14, color: trendColor(effectiveType), transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </Box>
        )}
      </Box>
      {isOpen && canExpand && (
        <Box sx={{ borderRadius: '0 0 8px 8px', border: `1px solid ${trendBorder(effectiveType)}`, borderTop: 'none', backgroundColor: '#FAFBFC' }}>
          {loading ? (
            <Box sx={{ p: '14px 16px', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[1,2,3].map(i => <Skeleton key={i} variant="rectangular" height={34} sx={{ borderRadius: '6px' }} />)}
            </Box>
          ) : breakdown?.breakdown?.length > 0 ? (
            <Box sx={{ p: '14px 16px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Box sx={{ fontSize: 14 }}>{info?.icon}</Box>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top specific diseases — {info?.label}</Typography>
                {nextVal > 0 && (
                  <Box sx={{ ml: 'auto', px: '8px', py: '2px', borderRadius: '20px', backgroundColor: trendBg(item.type), border: `1px solid ${trendBorder(item.type)}` }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: trendColor(item.type) }}>{nextVal.toLocaleString()} projected next month</Typography>
                  </Box>
                )}
              </Box>
              {breakdown.breakdown.map((entry, idx) => {
                const maxCases = breakdown.breakdown[0]?.total_cases || 1;
                const pct = Math.round((entry.total_cases / maxCases) * 100);
                const barColors = [info?.color || T.blue, '#60A5FA', '#34D399', '#FBBF24', '#A78BFA'];
                const barColor = barColors[idx] || info?.color || T.blue;
                return (
                  <Box key={idx} sx={{ mb: 1.25 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: idx === 0 ? 600 : 400, color: idx === 0 ? T.textHead : T.textBody, flex: 1, mr: 1, lineHeight: 1.4 }}>
                        {idx === 0 ? '★ ' : ''}{entry.label}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                        {entry.total_male > 0 && (<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}><MaleIcon sx={{ fontSize: 11, color: '#3B82F6' }} /><Typography sx={{ fontSize: 11, color: T.textMuted }}>{entry.total_male.toLocaleString()}</Typography></Box>)}
                        {entry.total_female > 0 && (<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}><FemaleIcon sx={{ fontSize: 11, color: '#EC4899' }} /><Typography sx={{ fontSize: 11, color: T.textMuted }}>{entry.total_female.toLocaleString()}</Typography></Box>)}
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.textHead, minWidth: 48, textAlign: 'right' }}>{entry.total_cases.toLocaleString()}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ height: 5, borderRadius: 3, backgroundColor: T.borderSoft, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', borderRadius: 3, width: `${pct}%`, backgroundColor: barColor, transition: 'width 0.45s ease' }} />
                    </Box>
                  </Box>
                );
              })}
              {breakdown.monthly_trend?.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 1 }}>Historical trend — {breakdown.breakdown[0]?.label}</Typography>
                  <ResponsiveContainer width="100%" height={80}>
                    <ComposedChart data={breakdown.monthly_trend} margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                      <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: T.textFaint }} tickFormatter={v => v.slice(5)} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: T.textFaint }} />
                      <RechartsTooltip contentStyle={{ ...tooltipStyle, fontSize: 11 }} />
                      <Line type="monotone" dataKey="cases" stroke={info?.color || T.blue} strokeWidth={2} dot={false} activeDot={{ r: 3, fill: info?.color || T.blue }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Box>
              )}
              {breakdown.breakdown[0] && (
                <Box sx={{ mt: 1.5, p: '8px 12px', borderRadius: '6px', backgroundColor: trendBg(item.type), border: `1px solid ${trendBorder(item.type)}` }}>
                  <Typography sx={{ fontSize: 12, lineHeight: 1.55, color: trendColor(item.type) === T.textMuted ? T.textBody : trendColor(item.type) }}>
                    <strong>{breakdown.breakdown[0].label?.replace(/^[A-Z0-9]+\.?[0-9]*;\s*/, '')}</strong> has the highest recorded cases in the <strong>{info?.label}</strong> category{selectedBarangay !== ALL_BARANGAYS ? ` in ${selectedBarangay}` : ''}.
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
const Dashboard = ({ onNavigate, onLogout, isPublic = false }) => {
  const [selectedBarangay,    setSelectedBarangay]   = useState(() => localStorage.getItem('cachedForecastBarangay') || ALL_BARANGAYS);
  const [selectedDisease,     setSelectedDisease]    = useState(() => localStorage.getItem('cachedForecastDisease')  || 'all');
  const [availableBarangays,  setAvailableBarangays] = useState([]);
  const [availableDiseases,   setAvailableDiseases]  = useState([]);
  const [forecastLoading,     setForecastLoading]    = useState(false);
  const [fetchingForecast,    setFetchingForecast]   = useState(false);
  const [forecastError,       setForecastError]      = useState('');
  const [forecastData,        setForecastData]       = useState(null);
  const [generateAllProgress, setGenerateAllProgress] = useState(null);
  const [hasSavedForecasts,   setHasSavedForecasts]  = useState(false);
  const [forecastIsValid,     setForecastIsValid]    = useState(false);
  const [showBarangaySelect,  setShowBarangaySelect] = useState(false);
  const [hasData,             setHasData]            = useState(false);
  const [forecastHistory,     setForecastHistory]    = useState([]);
  const [diseaseSummary,      setDiseaseSummary]     = useState([]);
  const [totalForecasted,     setTotalForecasted]    = useState(0);
  const [hasDbData,           setHasDbData]          = useState(false);
  const [checkingData,        setCheckingData]       = useState(true);
  const [hasNewUpload,        setHasNewUpload]       = useState(false);
  const [datasetReadiness,    setDatasetReadiness]   = useState(null);
  const [availableForecastYears, setAvailableForecastYears] = useState([]);
  const [selectedForecastYear,   setSelectedForecastYear]   = useState(null);

  const [forecastParams, setForecastParams] = useState(() => computeForecastParams());
  const { forecastMonths, referenceDate, forecastYear } = forecastParams;
  const forecastedBarangaysKey = `forecastedBarangays_${forecastYear}`;

  const [forecastedBarangays, setForecastedBarangays] = useState(() => {
    try {
      const { forecastYear: fy } = computeForecastParams();
      const s = localStorage.getItem(`forecastedBarangays_${fy}`);
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  const [accumulatedChart, setAccumulatedChart] = useState({});
  const [genOverlay, setGenOverlay] = useState({ visible: false, progress: 0, total: 0, current: null, completed: [], failed: [] });
  const [navBlockDialog, setNavBlockDialog] = useState(false);
  const pendingNavRef   = useRef(null);
  const isGeneratingRef = useRef(false);

  // ── FIX: Track generation state in a ref so useEffect can read it without
  // being added as a dependency (which would cause infinite loops).
  const forecastLoadingRef = useRef(false);

  const cityLabel = localStorage.getItem('datasetCity') || '';

  const realNow           = new Date();
  const realCurrentMonth  = new Date(realNow.getFullYear(), realNow.getMonth(), 1);
  const realNextMonth     = new Date(realNow.getFullYear(), realNow.getMonth() + 1, 1);
  const realCurrentKey    = `${realCurrentMonth.getFullYear()}-${String(realCurrentMonth.getMonth() + 1).padStart(2, '0')}`;
  const realNextKey       = `${realNextMonth.getFullYear()}-${String(realNextMonth.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthLabel = realCurrentMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const nextMonthLabel    = realNextMonth.toLocaleDateString('en-PH',    { month: 'long', year: 'numeric' });
  const thisMonthDate     = referenceDate;
  const thisMonthKey      = `${thisMonthDate.getFullYear()}-${String(thisMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const isViewingHistoricalYear = selectedForecastYear !== null && selectedForecastYear < forecastYear;

  // ── FIX: Keep both refs in sync with state ───────────────────────────────────
  useEffect(() => {
    isGeneratingRef.current = forecastLoading;
    forecastLoadingRef.current = forecastLoading;
  }, [forecastLoading]);

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

  useEffect(() => {
    try { localStorage.setItem(forecastedBarangaysKey, JSON.stringify(forecastedBarangays)); } catch {}
  }, [forecastedBarangays, forecastedBarangaysKey]);

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

  // ── Initial data fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    setDatasetReadiness(checkDatasetReadyForForecast());

    try {
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

        if (isPublic) {
          const res = await fetch(`${API_BASE_URL}/public/dataset-info`);
          if (!res.ok) { setCheckingData(false); return; }
          const data = await res.json();
          if (data.barangays?.length > 0) { setAvailableBarangays(data.barangays); setHasDbData(true); }
          if (data.disease_columns?.length > 0) setAvailableDiseases(data.disease_columns);
          if (data.city) localStorage.setItem('datasetCity', data.city);
          setSelectedForecastYear(forecastYear);
          setCheckingData(false);
          return;
        }

        if (!token) { setCheckingData(false); return; }
        const res = await fetch(`${API_BASE_URL}/dataset-info`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) { setCheckingData(false); return; }
        const data = await res.json();

        if (data.barangays?.length > 0) { setAvailableBarangays(data.barangays); setHasDbData(true); localStorage.setItem('availableBarangays', JSON.stringify(data.barangays)); }
        if (data.disease_columns?.length > 0) { setAvailableDiseases(data.disease_columns); localStorage.setItem('diseaseColumns', JSON.stringify(data.disease_columns)); }
        if (data.city) localStorage.setItem('datasetCity', data.city);

        if (data.dataset_end_date) {
          localStorage.setItem('datasetEndDate', data.dataset_end_date);
        } else {
          localStorage.removeItem('datasetEndDate');
        }

        const freshParams = computeForecastParams();
        setForecastParams(freshParams);
        setDatasetReadiness(checkDatasetReadyForForecast());

        if (data.available_forecast_years?.length > 0) {
          setAvailableForecastYears(data.available_forecast_years);
          const defaultYear = data.available_forecast_years.includes(freshParams.forecastYear)
            ? freshParams.forecastYear
            : data.available_forecast_years[0];
          setSelectedForecastYear(defaultYear);
        } else {
          setSelectedForecastYear(freshParams.forecastYear);
        }

        {
          const currentFY = freshParams.forecastYear;
          const localKey  = `forecastedBarangays_${currentFY}`;
          let fromBackend = [];
          if (data.forecast_year === currentFY || data.forecast_year == null) {
            fromBackend = data.forecasted_barangays || [];
          }
          let fromLocal = [];
          try {
            const raw = localStorage.getItem(localKey);
            if (raw) fromLocal = JSON.parse(raw);
          } catch {}
          const merged = Array.from(new Set([...fromBackend, ...fromLocal]));
          setForecastedBarangays(merged);
          try { localStorage.setItem(localKey, JSON.stringify(merged)); } catch {}
        }

        try {
          const histRes = await fetch(`${API_BASE_URL}/upload-history`, { headers: { 'Authorization': `Bearer ${token}` } });
          if (histRes.ok) {
            const histData = await histRes.json();
            if (Array.isArray(histData) && histData.length > 0) {
              const latest = histData.find(u => u.status === 'success');
              if (latest?.uploaded_at) {
                const latestUploadTime = new Date(latest.uploaded_at).getTime();
                const lastForecastTime = localStorage.getItem('lastForecastGeneratedAt') ? new Date(localStorage.getItem('lastForecastGeneratedAt')).getTime() : 0;
                if (latestUploadTime > lastForecastTime) setHasNewUpload(true);
              }
            }
          }
        } catch (e) { console.error('Failed to fetch upload history:', e); }

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

  // ── FIX: Guard this useEffect so it never fires while generation is in progress.
  // The ref (forecastLoadingRef) is used instead of the state variable so we don't
  // need to add forecastLoading as a dependency, which would cause extra fetches.
  useEffect(() => {
    if (selectedForecastYear === null) return;
    if (!isPublic && !hasDbData) return;

    // ── KEY FIX: Never fetch forecast-saved while a generation is running.
    // This prevents the 429 "another forecast is already running" error caused
    // by this useEffect firing mid-generation when state changes trigger re-renders.
    if (forecastLoadingRef.current) return;

    const isHistorical = selectedForecastYear < forecastYear;
    if (selectedForecastYear > forecastYear) return;

    const city = localStorage.getItem('datasetCity') || '';
    setFetchingForecast(true);
    setForecastError('');
    setForecastData(null);

    const token = localStorage.getItem('token');

    const url = isPublic
      ? `${API_BASE_URL}/public/forecast?barangay=${encodeURIComponent(selectedBarangay)}`
      : `${API_BASE_URL}/forecast-saved?barangay=${encodeURIComponent(selectedBarangay)}&city=${encodeURIComponent(city)}${isHistorical ? `&forecast_year=${selectedForecastYear}` : ''}`;

    const headers = (!isPublic && token) ? { 'Authorization': `Bearer ${token}` } : {};

    fetch(url, { headers })
      .then(r => r.json())
      .then(result => {
        if (!result.not_found) {
          setForecastData(result);
          setForecastIsValid(isForecastValid(result.forecast_dates));
          if (isPublic && result.barangays) { setAvailableBarangays(result.barangays); setHasDbData(true); }
        } else {
          setForecastData(null);
        }
      })
      .catch(() => { setForecastData(null); })
      .finally(() => setFetchingForecast(false));
  }, [selectedBarangay, hasDbData, selectedForecastYear, forecastYear]);

  const computeInsights = (history) => {
    if (!history?.length) return;
    const periods = history.map(h => h.period).filter(Boolean).sort();
    const latest  = periods[periods.length - 1] || 'N/A';
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
    ? (selectedDisease === 'all' ? Object.keys(forecastData.predictions || {}) : [selectedDisease].filter(d => forecastData.predictions?.[d]))
    : [];

  const getSummaryStats = () => {
    if (!forecastData || activeDiseases.length === 0) return null;
    const dates = forecastData.forecast_dates || [];
    if (dates.length === 0) return null;
    const dateKeys = dates.map(d => d.slice(0, 7));
    let currentIdx = dateKeys.indexOf(realCurrentKey);
    if (currentIdx < 0) currentIdx = realCurrentKey < dateKeys[0] ? 0 : dateKeys.length - 1;
    const nextIdx = Math.min(currentIdx + 1, dates.length - 1);
    const getValueAt = (idx, disease) => {
      if (idx < 0 || idx >= dates.length) return 0;
      return (forecastData.predictions[disease] || [])[idx] ?? 0;
    };
    const sumAt = (idx) => activeDiseases.reduce((s, d) => s + getValueAt(idx, d), 0);
    const currentVal = Math.round(selectedDisease === 'all' ? sumAt(currentIdx) : getValueAt(currentIdx, selectedDisease));
    const nextVal    = Math.round(selectedDisease === 'all' ? sumAt(nextIdx)    : getValueAt(nextIdx,    selectedDisease));
    const diff = nextVal - currentVal;
    const pct  = (diff / (currentVal || 1)) * 100;
    return {
      currentVal, nextVal,
      trend: diff > 0.5 ? 'increasing' : diff < -0.5 ? 'decreasing' : 'stable',
      pct: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%',
      periodLabel: dates.length ? `${dateKeys[0]} – ${dateKeys[dates.length - 1]}` : '',
      currentMonthFound: dateKeys[currentIdx],
      nextMonthFound:    dateKeys[nextIdx],
    };
  };

  const buildChartData = () => {
    const forecastDates = forecastData?.forecast_dates || [];
    if (forecastDates.length === 0) return [];
    const actualData = forecastData?.actual_data || null;
    const actualMap = {};
    if (actualData?.dates) {
      actualData.dates.forEach((period, idx) => {
        let val = null;
        if (selectedDisease === 'all') {
          let sum = 0; let hasAny = false;
          activeDiseases.forEach(d => { const v = (actualData[d] || [])[idx]; if (v !== null && v !== undefined) { sum += v; hasAny = true; } });
          val = hasAny ? sum : null;
        } else {
          const v = (actualData[selectedDisease] || [])[idx];
          val = (v !== null && v !== undefined) ? v : null;
        }
        actualMap[period] = val;
      });
    }
    return forecastDates.map((fcDate, i) => {
      const period = fcDate.slice(0, 7);
      let predictedValue = 0;
      if (selectedDisease === 'all') { activeDiseases.forEach(d => { predictedValue += (forecastData.predictions[d] || [])[i] || 0; }); }
      else { predictedValue = (forecastData.predictions[selectedDisease] || [])[i] || 0; }
      const actualValue = Object.prototype.hasOwnProperty.call(actualMap, period) ? actualMap[period] : null;
      return { month: period, actual: actualValue, predicted: Math.round(predictedValue) };
    });
  };

  const buildTrendSummary = () => {
    const sourceData = forecastData
      ? activeDiseases.map(d => ({
          disease: d, label: getDiseaseInfo(d).label,
          trend: getTrend(forecastData.predictions?.[d] || []),
          pct: (() => { const p = forecastData.predictions?.[d] || []; if (p.length < 2) return '0%'; const pct = ((p[p.length - 1] - p[0]) / (p[0] || 1)) * 100; return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'; })(),
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

  const handleGenerateClick = () => {
    if (!hasDbData || availableBarangays.length === 0) { setForecastError('No dataset found. Please upload in Data Import first.'); return; }
    setShowBarangaySelect(true);
  };

  const handleBarangaySelectConfirm = (selectedBrgy) => {
    setShowBarangaySelect(false);
    if (selectedBrgy.length > 0) runGenerate(selectedBrgy);
  };

  // ── FIX: Retry helper for 429 responses ──────────────────────────────────────
  const fetchWithRetry = async (url, options, retries = 3, delayMs = 4000) => {
    for (let attempt = 0; attempt < retries; attempt++) {
      const res = await fetch(url, options);
      if (res.status !== 429) return res;
      if (attempt < retries - 1) {
        console.warn(`429 received — retrying in ${delayMs}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    // Return the last 429 response so caller can handle it
    return await fetch(url, options);
  };

const runGenerate = async (barangaysToGenerate) => {
  setForecastLoading(true);
  forecastLoadingRef.current = true;
  setForecastError('');
  const total = barangaysToGenerate.length;
  const completed = [];
  const failed = [];

  setGenOverlay({ visible: true, progress: 0, total, current: barangaysToGenerate[0], completed: [], failed: [] });

  try {
    const city  = localStorage.getItem('datasetCity') || '';
    const token = localStorage.getItem('token');

    for (let i = 0; i < barangaysToGenerate.length; i++) {
      const brgy = barangaysToGenerate[i];

      // Update overlay: show current barangay being processed
      setGenOverlay(prev => ({
        ...prev,
        progress: i,
        current: brgy,
        completed: [...completed],
        failed: [...failed],
      }));

      try {
        const res = await fetch(`${API_BASE_URL}/forecast-all`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            forecast_months: forecastMonths,
            city,
            diseases: availableDiseases,
            barangays: [brgy],   // ← one at a time
          }),
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);

        completed.push(brgy);
      } catch (err) {
        console.error(`Failed for ${brgy}:`, err);
        failed.push(brgy);
      }

      // Update overlay after each barangay completes
      setGenOverlay(prev => ({
        ...prev,
        progress: i + 1,
        current: i + 1 < total ? barangaysToGenerate[i + 1] : null,
        completed: [...completed],
        failed: [...failed],
      }));
    }

    // All done
    setHasSavedForecasts(true);
    setHasNewUpload(false);
    localStorage.setItem('lastForecastGeneratedAt', new Date().toISOString());
    setGenerateAllProgress({ completed: completed.length, total });

    if (completed.length > 0) {
      setForecastedBarangays(prev => Array.from(new Set([...prev, ...completed])));
    }
    if (failed.length > 0) {
      setForecastError(`Done! ${completed.length}/${total} barangays completed. ${failed.length} failed.`);
    }

  } catch (err) {
    setForecastError(err.message || 'Generate failed. Please try again.');
  } finally {
    setForecastLoading(false);
    forecastLoadingRef.current = false;
    setGenOverlay(prev => ({ ...prev, current: null }));
    setAvailableForecastYears(prev =>
      Array.from(new Set([forecastYear, ...prev])).sort((a, b) => b - a)
    );
    setSelectedForecastYear(forecastYear);

    try {
      const token = localStorage.getItem('token');
      const saved = await fetch(
        `${API_BASE_URL}/forecast-saved?barangay=${encodeURIComponent(selectedBarangay)}&city=${encodeURIComponent(localStorage.getItem('datasetCity') || '')}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      ).then(r => r.json()).catch(() => null);
      if (saved && !saved.not_found) {
        setForecastData(saved);
        setForecastIsValid(isForecastValid(saved.forecast_dates));
      }
    } catch (e) {}

    setTimeout(() => {
      setGenOverlay(prev => ({ ...prev, visible: false }));
      setTimeout(() => setGenerateAllProgress(null), 4000);
    }, 1500);
  }
};

  const stats      = getSummaryStats();
  const chartData  = buildChartData();
  const trendItems = buildTrendSummary();
  const chartColor = selectedDisease !== 'all' && CATEGORY_MAP[selectedDisease] ? CATEGORY_MAP[selectedDisease].color : T.blue;

  const forecastPeriodLabel = (() => {
    if (stats?.periodLabel) return stats.periodLabel;
    if (forecastData?.forecast_dates?.length) { const dates = forecastData.forecast_dates; return `${dates[0].slice(0,7)} – ${dates[dates.length - 1].slice(0,7)}`; }
    const endOfYear = `${thisMonthDate.getFullYear()}-12`;
    return `${thisMonthKey} – ${endOfYear}`;
  })();

  const datasetNotReady = datasetReadiness && !datasetReadiness.ready;
  const buttonDisabled  = forecastLoading || !hasDbData || datasetNotReady;
  const buttonLabel     = forecastLoading ? 'Generating…' : 'Generate';

  const ComboTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <Box sx={{ backgroundColor: '#FFFFFF', border: `1px solid ${T.border}`, borderRadius: '8px', p: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: T.textHead, mb: 0.5 }}>{label}</Typography>
        {payload.map((entry, i) => {
          if (entry.value === null || entry.value === undefined) return null;
          const isActual = entry.name === 'Actual';
          return (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
              <Box sx={{ width: 10, height: 10, flexShrink: 0, borderRadius: isActual ? '2px' : '50%', backgroundColor: entry.color, opacity: isActual ? 0.8 : 1 }} />
              <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>{entry.name}:</Typography>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: T.textHead }}>{Math.round(entry.value).toLocaleString()}</Typography>
            </Box>
          );
        })}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: T.pageBg }}>

      {genOverlay.visible && (
        <GenerationOverlay progress={genOverlay.progress} total={genOverlay.total} currentBarangay={genOverlay.current} completedBarangays={genOverlay.completed} failedBarangays={genOverlay.failed} forecastMonths={forecastMonths} referenceDate={referenceDate} />
      )}

      <NavigationBlockDialog open={navBlockDialog} onStay={handleNavBlockStay} onLeave={handleNavBlockLeave} />

      <BarangaySelectDialog open={showBarangaySelect} allBarangays={availableBarangays} forecastedBarangays={forecastedBarangays} forecastMonths={forecastMonths} referenceDate={referenceDate} onConfirm={handleBarangaySelectConfirm} onCancel={() => setShowBarangaySelect(false)} />

      <Sidebar currentPage="dashboard" onNavigate={handleNavigate} onLogout={handleLogout} isPublic={isPublic} />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        <Box sx={{ px: '24px', minHeight: 64, display: 'flex', alignItems: 'center', backgroundColor: '#FFFFFF', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: T.textHead, letterSpacing: '-0.2px' }}>Barangay Health Dashboard</Typography>
        </Box>

        <Box sx={{ px: '24px', pt: '20px', pb: '28px', overflow: 'auto', flex: 1 }}>

          {!checkingData && !hasDbData && !isPublic && (
            <Alert severity="info" icon={<InfoOutlinedIcon fontSize="small" />} sx={{ mb: 2.5, borderRadius: '10px', backgroundColor: T.blueDim, color: T.textHead, border: `1px solid rgba(37,99,235,0.18)`, fontSize: 13, '& .MuiAlert-icon': { color: T.blue } }}>
              <strong>No dataset found.</strong>{' '}
              <Typography component="span" onClick={() => handleNavigate('dataimport')} sx={{ fontWeight: 600, fontSize: 13, cursor: 'pointer', color: T.blue, '&:hover': { opacity: 0.75 }, display: 'inline' }}>Upload your health dataset →</Typography>
            </Alert>
          )}

          {checkingData && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, mb: '14px', borderRadius: '8px', backgroundColor: T.blueDim, border: `1px solid rgba(37,99,235,0.18)` }}>
              <CircularProgress size={12} sx={{ color: T.blue }} />
              <Typography sx={{ fontSize: 12.5, color: T.textBody }}>Loading dataset info…</Typography>
            </Box>
          )}

          {!checkingData && hasDbData && datasetNotReady && !isPublic && (
            <DatasetNotReadyBanner
              endMonth={datasetReadiness.endMonth}
              endYear={datasetReadiness.endYear}
              forecastYear={datasetReadiness.forecastYear}
            />
          )}

          {/* Controls */}
          <SCard sx={{ mb: '14px' }}>
            <CardContent sx={{ p: '14px 16px', '&:last-child': { pb: '14px' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 12, color: T.textMuted, fontWeight: 500, whiteSpace: 'nowrap' }}>Barangay:</Typography>
                  <Select value={selectedBarangay} size="small" sx={{ ...SelectSx, minWidth: 150 }} displayEmpty onChange={(e) => setSelectedBarangay(e.target.value)}>
                    <MenuItemComponent value={ALL_BARANGAYS} sx={{ fontSize: 13 }}>All Barangays</MenuItemComponent>
                    {availableBarangays.map(b => <MenuItemComponent key={b} value={b} sx={{ fontSize: 13 }}>{b}</MenuItemComponent>)}
                  </Select>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 12, color: T.textMuted, fontWeight: 500, whiteSpace: 'nowrap' }}>Disease:</Typography>
                  <Select value={selectedDisease} size="small" sx={{ ...SelectSx, minWidth: 140 }} onChange={(e) => setSelectedDisease(e.target.value)}>
                    <MenuItemComponent value="all" sx={{ fontSize: 13 }}>All Categories</MenuItemComponent>
                    {availableDiseases.map(col => (<MenuItemComponent key={col} value={col} sx={{ fontSize: 13 }}>{getDiseaseInfo(col).label}</MenuItemComponent>))}
                  </Select>
                </Box>
                {!isPublic && (
                  <Tooltip title={datasetNotReady ? 'Dataset incomplete for next year. Upload full-year data to forecast next year.' : ''} arrow>
                    <span style={{ marginLeft: 'auto' }}>
                      <Button variant="contained" onClick={handleGenerateClick} disabled={buttonDisabled}
                        startIcon={forecastLoading ? <CircularProgress size={13} color="inherit" /> : datasetNotReady ? <LockIcon sx={{ fontSize: 15 }} /> : <PsychologyIcon sx={{ fontSize: 15 }} />}
                        sx={{ textTransform: 'none', fontWeight: 600, fontSize: 13, borderRadius: '8px', px: 2.5, py: '7px', backgroundColor: T.blue, color: '#fff', boxShadow: '0 2px 8px rgba(37,99,235,0.2)', '&:hover': { backgroundColor: T.blueMid }, '&:disabled': { opacity: 0.5 } }}>
                        {buttonLabel}
                      </Button>
                    </span>
                  </Tooltip>
                )}
              </Box>
              <Box sx={{ mt: 1.5, px: '2px' }}>
                {!isPublic && !hasNewUpload && !hasSavedForecasts && hasDbData && !datasetNotReady && (
                  <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>💡 Click <strong>Generate</strong> to train {forecastMonths}-month forecasts (January – December {thisMonthDate.getFullYear()}). You can select up to {MAX_BARANGAY_SELECTION} barangays per run.</Typography>
                )}
                {!isPublic && !hasNewUpload && hasSavedForecasts && forecastData && !datasetNotReady && (
                  <Typography sx={{ fontSize: 11.5, color: T.ok }}>✅ Saved forecasts available — switching barangays loads instantly.</Typography>
                )}
                {!isPublic && hasSavedForecasts && !datasetNotReady && (() => {
                  const remaining = availableBarangays.filter(b => !forecastedBarangays.includes(b)).length;
                  if (remaining > 0 && remaining < availableBarangays.length) {
                    return (<Typography sx={{ fontSize: 11.5, color: T.textMuted, mt: 0.5 }}>📋 <strong>{forecastedBarangays.length}</strong> of <strong>{availableBarangays.length}</strong> barangays forecasted for {forecastYear}. {remaining} remaining.</Typography>);
                  }
                  return null;
                })()}
              </Box>
            </CardContent>
          </SCard>

          {fetchingForecast && !forecastLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, mb: '14px', borderRadius: '8px', backgroundColor: T.blueDim, border: `1px solid rgba(37,99,235,0.18)` }}>
              <CircularProgress size={12} sx={{ color: T.blue }} />
              <Typography sx={{ fontSize: 12.5, color: T.textBody }}>Loading forecast for <strong>{selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : selectedBarangay}</strong>…</Typography>
            </Box>
          )}

          {forecastError && (<Alert severity={forecastError.startsWith('Done') ? 'success' : 'error'} sx={{ mb: 2, borderRadius: '10px', fontSize: 13 }}>{forecastError}</Alert>)}

          {generateAllProgress && !forecastLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, mb: '14px', borderRadius: '8px', backgroundColor: T.okBg, border: `1px solid ${T.okBorder}` }}>
              <CheckCircleIcon sx={{ fontSize: 14, color: T.ok }} />
              <Typography sx={{ fontSize: 12.5, color: T.textBody }}>Generated forecasts for <strong>{generateAllProgress.completed}</strong> of <strong>{generateAllProgress.total}</strong> barangays successfully.</Typography>
            </Box>
          )}

          {isViewingHistoricalYear && forecastData && !fetchingForecast && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, mb: '14px', borderRadius: '8px', backgroundColor: T.warnBg, border: `1px solid ${T.warnBorder}` }}>
              <HistoryIcon sx={{ fontSize: 14, color: T.warn }} />
              <Typography sx={{ fontSize: 12.5, color: T.textBody }}>Viewing <strong>{selectedForecastYear}</strong> forecast data — this is a past forecast year.</Typography>
            </Box>
          )}

          {forecastData && !fetchingForecast && !isViewingHistoricalYear && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, mb: '14px', borderRadius: '8px', backgroundColor: T.okBg, border: `1px solid ${T.okBorder}` }}>
              <CheckCircleIcon sx={{ fontSize: 14, color: T.ok }} />
              <Typography sx={{ fontSize: 12.5, color: T.textBody }}>Showing forecast for <strong>{selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : selectedBarangay}</strong>{selectedDisease !== 'all' ? ` — ${getDiseaseInfo(selectedDisease).label}` : ''}</Typography>
            </Box>
          )}

          {/* Stat cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', mb: '14px' }}>
            <SCard sx={{ borderTop: `3px solid ${T.blue}` }}>
              <CardContent sx={{ p: '16px', '&:last-child': { pb: '16px' } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: T.textFaint }}>Location</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '6px', backgroundColor: T.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LocationOnIcon sx={{ fontSize: 15, color: T.blue }} /></Box>
                </Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textHead, lineHeight: 1.3 }}>{cityLabel || '—'}</Typography>
                <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.25 }}>{selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : (selectedBarangay || '—')}</Typography>
              </CardContent>
            </SCard>
            <SCard sx={{ borderTop: `3px solid ${T.blue}` }}>
              <CardContent sx={{ p: '16px', '&:last-child': { pb: '16px' } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: T.textFaint }}>This Month</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '6px', backgroundColor: T.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GroupIcon sx={{ fontSize: 15, color: T.blue }} /></Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, color: T.textHead, lineHeight: 1, letterSpacing: '-0.5px' }}>{stats ? stats.currentVal.toLocaleString() : hasData ? totalForecasted.toLocaleString() : '—'}</Typography>
                <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 0.25 }}>{currentMonthLabel}</Typography>
                {stats && stats.currentMonthFound !== realCurrentKey && (<Typography sx={{ fontSize: 9.5, color: T.textFaint, mt: 0.25, fontStyle: 'italic' }}>Showing closest: {stats.currentMonthFound}</Typography>)}
              </CardContent>
            </SCard>
            <SCard sx={{ borderTop: `3px solid ${trendColor(stats?.trend || 'stable')}` }}>
              <CardContent sx={{ p: '16px', '&:last-child': { pb: '16px' } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: T.textFaint }}>Next Month</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '6px', backgroundColor: trendBg(stats?.trend || 'stable'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendIcon sx={{ fontSize: 15, color: trendColor(stats?.trend || 'stable') }} /></Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, color: T.textHead, lineHeight: 1, letterSpacing: '-0.5px' }}>{stats ? stats.nextVal.toLocaleString() : '—'}</Typography>
                <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 0.25 }}>{nextMonthLabel}</Typography>
                {stats && stats.nextMonthFound !== realNextKey && (<Typography sx={{ fontSize: 9.5, color: T.textFaint, mt: 0.25, fontStyle: 'italic' }}>Showing closest: {stats.nextMonthFound}</Typography>)}
              </CardContent>
            </SCard>
            <SCard sx={{ borderTop: `3px solid ${T.ok}` }}>
              <CardContent sx={{ p: '16px', '&:last-child': { pb: '16px' } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: T.textFaint }}>Forecast Period</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '6px', backgroundColor: T.okBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CalendarIcon sx={{ fontSize: 15, color: T.ok }} /></Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, color: T.textHead, lineHeight: 1, letterSpacing: '-0.5px' }}>{forecastMonths}{' '}<Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color: T.textMuted }}>Month{forecastMonths > 1 ? 's' : ''}</Typography></Typography>
                <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 0.5 }}>{forecastPeriodLabel}</Typography>
              </CardContent>
            </SCard>
          </Box>

          {/* Chart */}
          <SCard sx={{ mb: '14px' }}>
            <CardContent sx={{ p: '18px 20px 14px', '&:last-child': { pb: '14px' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>Predicted Patient Volume</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {availableForecastYears.length > 1 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography sx={{ fontSize: 11.5, color: T.textMuted, fontWeight: 500 }}>Year:</Typography>
                      <Select value={selectedForecastYear || ''} size="small" onChange={(e) => setSelectedForecastYear(Number(e.target.value))} sx={{ ...SelectSx, minWidth: 90, fontSize: 12, '& .MuiSelect-select': { py: '4px', px: '10px' } }}>
                        {availableForecastYears.map(yr => (<MenuItemComponent key={yr} value={yr} sx={{ fontSize: 12 }}>{yr}</MenuItemComponent>))}
                      </Select>
                    </Box>
                  )}
                  {selectedDisease !== 'all' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: '10px', py: '3px', borderRadius: '20px', backgroundColor: `${chartColor}18`, border: `1px solid ${chartColor}40` }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: chartColor }} />
                      <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: chartColor }}>{getDiseaseInfo(selectedDisease).label}</Typography>
                    </Box>
                  )}
                </Box>
              </Box>
              {isViewingHistoricalYear && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '7px 12px', mb: 1.5, borderRadius: '7px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <HistoryIcon sx={{ fontSize: 13, color: '#D97706' }} />
                  <Typography sx={{ fontSize: 11.5, color: '#92400E' }}>Viewing archived <strong>{selectedForecastYear}</strong> forecast — these results are from a previous generation run.</Typography>
                </Box>
              )}
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                    <YAxis axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                    <RechartsTooltip content={<ComboTooltip />} />
                    <Bar dataKey="actual" name="Actual" fill={chartColor} fillOpacity={0.80} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                    <Line type="monotone" dataKey="predicted" name="Predicted" stroke={chartColor} strokeWidth={2} strokeDasharray="5 3" dot={{ fill: chartColor, r: 3, strokeWidth: 0 }} activeDot={{ r: 4, fill: chartColor, stroke: '#fff', strokeWidth: 2 }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}>
                  <Typography sx={{ fontSize: 13, color: T.textMuted }}>{hasSavedForecasts ? 'Select a barangay to view its forecast' : 'No forecast data available yet.'}</Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Box sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: chartColor, opacity: 0.8 }} /><Typography sx={{ fontSize: 11, color: T.textMuted }}>Actual</Typography></Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Box sx={{ width: 18, height: 2, borderRadius: 1, backgroundColor: chartColor, backgroundImage: `repeating-linear-gradient(90deg, ${chartColor} 0, ${chartColor} 5px, transparent 5px, transparent 8px)` }} /><Typography sx={{ fontSize: 11, color: T.textMuted }}>Predicted</Typography></Box>
              </Box>
            </CardContent>
          </SCard>

          {/* Results */}
          <SCard>
            <CardContent sx={{ p: '18px 20px', '&:last-child': { pb: '20px' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>Results</Typography>
                  {isViewingHistoricalYear && (<Box sx={{ px: '8px', py: '2px', borderRadius: '20px', backgroundColor: T.warnBg, border: `1px solid ${T.warnBorder}` }}><Typography sx={{ fontSize: 10.5, color: T.warn, fontWeight: 600 }}>{selectedForecastYear}</Typography></Box>)}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>{selectedDisease === 'all' ? 'All Categories' : getDiseaseInfo(selectedDisease).label}</Typography>
                  <Box sx={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: T.textFaint }} />
                  <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>{selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : selectedBarangay}</Typography>
                </Box>
              </Box>
              {trendItems.length === 0 ? (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 13, color: T.textMuted }}>{hasSavedForecasts ? 'Select a barangay to see results' : 'No forecast data available yet.'}</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {trendItems.map((item, i) => (<ResultRow key={`${selectedBarangay}-${item.disease || 'warning'}-${i}`} item={item} forecastData={forecastData} selectedBarangay={selectedBarangay} />))}
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