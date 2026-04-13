import { getSavedForecast, getDiseaseBreakdown, getAgeSexBreakdown } from './services/api';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Box, Typography, Card, CardContent, Button,
  LinearProgress, Chip, IconButton, Tooltip, CircularProgress, Skeleton,
  MenuItem, Select, FormControl,
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  CheckCircle as CheckCircleIcon,
  LocationOn as LocationOnIcon,
  FileDownload as FileDownloadIcon,
  TableChart as TableChartIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Close as CloseIcon,
  CalendarMonth as CalendarMonthIcon,
  Male as MaleIcon,
  Female as FemaleIcon,
  BarChart as BarChartIcon,
  InsertDriveFile as FileIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  Info as InfoIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  LineChart, Line, ReferenceLine,
} from 'recharts';
import Sidebar, { T } from './Sidebar';

const ALL_BARANGAYS = '__ALL__';
const ROWS_PER_PAGE = 20;

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const MONTH_SHORT = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec'
];

const DISEASE_DISPLAY_MAP = {
  dengue_cases:                { label: 'Dengue',           color: T.blue,       icon: '🦟' },
  diarrhea_cases:              { label: 'Diarrhea',         color: T.neutralBar, icon: '💧' },
  respiratory_cases:           { label: 'Respiratory',      color: T.danger,     icon: '🫁' },
  cardiovascular_cases:        { label: 'Cardiovascular',   color: '#EF4444',    icon: '❤️' },
  urinary_cases:               { label: 'Urinary/Renal',    color: '#F59E0B',    icon: '🩺' },
  gastrointestinal_cases:      { label: 'Gastrointestinal', color: '#10B981',    icon: '🫃' },
  diabetes_cases:              { label: 'Diabetes',         color: T.warnAccent, icon: '🩸' },
  skin_cases:                  { label: 'Skin Disease',     color: '#F97316',    icon: '🩹' },
  musculoskeletal_cases:       { label: 'Musculoskeletal',  color: '#6366F1',    icon: '🦴' },
  injury_cases:                { label: 'Injury/Trauma',    color: '#DC2626',    icon: '🏥' },
  infectious_cases:            { label: 'Other Infectious', color: '#059669',    icon: '🦠' },
  tuberculosis_cases:          { label: 'Tuberculosis',     color: '#92400E',    icon: '🫁' },
  viral_infection_cases:       { label: 'Viral Infection',  color: '#8B5CF6',    icon: '🧬' },
  blood_metabolic_cases:       { label: 'Blood/Metabolic',  color: '#BE185D',    icon: '🩸' },
  neurological_cases:          { label: 'Neurological',     color: '#1D4ED8',    icon: '🧠' },
  sensory_cases:               { label: 'Eye/Ear',          color: '#0891B2',    icon: '👁️' },
  mental_health_cases:         { label: 'Mental Health',    color: '#7C3AED',    icon: '🧠' },
  maternal_cases:              { label: 'Maternal/OB',      color: '#EC4899',    icon: '👶' },
  neoplasm_cases:              { label: 'Neoplasm/Cancer',  color: '#374151',    icon: '🔬' },
  leptospirosis_cases:         { label: 'Leptospirosis',    color: '#065F46',    icon: '🐀' },
  hypertension_cases:          { label: 'Hypertension',     color: '#F87171',    icon: '❤️' },
  malnutrition_cases:          { label: 'Malnutrition',     color: '#A3A3A3',    icon: '⚕️' },
  malnutrition_prevalence_pct: { label: 'Malnutrition %',   color: '#A3A3A3',    icon: '⚕️' },
  covid_cases:                 { label: 'COVID-19',         color: '#7C3AED',    icon: '🦠' },
  congenital_cases:            { label: 'Congenital',       color: '#64748B',    icon: '🧬' },
  other_cases:                 { label: 'Other',            color: '#94A3B8',    icon: '🏥' },
};

const getDiseaseInfo = (col) => {
  if (DISEASE_DISPLAY_MAP[col]) return DISEASE_DISPLAY_MAP[col];
  const label = col.replace(/_cases$/, '').replace(/_prevalence_pct$/, ' %')
    .replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return { label, color: T.neutralBar, icon: '🏥' };
};

const SCard = ({ children, sx = {} }) => (
  <Card sx={{ borderRadius: '10px', backgroundColor: '#FFFFFF',
    border: `1px solid ${T.border}`, boxShadow: 'none', ...sx }}>
    {children}
  </Card>
);

const Tag = ({ label, bg, color, border }) => (
  <Chip label={label} size="small" sx={{ backgroundColor: bg, color, border: `1px solid ${border}`,
    fontWeight: 500, fontSize: 10.5, borderRadius: '4px', height: 20 }} />
);

const trendColor  = (t) => t === 'increasing' ? T.danger   : t === 'decreasing' ? T.ok   : T.textMuted;
const trendBg     = (t) => t === 'increasing' ? T.dangerBg : t === 'decreasing' ? T.okBg : '#F9FAFB';
const trendBorder = (t) => t === 'increasing' ? T.dangerBorder : t === 'decreasing' ? T.okBorder : T.borderSoft;

const TrendTag = ({ trend }) => {
  const labels = { increasing: '↑ Increasing', decreasing: '↓ Decreasing', stable: '— Stable' };
  return <Tag label={labels[trend] || '— Stable'} bg={trendBg(trend)} color={trendColor(trend)} border={trendBorder(trend)} />;
};

const formatMonthLabel = (period) => {
  if (!period) return period;
  const m = period.match(/^(\d{4})-(\d{2})/);
  if (m) return MONTH_NAMES[parseInt(m[2], 10) - 1] ?? period;
  return period;
};

const getPeriodYear  = (period) => { const m = period?.match(/^(\d{4})/);           return m ? m[1] : null; };
const getPeriodMonth = (period) => { const m = period?.match(/^\d{4}-(\d{2})/);     return m ? m[1] : null; };

const tooltipStyle = {
  borderRadius: '8px', border: `1px solid ${T.border}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: 12, color: T.textBody, background: '#FFFFFF',
};

const computeTrendPct = (first, last) => {
  if (first === 0 && last === 0) return 'stable';
  if (first === 0) return last > 0 ? 'increasing' : 'stable';
  const pct = ((last - first) / first) * 100;
  if (pct > 10)  return 'increasing';
  if (pct < -10) return 'decreasing';
  return 'stable';
};

const getTrendFromEntries = (diseaseEntries) => {
  if (!diseaseEntries || diseaseEntries.length < 2) return 'stable';
  const sorted = [...diseaseEntries].sort((a, b) => a.period.localeCompare(b.period));
  const first  = sorted[0].predictedValue ?? 0;
  const last   = sorted[sorted.length - 1].predictedValue ?? 0;
  return computeTrendPct(first, last);
};

// ── Trend Legend ──────────────────────────────────────────────────────────────
const TrendLegend = ({ showThresholds = false }) => (
  <Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      <Typography sx={{ fontSize: 11, color: T.textFaint, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trend:</Typography>
      {[
        { trend: 'increasing', icon: <TrendingUpIcon sx={{ fontSize: 12 }} />,   label: 'Increasing' },
        { trend: 'stable',     icon: <RemoveIcon     sx={{ fontSize: 12 }} />,   label: 'Stable'     },
        { trend: 'decreasing', icon: <TrendingDownIcon sx={{ fontSize: 12 }} />, label: 'Decreasing' },
      ].map(({ trend, icon, label }) => (
        <Box key={trend} sx={{ display: 'flex', alignItems: 'center', gap: 0.5,
          px: 1, py: 0.35, borderRadius: '5px',
          backgroundColor: trendBg(trend), border: `1px solid ${trendBorder(trend)}` }}>
          <Box sx={{ color: trendColor(trend), display: 'flex', alignItems: 'center' }}>{icon}</Box>
          <Typography sx={{ fontSize: 11, fontWeight: 500, color: trendColor(trend) }}>{label}</Typography>
        </Box>
      ))}
    </Box>
    {showThresholds && (
      <Box sx={{ mt: 1.25, p: '10px 14px', borderRadius: '8px',
        backgroundColor: '#F8FAFC', border: `1px solid ${T.borderSoft}` }}>
        <Typography sx={{ fontSize: 11, color: T.textMuted, fontWeight: 600, mb: 0.75 }}>
          How trend is determined — comparing first vs. last forecasted month:
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {[
            { icon: <TrendingUpIcon sx={{ fontSize: 12, color: T.danger, mt: '1px', flexShrink: 0 }} />, label: 'Increasing', color: T.danger, text: 'predicted cases increased by', threshold: 'more than 10%', example: '100 → 111+ cases' },
            { icon: <RemoveIcon sx={{ fontSize: 12, color: T.textMuted, mt: '1px', flexShrink: 0 }} />,   label: 'Stable',     color: T.textMuted, text: 'change is within', threshold: '±10%', example: '100 → 90–110 cases' },
            { icon: <TrendingDownIcon sx={{ fontSize: 12, color: T.ok, mt: '1px', flexShrink: 0 }} />,    label: 'Decreasing', color: T.ok, text: 'predicted cases decreased by', threshold: 'more than 10%', example: '100 → 89 or fewer cases' },
          ].map(({ icon, label, color, text, threshold, example }) => (
            <Box key={label} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
              {icon}
              <Typography sx={{ fontSize: 11, color: T.textBody, lineHeight: 1.5 }}>
                <strong style={{ color }}>{label}</strong>
                {' '}— {text} <strong>{threshold}</strong> from the first to the last forecast month.
                {' '}<span style={{ color: T.textFaint }}>({example})</span>
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    )}
  </Box>
);

// ── Table Loading Skeleton ────────────────────────────────────────────────────
const TableLoadingSkeleton = ({ barangayCount }) => (
  <Box>
    <Box sx={{ px: 2, py: '10px', borderBottom: `1px solid ${T.border}`,
      backgroundColor: T.pageBg, display: 'flex', gap: 2 }}>
      {['Barangay', 'Year', 'Month', 'Total Forecast', 'Trend', 'Details'].map((h, i) => (
        <Skeleton key={h} variant="text" width={i === 0 ? 100 : i === 3 ? 90 : 60} height={14} sx={{ borderRadius: 1 }} />
      ))}
    </Box>
    {Array.from({ length: Math.min(barangayCount * 2, 8) }).map((_, i) => (
      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2,
        px: 2, py: '11px', borderBottom: `1px solid ${T.borderSoft}`, backgroundColor: '#FFFFFF' }}>
        <Skeleton variant="text" width={110} height={14} sx={{ borderRadius: 1 }} />
        <Skeleton variant="text" width={36}  height={14} sx={{ borderRadius: 1 }} />
        <Skeleton variant="text" width={62}  height={14} sx={{ borderRadius: 1 }} />
        <Skeleton variant="text" width={60}  height={14} sx={{ borderRadius: 1, ml: 'auto' }} />
        <Skeleton variant="rounded" width={80} height={20} sx={{ borderRadius: '5px' }} />
        <Skeleton variant="rounded" width={42} height={22} sx={{ borderRadius: '6px' }} />
      </Box>
    ))}
    <Box sx={{ px: 2.5, py: 2, borderTop: `1px solid ${T.borderSoft}`,
      display: 'flex', alignItems: 'center', gap: 1.5, backgroundColor: T.pageBg }}>
      <CircularProgress size={14} sx={{ color: T.blue }} />
      <Typography sx={{ fontSize: 12, color: T.textMuted }}>
        Loading forecast data for {barangayCount} barangay{barangayCount !== 1 ? 's' : ''}…
      </Typography>
    </Box>
  </Box>
);

// ── Age/Sex Breakdown Chart ───────────────────────────────────────────────────
const AgeSexChart = ({ barangay, disease, city }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const catKey = disease?.replace('_cases', '');

  useEffect(() => {
    if (!catKey || !barangay) return;
    setLoading(true);
    setData(null);
    getAgeSexBreakdown(catKey, barangay, city || '')
      .then(setData)
      .catch(e => console.error('Age/sex breakdown failed:', e))
      .finally(() => setLoading(false));
  }, [catKey, barangay, city]);

  if (!catKey) return null;
  const info = getDiseaseInfo(disease);

  if (loading) return (
    <Box sx={{ p: 2 }}><Skeleton variant="rectangular" height={180} sx={{ borderRadius: '8px' }} /></Box>
  );

  if (!data || data.total_cases === 0) return (
    <Box sx={{ py: 3, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 12, color: T.textMuted }}>No age/sex breakdown data available.</Typography>
    </Box>
  );

  const chartData   = data.breakdown.filter(d => d.total > 0);
  const totalMale   = data.total_male;
  const totalFemale = data.total_female;
  const total       = data.total_cases;
  const malePct     = total > 0 ? Math.round((totalMale   / total) * 100) : 0;
  const femalePct   = total > 0 ? Math.round((totalFemale / total) * 100) : 0;
  const peak        = chartData.reduce((a, b) => b.total > a.total ? b : a, chartData[0]);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75,
          borderRadius: '8px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <MaleIcon sx={{ fontSize: 14, color: '#3B82F6' }} />
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#1D4ED8' }}>
            Male: {totalMale.toLocaleString()} ({malePct}%)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75,
          borderRadius: '8px', backgroundColor: '#FDF2F8', border: '1px solid #FBCFE8' }}>
          <FemaleIcon sx={{ fontSize: 14, color: '#EC4899' }} />
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#BE185D' }}>
            Female: {totalFemale.toLocaleString()} ({femalePct}%)
          </Typography>
        </Box>
        {peak && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75,
            borderRadius: '8px', backgroundColor: `${info.color}12`, border: `1px solid ${info.color}30` }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: info.color }}>
              Peak: Age {peak.age_group} ({peak.total.toLocaleString()} cases)
            </Typography>
          </Box>
        )}
      </Box>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
          <XAxis dataKey="age_group" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: T.textFaint }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: T.textFaint }} />
          <RechartsTooltip contentStyle={tooltipStyle}
            formatter={(value, name) => [value.toLocaleString(), name === 'male' ? 'Male' : 'Female']} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} formatter={v => v === 'male' ? 'Male' : 'Female'} />
          <Bar dataKey="male"   name="male"   fill="#3B82F6" radius={[3,3,0,0]} maxBarSize={24} />
          <Bar dataKey="female" name="female" fill="#EC4899" radius={[3,3,0,0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
      {peak && (
        <Box sx={{ mt: 1.5, p: '8px 12px', borderRadius: '6px',
          backgroundColor: `${info.color}10`, border: `1px solid ${info.color}25` }}>
          <Typography sx={{ fontSize: 12, color: T.textBody, lineHeight: 1.5 }}>
            The <strong>Age {peak.age_group}</strong> group has the highest number of{' '}
            <strong>{info.label}</strong> cases
            {barangay !== ALL_BARANGAYS ? ` in ${barangay}` : ''} with{' '}
            <strong>{peak.total.toLocaleString()}</strong> total cases
            ({peak.male.toLocaleString()} male, {peak.female.toLocaleString()} female).
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// ── Disease Detail Panel ──────────────────────────────────────────────────────
const DiseaseDetailPanel = ({ barangay, forecastData, city, onClose }) => {
  const allDiseases = forecastData?.disease_columns || Object.keys(forecastData?.predictions || {});

  const [selectedDisease, setSelectedDisease] = useState('total');

  const isTotal = selectedDisease === 'total';
  const disease = isTotal ? null : selectedDisease;
  const info    = isTotal ? { label: 'Total', color: T.blue, icon: '📊' } : getDiseaseInfo(disease);

  // ── Forecast values (always from predictions, never from historical) ────────
  const preds = isTotal
    ? (forecastData?.forecast_dates || []).map((_, i) =>
        allDiseases.reduce((s, d) => s + ((forecastData.predictions[d] || [])[i] ?? 0), 0))
    : forecastData?.predictions?.[disease] || [];

  const dates     = forecastData?.forecast_dates || [];
  const histDates = forecastData?.historical_data?.dates || [];
  const histVals  = isTotal
    ? histDates.map((_, i) =>
        allDiseases.reduce((s, d) => s + ((forecastData?.historical_data?.[d] || [])[i] ?? 0), 0))
    : forecastData?.historical_data?.[disease] || [];

  // ── Stat cards — always forecast values ────────────────────────────────────
  const roundedPreds = preds.map(v => Math.round(v ?? 0));

  // Card 2: this month's forecast
  const currentYM = new Date().toISOString().slice(0, 7);
  const thisMonthIdx = dates.findIndex(d => d.slice(0, 7) === currentYM);
  const resolvedThisIdx       = thisMonthIdx >= 0 ? thisMonthIdx : 0;
  const thisMonthForecastVal  = roundedPreds[resolvedThisIdx] ?? 0;
  const thisMonthForecastDate = dates[resolvedThisIdx]?.slice(0, 7) || '';

  // Card 3: next month's forecast — always one step after this month
  const resolvedNextIdx       = resolvedThisIdx + 1;
  const nextMonthForecastVal  = roundedPreds[resolvedNextIdx] ?? roundedPreds[resolvedThisIdx] ?? 0;
  const nextMonthForecastDate = dates[resolvedNextIdx]?.slice(0, 7) || dates[resolvedThisIdx]?.slice(0, 7) || '';

  const allHistYears = [...new Set(histDates.map(d => d.slice(0,4)).filter(Boolean))].sort();
  const [selectedHistYear, setSelectedHistYear] = useState(
    allHistYears.length > 0 ? allHistYears[allHistYears.length - 1] : null
  );

  const [breakdown, setBreakdown] = useState(null);
  const [bLoading,  setBLoading]  = useState(false);

  useEffect(() => {
    if (!disease) return;
    setBLoading(true);
    setBreakdown(null);
    getDiseaseBreakdown(disease.replace('_cases', ''), barangay, city || '', 6)
      .then(setBreakdown)
      .catch(() => setBreakdown(null))
      .finally(() => setBLoading(false));
  }, [disease, barangay, city]);

  const filteredHistIndices = histDates.reduce((acc, d, i) => {
    if (!selectedHistYear || d.slice(0,4) === selectedHistYear) acc.push(i);
    return acc;
  }, []);
  const filteredHistDates = filteredHistIndices.map(i => histDates[i]);
  const filteredHistVals  = filteredHistIndices.map(i => histVals[i]);

  const actualChartData = filteredHistDates.map((d, i) => ({
    month: d.slice(0,7),
    label: formatMonthLabel(d.slice(0,7)),
    actual: Math.round(filteredHistVals[i] ?? 0),
  }));

  // Forecast chart — only predicted values from forecast_dates
  const forecastChartData = dates.map((d, i) => ({
    month: d.slice(0,7),
    label: formatMonthLabel(d.slice(0,7)),
    predicted: roundedPreds[i] ?? 0,
  }));

  const trend = preds.length < 2
    ? 'stable'
    : computeTrendPct(preds[0] ?? 0, preds[preds.length - 1] ?? 0);

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <Box onClick={e => e.stopPropagation()} sx={{
        width: '92vw', maxWidth: 900, maxHeight: '92vh',
        backgroundColor: '#FFFFFF', borderRadius: '14px',
        border: `1px solid ${T.border}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <Box sx={{ px: 3, pt: 2, pb: 1.75, borderBottom: `1px solid ${T.borderSoft}`,
          backgroundColor: T.pageBg, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '8px',
                backgroundColor: `${info.color}18`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 16 }}>
                {info.icon || '🏥'}
              </Box>
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textHead }}>{info.label}</Typography>
                <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
                  {barangay === ALL_BARANGAYS ? 'All Barangays' : barangay}
                  {city ? ` · ${city}` : ''}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <TrendTag trend={trend} />
              <IconButton size="small" onClick={onClose}
                sx={{ p: 0.5, color: T.textMuted, '&:hover': { color: T.textHead, backgroundColor: T.borderSoft } }}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.25, alignItems: 'stretch' }}>

            {/* Card 1: Disease selector */}
            <Box sx={{ p: '10px 12px', borderRadius: '10px',
              backgroundColor: '#FFFFFF', border: `1px solid ${T.border}`,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 0.75 }}>
              <Typography sx={{ fontSize: 10.5, color: T.textMuted, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.5px' }}>Disease</Typography>
              <FormControl size="small" fullWidth>
                <Select
                  value={selectedDisease}
                  onChange={e => setSelectedDisease(e.target.value)}
                  sx={{
                    fontSize: 12, fontWeight: 600, color: T.textHead,
                    backgroundColor: 'transparent', borderRadius: '7px',
                    '.MuiOutlinedInput-notchedOutline': { borderColor: T.borderSoft },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.blue },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: T.blue },
                    '.MuiSelect-select': { py: '5px', px: '8px', display: 'flex', alignItems: 'center', gap: 0.5 },
                  }}
                  renderValue={(val) => {
                    if (val === 'total') return (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                        <span style={{ fontSize: 13 }}>📊</span>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.textHead }}>Total</Typography>
                      </Box>
                    );
                    const dInfo = getDiseaseInfo(val);
                    return (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                        <span style={{ fontSize: 13 }}>{dInfo.icon || '🏥'}</span>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.textHead }}>{dInfo.label}</Typography>
                      </Box>
                    );
                  }}
                >
                  {/* Total option */}
                  <MenuItem value="total">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <span style={{ fontSize: 14 }}>📊</span>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: 12.5, color: T.textHead }}>Total</Typography>
                        <Typography sx={{ fontSize: 10.5, color: T.textFaint }}>
                          {Math.round(
                            allDiseases.reduce((s, d) => s + ((forecastData?.predictions?.[d] || [])[0] ?? 0), 0)
                          ).toLocaleString()} first mo.
                        </Typography>
                      </Box>
                      {selectedDisease === 'total' && <CheckCircleIcon sx={{ fontSize: 13, color: T.blue }} />}
                    </Box>
                  </MenuItem>

                  {/* Individual disease options */}
                  {allDiseases.map(d => {
                    const dInfo  = getDiseaseInfo(d);
                    const firstVal = Math.round((forecastData?.predictions?.[d] || [])[0] ?? 0);
                    return (
                      <MenuItem key={d} value={d}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                          <span style={{ fontSize: 14 }}>{dInfo.icon || '🏥'}</span>
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 12.5, color: T.textHead }}>{dInfo.label}</Typography>
                            <Typography sx={{ fontSize: 10.5, color: T.textFaint }}>{firstVal.toLocaleString()} first mo.</Typography>
                          </Box>
                          {d === selectedDisease && <CheckCircleIcon sx={{ fontSize: 13, color: T.blue }} />}
                        </Box>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Box>

            {/* Card 2: This Month Forecast */}
            <Box sx={{ p: '10px 12px', borderRadius: '10px',
              backgroundColor: '#FFFFFF', border: `1px solid ${T.border}` }}>
              <Typography sx={{ fontSize: 10.5, color: T.textMuted, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                This Month Forecast
              </Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 700, color: T.textHead, lineHeight: 1.2, mt: 0.5 }}>
                {thisMonthForecastVal.toLocaleString()}
              </Typography>
              <Typography sx={{ fontSize: 11, color: T.textFaint, mt: 0.25 }}>
                {thisMonthForecastDate}
              </Typography>
            </Box>

            {/* Card 3: Next Month Forecast */}
            <Box sx={{ p: '10px 12px', borderRadius: '10px',
              backgroundColor: '#FFFFFF', border: `1px solid ${T.border}` }}>
              <Typography sx={{ fontSize: 10.5, color: T.textMuted, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Next Month Forecast
              </Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 700, color: T.textHead, lineHeight: 1.2, mt: 0.5 }}>
                {nextMonthForecastVal.toLocaleString()}
              </Typography>
              <Typography sx={{ fontSize: 11, color: T.textFaint, mt: 0.25 }}>
                {nextMonthForecastDate}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ overflow: 'auto', flex: 1, p: 3 }}>

          {/* Forecast chart */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.textHead }}>Forecast</Typography>
              <TrendTag trend={trend} />
            </Box>
            {forecastChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={forecastChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: T.textFaint }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: T.textFaint }} />
                  <RechartsTooltip contentStyle={tooltipStyle}
                    formatter={(value) => [value.toLocaleString(), 'Predicted Cases']} />
                  <Line type="monotone" dataKey="predicted" name="Predicted" stroke={info.color}
                    strokeWidth={2} strokeDasharray="5 3"
                    dot={{ r: 3, fill: info.color }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ py: 4, textAlign: 'center', backgroundColor: T.pageBg,
                borderRadius: '8px', border: `1px solid ${T.borderSoft}` }}>
                <Typography sx={{ fontSize: 12, color: T.textMuted }}>No forecast data available.</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 16, height: 2, borderRadius: 1,
                  background: `repeating-linear-gradient(90deg,${info.color} 0,${info.color} 5px,transparent 5px,transparent 8px)` }} />
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>Predicted</Typography>
              </Box>
            </Box>
          </Box>

          {/* Actual data chart */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.textHead }}>Actual Data</Typography>
              {allHistYears.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <Select value={selectedHistYear || ''} onChange={e => setSelectedHistYear(e.target.value)} displayEmpty
                    sx={{ fontSize: 12, color: T.textBody, backgroundColor: '#FFFFFF', borderRadius: '7px',
                      '.MuiOutlinedInput-notchedOutline': { borderColor: T.border },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.blue },
                      '.MuiSelect-select': { py: '5px', px: '10px' } }}>
                    <MenuItem value="" sx={{ fontSize: 12 }}>All Years</MenuItem>
                    {allHistYears.map(yr => (
                      <MenuItem key={yr} value={yr} sx={{ fontSize: 12 }}>{yr}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
            {actualChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={actualChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: T.textFaint }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: T.textFaint }} />
                  <RechartsTooltip contentStyle={tooltipStyle}
                    formatter={(value) => [value.toLocaleString(), 'Actual Cases']} />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke={T.ok}
                    strokeWidth={2} dot={{ r: 3, fill: T.ok }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ py: 4, textAlign: 'center', backgroundColor: T.pageBg,
                borderRadius: '8px', border: `1px solid ${T.borderSoft}` }}>
                <Typography sx={{ fontSize: 12, color: T.textMuted }}>No actual data available.</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 2, borderRadius: 1, backgroundColor: T.ok }} />
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>Actual</Typography>
              </Box>
            </Box>
          </Box>

          {/* Age & Sex Breakdown — only for specific disease, not total */}
          {!isTotal && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <BarChartIcon sx={{ fontSize: 14, color: T.blue }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.textHead }}>Age & Sex Breakdown</Typography>
              </Box>
              <AgeSexChart barangay={barangay} disease={disease} city={city} />
            </Box>
          )}

          {/* Top Specific Diseases — only for specific disease, not total */}
          {!isTotal && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <BarChartIcon sx={{ fontSize: 14, color: T.blue }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.textHead }}>
                  Top Specific Diseases — {info.label}
                </Typography>
              </Box>
              {bLoading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {[1,2,3].map(i => <Skeleton key={i} variant="rectangular" height={32} sx={{ borderRadius: '6px' }} />)}
                </Box>
              ) : breakdown?.breakdown?.length > 0 ? (
                <Box>
                  {breakdown.breakdown.map((item, idx) => {
                    const maxCases = breakdown.breakdown[0]?.total_cases || 1;
                    const pct      = Math.round((item.total_cases / maxCases) * 100);
                    const colors   = [info.color, '#60A5FA', '#34D399', '#FBBF24', '#A78BFA'];
                    const barColor = colors[idx] || info.color;
                    return (
                      <Box key={idx} sx={{ mb: 1.25 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography sx={{ fontSize: 12, fontWeight: idx === 0 ? 600 : 400,
                            color: idx === 0 ? T.textHead : T.textBody, flex: 1, mr: 1, lineHeight: 1.4 }}>
                            {idx === 0 ? '★ ' : ''}{item.label?.replace(/^[A-Z0-9]+\.?[0-9]*;\s*/, '')}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                            {item.total_male > 0 && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <MaleIcon sx={{ fontSize: 11, color: '#3B82F6' }} />
                                <Typography sx={{ fontSize: 11, color: T.textMuted }}>{item.total_male.toLocaleString()}</Typography>
                              </Box>
                            )}
                            {item.total_female > 0 && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <FemaleIcon sx={{ fontSize: 11, color: '#EC4899' }} />
                                <Typography sx={{ fontSize: 11, color: T.textMuted }}>{item.total_female.toLocaleString()}</Typography>
                              </Box>
                            )}
                            <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.textHead, minWidth: 48, textAlign: 'right' }}>
                              {item.total_cases.toLocaleString()}
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
                </Box>
              ) : (
                <Typography sx={{ fontSize: 12, color: T.textMuted }}>
                  No specific disease breakdown available.
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

// ── Filter Date Picker ────────────────────────────────────────────────────────
const FilterDatePicker = ({ availableYears, selectedYear, selectedMonth, onSelect }) => {
  const [popupOpen, setPopupOpen] = useState(false);
  const [localYear,  setLocalYear]  = useState(selectedYear  || null);
  const [localMonth, setLocalMonth] = useState(selectedMonth || null);
  const popupRef = useRef(null);
  const btnRef   = useRef(null);

  const handleOpen = () => {
    setLocalYear(selectedYear || null);
    setLocalMonth(selectedMonth || null);
    setPopupOpen(true);
  };

  useEffect(() => {
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target) &&
          btnRef.current   && !btnRef.current.contains(e.target))
        setPopupOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleApply = () => { onSelect({ year: localYear, month: localMonth }); setPopupOpen(false); };
  const handleClear = () => { setLocalYear(null); setLocalMonth(null); onSelect({ year: null, month: null }); setPopupOpen(false); };

  const buttonLabel = () => {
    if (!selectedYear && !selectedMonth) return 'Filter Date';
    if (selectedYear && selectedMonth) return `${MONTH_NAMES[parseInt(selectedMonth, 10) - 1]} ${selectedYear}`;
    return selectedYear || 'Filter Date';
  };

  const hasFilter = !!(selectedYear || selectedMonth);

  return (
    <Box>
      <Button ref={btnRef} size="small" onClick={handleOpen}
        startIcon={<FilterListIcon sx={{ fontSize: 13 }} />}
        sx={{ textTransform: 'none', fontSize: 12, fontWeight: 600,
          color: hasFilter ? T.blue : T.textBody,
          border: `1.5px solid ${hasFilter ? T.blue : T.border}`,
          borderRadius: '8px', px: 1.75, py: '5px',
          backgroundColor: hasFilter ? T.blueDim : '#FFFFFF',
          '&:hover': { borderColor: T.blue, color: T.blue, backgroundColor: T.blueDim } }}>
        {buttonLabel()}
      </Button>

      {popupOpen && ReactDOM.createPortal(
        <>
          <Box onClick={() => setPopupOpen(false)}
            sx={{ position: 'fixed', inset: 0, zIndex: 1399, backgroundColor: 'rgba(0,0,0,0.28)' }} />
          <Box ref={el => { popupRef.current = el; }} sx={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 1400, backgroundColor: '#FFFFFF', border: `1px solid ${T.border}`,
            borderRadius: '14px', boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
            width: 380, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 2.5, py: 1.75, borderBottom: `1px solid ${T.borderSoft}`,
              backgroundColor: T.pageBg, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterListIcon sx={{ fontSize: 13, color: T.blue }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textHead }}>Filter Date</Typography>
              </Box>
              <IconButton size="small" onClick={() => setPopupOpen(false)} sx={{ p: 0.4, color: T.textMuted }}>
                <CloseIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Box>

            <Box sx={{ p: 2.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: T.textMuted,
                textTransform: 'uppercase', letterSpacing: '0.5px', mb: 1 }}>Year</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', mb: 2.5 }}>
                <Box onClick={() => { setLocalYear(null); setLocalMonth(null); }}
                  sx={{ py: '8px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center',
                    border: `1.5px solid ${!localYear ? T.blue : T.border}`,
                    backgroundColor: !localYear ? T.blueDim : '#FFFFFF',
                    '&:hover': { borderColor: T.blue, backgroundColor: T.blueDim } }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: !localYear ? 600 : 400,
                    color: !localYear ? T.blue : T.textBody }}>All</Typography>
                </Box>
                {availableYears.map(yr => (
                  <Box key={yr} onClick={() => { setLocalYear(yr); setLocalMonth(null); }}
                    sx={{ py: '8px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center',
                      border: `1.5px solid ${localYear === yr ? T.blue : T.border}`,
                      backgroundColor: localYear === yr ? T.blueDim : '#FFFFFF',
                      '&:hover': { borderColor: T.blue } }}>
                    <Typography sx={{ fontSize: 11.5, fontWeight: localYear === yr ? 600 : 400,
                      color: localYear === yr ? T.blue : T.textBody }}>{yr}</Typography>
                  </Box>
                ))}
              </Box>

              <Box sx={{ opacity: localYear ? 1 : 0.4, pointerEvents: localYear ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: T.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Month <span style={{ fontSize: 10, fontWeight: 400 }}>(optional)</span>
                  </Typography>
                  {localMonth && (
                    <Typography onClick={() => setLocalMonth(null)}
                      sx={{ fontSize: 11, color: T.blue, cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>
                      Clear month
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {MONTH_SHORT.map((mn, idx) => {
                    const val = String(idx + 1).padStart(2, '0');
                    const isSelected = localMonth === val;
                    return (
                      <Box key={val} onClick={() => setLocalMonth(isSelected ? null : val)}
                        sx={{ py: '7px', borderRadius: '7px', cursor: 'pointer', textAlign: 'center',
                          border: `1.5px solid ${isSelected ? T.blue : T.border}`,
                          backgroundColor: isSelected ? T.blueDim : '#FFFFFF',
                          '&:hover': { borderColor: T.blue, backgroundColor: T.blueDim } }}>
                        <Typography sx={{ fontSize: 11.5, fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? T.blue : T.textBody }}>{mn}</Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              {(localYear || localMonth) && (
                <Box sx={{ mt: 2, px: 1.5, py: 1, borderRadius: '7px',
                  backgroundColor: T.blueDim, border: `1px solid rgba(37,99,235,0.2)` }}>
                  <Typography sx={{ fontSize: 11.5, color: T.blue, fontWeight: 500 }}>
                    Showing: {localMonth ? `${MONTH_NAMES[parseInt(localMonth, 10) - 1]} ` : 'All months of '}{localYear}
                  </Typography>
                </Box>
              )}
            </Box>

            <Box sx={{ px: 2.5, py: 1.75, borderTop: `1px solid ${T.borderSoft}`,
              display: 'flex', justifyContent: 'space-between', gap: 1, backgroundColor: T.pageBg }}>
              <Button size="small" onClick={handleClear}
                sx={{ textTransform: 'none', fontSize: 12, color: T.textMuted,
                  border: `1px solid ${T.border}`, borderRadius: '7px', px: 1.75, py: 0.5 }}>
                Clear All
              </Button>
              <Button size="small" onClick={handleApply}
                sx={{ textTransform: 'none', fontSize: 12, fontWeight: 600,
                  backgroundColor: T.blue, color: '#fff', borderRadius: '7px', px: 2, py: 0.5,
                  '&:hover': { backgroundColor: T.blueMid } }}>
                Apply
              </Button>
            </Box>
          </Box>
        </>
      , document.body)}
    </Box>
  );
};

// ── Export ────────────────────────────────────────────────────────────────────
const computeTrend = (diseaseEntries) => {
  if (!diseaseEntries || diseaseEntries.length < 2) return 'Stable';
  const sorted = [...diseaseEntries].sort((a, b) => a.period.localeCompare(b.period));
  const first  = sorted[0].predictedValue ?? 0;
  const last   = sorted[sorted.length - 1].predictedValue ?? 0;
  const t = computeTrendPct(first, last);
  return t === 'increasing' ? 'Increasing' : t === 'decreasing' ? 'Decreasing' : 'Stable';
};

// ── Beautiful Export ──────────────────────────────────────────────────────────
// Drop-in replacement for the exportTableData function in Prediction.jsx
// Supports: 'pdf' (HTML report → print-to-PDF), 'csv', 'txt'

const exportTableData = async (format, forecastHistory, selectedBarangays, availableDiseases, cityLabel) => {
  if (!forecastHistory?.length || selectedBarangays.size === 0) return;

  const diseases = availableDiseases.length > 0
    ? availableDiseases
    : [...new Set(forecastHistory.map(h => h.disease))];

  const lookup = {};
  forecastHistory.forEach(h => {
    if (!selectedBarangays.has(h.barangay)) return;
    if (!lookup[h.barangay]) lookup[h.barangay] = {};
    if (!lookup[h.barangay][h.period]) lookup[h.barangay][h.period] = {};
    lookup[h.barangay][h.period][h.disease] = h;
  });

  const city = localStorage.getItem('datasetCity') || '';
  const breakdownCache = {};
  const breakdownKeys = [];
  [...selectedBarangays].forEach(barangay => {
    diseases.forEach(d => {
      const key = `${barangay}::${d.replace('_cases', '')}`;
      if (!breakdownCache[key]) breakdownKeys.push({ barangay, catKey: d.replace('_cases', ''), key });
    });
  });

  await Promise.allSettled(
    breakdownKeys.map(({ barangay, catKey, key }) =>
      getDiseaseBreakdown(catKey, barangay, city, 1)
        .then(data => { breakdownCache[key] = data?.breakdown?.[0]?.label?.replace(/^[A-Z0-9]+\.?[0-9]*;\s*/, '') || '—'; })
        .catch(() => { breakdownCache[key] = '—'; })
    )
  );

  const rows = [];
  [...selectedBarangays].forEach(barangay => {
    const diseaseTrendMap = {};
    diseases.forEach(d => {
      const entries = forecastHistory.filter(h => h.barangay === barangay && h.disease === d);
      diseaseTrendMap[d] = computeTrend(entries);
    });

    Object.keys(lookup[barangay] || {}).sort().forEach(period => {
      const diseaseMap = lookup[barangay][period] || {};
      diseases.forEach(d => {
        const entry = diseaseMap[d];
        const predicted = Math.round(entry?.predictedValue ?? 0);
        const trend = diseaseTrendMap[d] || 'Stable';
        const catKey = d.replace('_cases', '');
        const topDisease = breakdownCache[`${barangay}::${catKey}`] || '—';
        const dInfo = getDiseaseInfo(d);
        rows.push({ barangay, year: getPeriodYear(period) || '', month: formatMonthLabel(period), period, category: dInfo.label, color: dInfo.color, disease: d, predicted, trend, topDisease });
      });
    });
  });

  if (rows.length === 0) return;
  const timestamp = new Date().toISOString().slice(0, 10);

  // ── CSV Export ──────────────────────────────────────────────────────────────
  if (format === 'csv') {
    const headers = ['Barangay', 'Year', 'Month', 'Disease Category', 'Predicted Cases', 'Trend', 'Top Specific Disease (Analysis)'];
    const csvRows = [
      headers.join(','),
      ...rows.map(r => [`"${r.barangay}"`, r.year, r.month, `"${r.category}"`, r.predicted, r.trend, `"${r.topDisease}"`].join(',')),
    ];
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `forecast_${timestamp}.csv`; a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // ── TXT Export ─────────────────────────────────────────────────────────────
  if (format === 'txt') {
    const lines = ['PREDICTHEALTH — BARANGAY FORECAST REPORT', '='.repeat(66)];
    if (cityLabel) lines.push(`City     : ${cityLabel}`);
    lines.push(`Generated: ${new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}`);
    lines.push(`Barangays: ${[...selectedBarangays].join(', ')}`);
    lines.push('');

    const grouped = {};
    rows.forEach(r => {
      if (!grouped[r.barangay]) grouped[r.barangay] = {};
      const key = `${r.year}-${r.month}`;
      if (!grouped[r.barangay][key]) grouped[r.barangay][key] = [];
      grouped[r.barangay][key].push(r);
    });

    Object.entries(grouped).forEach(([barangay, periods]) => {
      lines.push('─'.repeat(66));
      lines.push(`BARANGAY: ${barangay.toUpperCase()}`);
      lines.push('');
      Object.entries(periods).forEach(([, diseaseRows]) => {
        const { year, month } = diseaseRows[0];
        const total = Math.round(diseaseRows.reduce((s, r) => s + r.predicted, 0));
        lines.push(`  📅 ${month} ${year}   (Total Forecast: ${total.toLocaleString()} cases)`);
        lines.push(`  ${'Disease Category'.padEnd(24)} ${'Predicted'.padStart(9)}   ${'Trend'.padEnd(12)}  Top Specific Disease`);
        lines.push(`  ${'-'.repeat(80)}`);
        diseaseRows.forEach(r => {
          const trendIcon = r.trend === 'Increasing' ? '↑' : r.trend === 'Decreasing' ? '↓' : '—';
          lines.push(`  ${r.category.padEnd(24)} ${String(r.predicted).padStart(9)}   ${`${trendIcon} ${r.trend}`.padEnd(12)}  ${r.topDisease}`);
        });
        lines.push('');
      });
    });

    lines.push('='.repeat(66));
    lines.push('End of Report — PredictHealth');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `forecast_${timestamp}.txt`; a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // ── PDF / HTML Report Export ───────────────────────────────────────────────
  if (format === 'pdf') {
    // Build per-barangay data structures
    const barangayList = [...selectedBarangays];

    // Aggregate: all periods, per barangay
    const barangayData = {};
    barangayList.forEach(brgy => {
      const brgyRows = rows.filter(r => r.barangay === brgy);
      const periods = [...new Set(brgyRows.map(r => r.period))].sort();
      const diseaseList = [...new Set(brgyRows.map(r => r.disease))];

      // Per-disease totals & trends
      const diseaseSummary = diseaseList.map(d => {
        const dRows = brgyRows.filter(r => r.disease === d);
        const total = dRows.reduce((s, r) => s + r.predicted, 0);
        const trend = dRows[0]?.trend || 'Stable';
        const info = getDiseaseInfo(d);
        const monthlyVals = periods.map(p => {
          const found = dRows.find(r => r.period === p);
          return found ? found.predicted : 0;
        });
        // Peak month
        let peakIdx = 0;
        monthlyVals.forEach((v, i) => { if (v > monthlyVals[peakIdx]) peakIdx = i; });
        const peakMonth = periods[peakIdx] ? formatMonthLabel(periods[peakIdx]) + ' ' + getPeriodYear(periods[peakIdx]) : '—';
        return { disease: d, label: info.label, color: info.color, total, trend, peakMonth, monthlyVals, share: 0 };
      });

      const grandTotal = diseaseSummary.reduce((s, d) => s + d.total, 0);
      diseaseSummary.forEach(d => { d.share = grandTotal > 0 ? ((d.total / grandTotal) * 100).toFixed(1) : '0.0'; });
      diseaseSummary.sort((a, b) => b.total - a.total);

      // Monthly totals
      const monthlyTotals = periods.map(p => {
        const pRows = brgyRows.filter(r => r.period === p);
        return { period: p, label: formatMonthLabel(p), year: getPeriodYear(p), total: pRows.reduce((s, r) => s + r.predicted, 0) };
      });

      // Trend stats
      const increasing = diseaseSummary.filter(d => d.trend === 'Increasing').length;
      const decreasing = diseaseSummary.filter(d => d.trend === 'Decreasing').length;
      const stable = diseaseSummary.filter(d => d.trend === 'Stable').length;

      // Overall trend
      const firstTotal = monthlyTotals[0]?.total || 0;
      const lastTotal = monthlyTotals[monthlyTotals.length - 1]?.total || 0;
      const overallPct = firstTotal > 0 ? (((lastTotal - firstTotal) / firstTotal) * 100).toFixed(1) : '0.0';
      const overallTrend = parseFloat(overallPct) > 10 ? 'increase' : parseFloat(overallPct) < -10 ? 'decrease' : 'remain stable';

      // Peak month
      let peakMonthObj = monthlyTotals[0];
      monthlyTotals.forEach(m => { if (m.total > peakMonthObj.total) peakMonthObj = m; });

      barangayData[brgy] = { diseaseSummary, monthlyTotals, grandTotal, increasing, decreasing, stable, overallPct, overallTrend, peakMonthObj, periods, diseaseList };
    });

    // City-wide summary
    const cityDiseaseMap = {};
    rows.forEach(r => {
      if (!cityDiseaseMap[r.disease]) cityDiseaseMap[r.disease] = { label: r.category, color: r.color, total: 0, trend: r.trend, peakVal: 0, peakMonth: '' };
      cityDiseaseMap[r.disease].total += r.predicted;
    });
    // Determine peak month per disease across all barangays
    diseases.forEach(d => {
      if (!cityDiseaseMap[d]) return;
      const dRows = rows.filter(r => r.disease === d);
      const periodTotals = {};
      dRows.forEach(r => { periodTotals[r.period] = (periodTotals[r.period] || 0) + r.predicted; });
      let peakP = Object.keys(periodTotals)[0];
      Object.keys(periodTotals).forEach(p => { if (periodTotals[p] > (periodTotals[peakP] || 0)) peakP = p; });
      cityDiseaseMap[d].peakMonth = peakP ? `${formatMonthLabel(peakP)} ${getPeriodYear(peakP)}` : '—';
      // Re-derive city trend from per-barangay trends
      const trendCounts = { Increasing: 0, Decreasing: 0, Stable: 0 };
      barangayList.forEach(brgy => {
        const bd = barangayData[brgy];
        const ds = bd.diseaseSummary.find(x => x.disease === d);
        if (ds) trendCounts[ds.trend]++;
      });
      const dominant = Object.entries(trendCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Stable';
      cityDiseaseMap[d].trend = dominant;
    });

    const cityDiseases = Object.entries(cityDiseaseMap)
      .map(([d, v]) => ({ disease: d, ...v }))
      .sort((a, b) => b.total - a.total);
    const cityTotal = cityDiseases.reduce((s, d) => s + d.total, 0);
    cityDiseases.forEach(d => { d.share = cityTotal > 0 ? ((d.total / cityTotal) * 100).toFixed(1) : '0.0'; });

    // Top disease by barangay
    const topBarangay = barangayList.reduce((top, brgy) =>
      (barangayData[brgy].grandTotal > (barangayData[top]?.grandTotal || 0)) ? brgy : top,
      barangayList[0]
    );

    const cityIncreasing = cityDiseases.filter(d => d.trend === 'Increasing').length;
    const cityIncPct = cityDiseases.length > 0 ? Math.round((cityIncreasing / cityDiseases.length) * 100) : 0;

    // ── SVG Chart Builders ──────────────────────────────────────────────────

    // Mini bar chart SVG
    const buildBarChart = (items, width = 480, height = 220) => {
      if (!items.length) return '<svg></svg>';
      const maxVal = Math.max(...items.map(i => i.value));
      const barH = Math.floor((height - 40) / items.length) - 4;
      const labelW = 130;
      const barMaxW = width - labelW - 60;

      const bars = items.map((item, i) => {
        const barW = maxVal > 0 ? Math.round((item.value / maxVal) * barMaxW) : 0;
        const y = 10 + i * (barH + 4);
        const color = item.color || '#3B82F6';
        return `
          <text x="${labelW - 8}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="10" fill="#6B7280"
            font-family="Inter,system-ui,sans-serif">${item.label.length > 18 ? item.label.slice(0, 17) + '…' : item.label}</text>
          <rect x="${labelW}" y="${y}" width="${barW}" height="${barH}" rx="3" fill="${color}" opacity="0.85"/>
          <text x="${labelW + barW + 5}" y="${y + barH / 2 + 4}" font-size="10" fill="#374151"
            font-family="Inter,system-ui,sans-serif" font-weight="600">${item.value.toLocaleString()}</text>
        `;
      }).join('');

      return `<svg viewBox="0 0 ${width} ${items.length * (barH + 4) + 20}" xmlns="http://www.w3.org/2000/svg" width="${width}">${bars}</svg>`;
    };

    // Line chart SVG
    const buildLineChart = (seriesList, periodLabels, width = 480, height = 180) => {
      const pad = { top: 16, right: 16, bottom: 28, left: 38 };
      const cW = width - pad.left - pad.right;
      const cH = height - pad.top - pad.bottom;
      const n = periodLabels.length;
      if (n < 2) return '';

      const allVals = seriesList.flatMap(s => s.values);
      const maxV = Math.max(...allVals, 1);
      const minV = 0;

      const xOf = i => pad.left + (i / (n - 1)) * cW;
      const yOf = v => pad.top + cH - ((v - minV) / (maxV - minV)) * cH;

      // Grid lines
      const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => {
        const v = Math.round(maxV * f);
        const y = yOf(v);
        return `<line x1="${pad.left}" y1="${y}" x2="${pad.left + cW}" y2="${y}" stroke="#E5E7EB" stroke-width="1"/>
                 <text x="${pad.left - 4}" y="${y + 3.5}" text-anchor="end" font-size="9" fill="#9CA3AF" font-family="Inter,sans-serif">${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}</text>`;
      }).join('');

      // X axis labels
      const xLabels = periodLabels.map((label, i) => {
        if (n <= 8 || i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0) {
          return `<text x="${xOf(i)}" y="${pad.top + cH + 14}" text-anchor="middle" font-size="9" fill="#9CA3AF" font-family="Inter,sans-serif">${label.slice(0, 3)}</text>`;
        }
        return '';
      }).join('');

      // Lines & dots
      const linesAndDots = seriesList.map(series => {
        const pts = series.values.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ');
        const dots = series.values.map((v, i) =>
          `<circle cx="${xOf(i)}" cy="${yOf(v)}" r="3" fill="${series.color}" stroke="#fff" stroke-width="1.5"/>`
        ).join('');
        const dash = series.dashed ? 'stroke-dasharray="5,3"' : '';
        return `<polyline points="${pts}" fill="none" stroke="${series.color}" stroke-width="2" ${dash} stroke-linejoin="round"/>
                 ${dots}`;
      }).join('');

      // Legend
      const legendItems = seriesList.map((s, i) =>
        `<g transform="translate(${pad.left + i * 90}, ${height - 4})">
           <rect x="0" y="-6" width="12" height="3" rx="1.5" fill="${s.color}" ${s.dashed ? 'opacity="0.7"' : ''}/>
           <text x="16" y="0" font-size="9" fill="#6B7280" font-family="Inter,sans-serif">${s.label.slice(0, 11)}</text>
         </g>`
      ).join('');

      return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        ${gridLines}
        ${xLabels}
        ${linesAndDots}
        ${legendItems}
      </svg>`;
    };

    // Donut chart SVG
    const buildDonutChart = (segments, size = 120) => {
      const cx = size / 2, cy = size / 2, r = size * 0.38, innerR = size * 0.24;
      let startAngle = -Math.PI / 2;
      const total = segments.reduce((s, seg) => s + seg.value, 0);

      const paths = segments.map(seg => {
        const angle = total > 0 ? (seg.value / total) * 2 * Math.PI : 0;
        const endAngle = startAngle + angle;
        const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
        const ix1 = cx + innerR * Math.cos(endAngle), iy1 = cy + innerR * Math.sin(endAngle);
        const ix2 = cx + innerR * Math.cos(startAngle), iy2 = cy + innerR * Math.sin(startAngle);
        const largeArc = angle > Math.PI ? 1 : 0;
        const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
        startAngle = endAngle;
        return `<path d="${d}" fill="${seg.color}" opacity="0.9"/>`;
      }).join('');

      const pcts = segments.map((s, i) => {
        const angle = total > 0 ? (s.value / total) * 2 * Math.PI : 0;
        const mid = -Math.PI / 2 + segments.slice(0, i).reduce((acc, x) => acc + (x.value / total) * 2 * Math.PI, 0) + angle / 2;
        const px = cx + (r + 10) * Math.cos(mid), py = cy + (r + 10) * Math.sin(mid);
        const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
        if (pct < 5) return '';
        return `<text x="${px}" y="${py}" text-anchor="middle" font-size="8.5" fill="${s.color}" font-family="Inter,sans-serif" font-weight="700">${pct}%</text>`;
      }).join('');

      return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        ${paths}
        ${pcts}
        <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="white"/>
      </svg>`;
    };

    // Trend color helpers
    const tC = t => t === 'Increasing' ? '#DC2626' : t === 'Decreasing' ? '#16A34A' : '#6B7280';
    const tBg = t => t === 'Increasing' ? '#FEF2F2' : t === 'Decreasing' ? '#F0FDF4' : '#F9FAFB';
    const tBd = t => t === 'Increasing' ? '#FECACA' : t === 'Decreasing' ? '#BBF7D0' : '#E5E7EB';
    const tArrow = t => t === 'Increasing' ? '↑' : t === 'Decreasing' ? '↓' : '—';

    const trendPill = t => `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:999px;background:${tBg(t)};border:1px solid ${tBd(t)};color:${tC(t)};font-size:11px;font-weight:600;">${tArrow(t)} ${t}</span>`;

    // ── Build HTML ──────────────────────────────────────────────────────────

    // Executive summary page
    const cityBarChart = buildBarChart(cityDiseases.slice(0, 10).map(d => ({ label: d.label, value: d.total, color: d.color })), 460, 240);
    const cityDonut = buildDonutChart([
      { value: cityIncreasing, color: '#EF4444', label: 'Increasing' },
      { value: cityDiseases.filter(d => d.trend === 'Stable').length, color: '#94A3B8', label: 'Stable' },
      { value: cityDiseases.filter(d => d.trend === 'Decreasing').length, color: '#22C55E', label: 'Decreasing' },
    ], 120);

    const cityTableRows = cityDiseases.map((d, i) => `
      <tr style="border-bottom:1px solid #F3F4F6;">
        <td style="padding:9px 12px;font-weight:${i === 0 ? 700 : 400};color:${i === 0 ? '#111827' : '#374151'};font-size:13px;">
          ${i === 0 ? '★ ' : ''}${d.label}
        </td>
        <td style="padding:9px 12px;text-align:right;font-weight:700;font-size:13px;color:#111827;">${d.total.toLocaleString()}</td>
        <td style="padding:9px 12px;text-align:right;font-size:13px;color:#6B7280;">${d.share}%</td>
        <td style="padding:9px 12px;text-align:center;">${trendPill(d.trend)}</td>
        <td style="padding:9px 12px;text-align:center;font-size:13px;color:#6B7280;">${d.peakMonth}</td>
      </tr>
    `).join('');

    // Per-barangay sections
    const barangaySections = barangayList.map(brgy => {
      const bd = barangayData[brgy];
      const { diseaseSummary, monthlyTotals, grandTotal, increasing, decreasing, stable, overallPct, overallTrend, peakMonthObj, periods } = bd;

      // Line chart: top 5 diseases + total
      const top5 = diseaseSummary.slice(0, 5);
      const chartSeries = [
        ...top5.map(d => ({ label: d.label, color: d.color, values: d.monthlyVals, dashed: false })),
        { label: 'Total', color: '#1D4ED8', values: monthlyTotals.map(m => m.total), dashed: true },
      ];
      const periodLabels = periods.map(p => formatMonthLabel(p));
      const lineChart = buildLineChart(chartSeries, periodLabels, 560, 200);

      // Bar chart: disease burden
      const barChart = buildBarChart(diseaseSummary.map(d => ({ label: d.label, value: d.total, color: d.color })), 480, 240);

      // Disease trend table rows
      const diseaseTrendRows = diseaseSummary.map(d => `
        <tr style="border-bottom:1px solid #F3F4F6;">
          <td style="padding:8px 12px;font-size:13px;color:#374151;">${d.label}</td>
          <td style="padding:8px 12px;text-align:right;font-weight:700;font-size:13px;color:#111827;">${d.total.toLocaleString()}</td>
          <td style="padding:8px 12px;text-align:right;font-size:13px;color:#6B7280;">${d.share}%</td>
          <td style="padding:8px 12px;text-align:center;">${trendPill(d.trend)}</td>
          <td style="padding:8px 12px;text-align:center;font-size:13px;color:#6B7280;">${d.peakMonth}</td>
        </tr>
      `).join('');

      // Monthly data table — top diseases columns
      const colDiseases = diseaseSummary.slice(0, 6);
      const headerCols = colDiseases.map(d =>
        `<th style="padding:9px 10px;text-align:right;font-size:11px;font-weight:600;color:#6B7280;white-space:nowrap;">${d.label}</th>`
      ).join('') + '<th style="padding:9px 10px;text-align:right;font-size:11px;font-weight:600;color:#374151;">TOTAL</th>';

      const monthRows = monthlyTotals.map(m => {
        const mRows = rows.filter(r => r.barangay === brgy && r.period === m.period);
        const dCells = colDiseases.map(d => {
          const mRow = mRows.find(r => r.disease === d.disease);
          return `<td style="padding:8px 10px;text-align:right;font-size:12px;color:#374151;">${(mRow?.predicted || 0).toLocaleString()}</td>`;
        }).join('');
        return `<tr style="border-bottom:1px solid #F3F4F6;">
          <td style="padding:8px 12px;font-size:12px;font-weight:500;color:#374151;white-space:nowrap;">${m.label}</td>
          <td style="padding:8px 10px;text-align:center;font-size:12px;color:#6B7280;">${m.year}</td>
          ${dCells}
          <td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:700;color:#111827;">${m.total.toLocaleString()}</td>
        </tr>`;
      }).join('');

      const totalRow = `<tr style="border-top:2px solid #E5E7EB;background:#F8FAFC;">
        <td colspan="2" style="padding:9px 12px;font-size:12px;font-weight:700;color:#111827;">TOTAL</td>
        ${colDiseases.map(d => `<td style="padding:9px 10px;text-align:right;font-size:12px;font-weight:700;color:#111827;">${d.total.toLocaleString()}</td>`).join('')}
        <td style="padding:9px 10px;text-align:right;font-size:12px;font-weight:700;color:#111827;">${grandTotal.toLocaleString()}</td>
      </tr>`;

      // Analysis bullets
      const topDisease = diseaseSummary[0];
      const increasingDiseases = diseaseSummary.filter(d => d.trend === 'Increasing');
      const analysisPoints = [
        `<strong>${topDisease.label}</strong> accounts for the largest share of cases (${topDisease.total.toLocaleString()} cases, ${topDisease.share}% of total).`,
        increasingDiseases.length > 0
          ? `<strong>${increasingDiseases.map(d => d.label).join(', ')}</strong> show${increasingDiseases.length === 1 ? 's' : ''} an increasing trend.`
          : 'No disease categories show an increasing trend.',
        `Peak disease burden is projected for <strong>${peakMonthObj.label} ${peakMonthObj.year}</strong> with ${peakMonthObj.total.toLocaleString()} total cases.`,
        `Overall, total cases are forecast to <strong>${overallTrend} by ${Math.abs(parseFloat(overallPct))}%</strong> from ${monthlyTotals[0]?.label} ${monthlyTotals[0]?.year} to ${monthlyTotals[monthlyTotals.length - 1]?.label} ${monthlyTotals[monthlyTotals.length - 1]?.year}.`,
      ];

      return `
        <!-- ══ BARANGAY BREAK ══ -->
        <div style="page-break-before:always;"></div>

        <!-- Barangay Header -->
        <div style="background:linear-gradient(135deg,#1e3a5f 0%,#1D4ED8 100%);color:white;padding:28px 36px;border-radius:12px;margin-bottom:20px;">
          <div style="font-size:11px;letter-spacing:2px;opacity:0.7;text-transform:uppercase;margin-bottom:4px;">Barangay Report</div>
          <div style="font-size:26px;font-weight:800;letter-spacing:-0.5px;margin-bottom:2px;">${brgy}</div>
          <div style="font-size:13px;opacity:0.8;">${cityLabel || 'City'} · ${diseaseSummary.length} Disease Categories · ${periods.length} Month Forecast</div>
        </div>

        <!-- Stat Cards -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
          ${[
            { label: 'Total Forecast Cases', value: grandTotal.toLocaleString(), sub: 'All diseases, all months', color: '#1D4ED8' },
            { label: 'Increasing Trends', value: increasing, sub: 'Diseases rising >10%', color: '#DC2626' },
            { label: 'Decreasing Trends', value: decreasing, sub: 'Diseases falling >10%', color: '#16A34A' },
            { label: 'Months Forecasted', value: periods.length, sub: 'Forecast horizon', color: '#7C3AED' },
          ].map(c => `
            <div style="background:white;border:1px solid #E5E7EB;border-radius:10px;padding:16px 18px;">
              <div style="font-size:10px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">${c.label}</div>
              <div style="font-size:28px;font-weight:800;color:${c.color};line-height:1;">${c.value}</div>
              <div style="font-size:11px;color:#9CA3AF;margin-top:4px;">${c.sub}</div>
            </div>
          `).join('')}
        </div>

        <!-- Charts Row -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          <div style="background:white;border:1px solid #E5E7EB;border-radius:10px;padding:18px;">
            <div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:14px;">📈 Forecast Trend — All Diseases</div>
            ${lineChart}
          </div>
          <div style="background:white;border:1px solid #E5E7EB;border-radius:10px;padding:18px;">
            <div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:12px;">📊 Disease Burden Distribution</div>
            ${barChart}
          </div>
        </div>

        <!-- Analysis Box -->
        <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:18px;margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <div style="width:3px;height:16px;background:#1D4ED8;border-radius:2px;"></div>
            <div style="font-size:13px;font-weight:700;color:#1D4ED8;">Analysis — ${brgy}</div>
          </div>
          ${analysisPoints.map(pt => `
            <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
              <div style="width:5px;height:5px;background:#1D4ED8;border-radius:50%;margin-top:6px;flex-shrink:0;"></div>
              <div style="font-size:12.5px;color:#1E40AF;line-height:1.6;">${pt}</div>
            </div>
          `).join('')}
        </div>

        <!-- Disease Trend Summary Table -->
        <div style="background:white;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;margin-bottom:20px;">
          <div style="padding:14px 18px;border-bottom:1px solid #F3F4F6;background:#F8FAFC;">
            <div style="font-size:13px;font-weight:700;color:#111827;">Disease Trend Summary</div>
          </div>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#F8FAFC;">
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Disease</th>
                <th style="padding:9px 12px;text-align:right;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Total Cases</th>
                <th style="padding:9px 12px;text-align:right;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Share %</th>
                <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Trend</th>
                <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Peak Month</th>
              </tr>
            </thead>
            <tbody>${diseaseTrendRows}</tbody>
          </table>
        </div>

        <!-- Monthly Data Sheet -->
        <div style="background:white;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;margin-bottom:20px;">
          <div style="padding:14px 18px;border-bottom:1px solid #F3F4F6;background:#F8FAFC;display:flex;align-items:center;justify-content:space-between;">
            <div style="font-size:13px;font-weight:700;color:#111827;">Monthly Forecast Data Sheet</div>
            <div style="font-size:11px;color:#6B7280;">Showing top ${colDiseases.length} disease categories</div>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:600px;">
              <thead>
                <tr style="background:#F8FAFC;">
                  <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Month</th>
                  <th style="padding:9px 10px;text-align:center;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Year</th>
                  ${headerCols}
                </tr>
              </thead>
              <tbody>
                ${monthRows}
                ${totalRow}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    // ── Full HTML Document ──────────────────────────────────────────────────
    const genDate = new Date().toLocaleDateString('en-PH', { dateStyle: 'long' });
    const allPeriods = [...new Set(rows.map(r => r.period))].sort();
    const forecastPeriod = allPeriods.length
      ? `${formatMonthLabel(allPeriods[0])} ${getPeriodYear(allPeriods[0])} – ${formatMonthLabel(allPeriods[allPeriods.length - 1])} ${getPeriodYear(allPeriods[allPeriods.length - 1])}`
      : '—';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>PredictHealth — Forecast Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, system-ui, -apple-system, sans-serif;
      background: #F1F5F9;
      color: #111827;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { max-width: 960px; margin: 0 auto; padding: 36px 36px 48px; }
    @media print {
      body { background: white; }
      .page { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

<!-- Print Button (hidden on print) -->
<div class="no-print" style="position:fixed;top:18px;right:24px;z-index:999;display:flex;gap:10px;">
  <button onclick="window.print()" style="background:#1D4ED8;color:white;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;box-shadow:0 4px 12px rgba(29,78,216,0.3);">
    🖨️ Print / Save as PDF
  </button>
</div>

<div class="page">

  <!-- ── COVER PAGE ── -->
  <div style="background:linear-gradient(135deg,#0F172A 0%,#1e3a5f 50%,#1D4ED8 100%);color:white;padding:52px 48px;border-radius:16px;margin-bottom:28px;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-60px;right:-60px;width:280px;height:280px;background:rgba(255,255,255,0.04);border-radius:50%;"></div>
    <div style="position:absolute;bottom:-80px;left:-40px;width:220px;height:220px;background:rgba(255,255,255,0.03);border-radius:50%;"></div>
    <div style="position:relative;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px;">
        <div style="width:36px;height:36px;background:rgba(255,255,255,0.15);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;">🏥</div>
        <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.8;">PredictHealth</div>
      </div>
      <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;opacity:0.6;margin-bottom:10px;">Barangay Forecast Report</div>
      <div style="font-size:36px;font-weight:800;letter-spacing:-1px;margin-bottom:6px;line-height:1.1;">Disease Forecast<br/>& Analysis</div>
      <div style="font-size:15px;opacity:0.7;margin-bottom:32px;">City: ${cityLabel || 'N/A'}</div>
      <div style="display:grid;grid-template-columns:repeat(3,auto);gap:32px;">
        <div>
          <div style="font-size:11px;opacity:0.5;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Generated</div>
          <div style="font-size:14px;font-weight:600;">${genDate}</div>
        </div>
        <div>
          <div style="font-size:11px;opacity:0.5;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Barangays</div>
          <div style="font-size:14px;font-weight:600;">${barangayList.join(', ')}</div>
        </div>
        <div>
          <div style="font-size:11px;opacity:0.5;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Forecast Period</div>
          <div style="font-size:14px;font-weight:600;">${forecastPeriod}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Summary Stats -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px;">
    ${[
      { label: 'Barangays', value: barangayList.length, sub: 'Included in report', icon: '📍', color: '#1D4ED8' },
      { label: 'Disease Categories', value: diseases.length, sub: 'Tracked', icon: '🦠', color: '#7C3AED' },
      { label: 'Forecast Months', value: allPeriods.length, sub: 'Period', icon: '📅', color: '#0891B2' },
      { label: 'Total Predicted Cases', value: cityTotal.toLocaleString(), sub: 'Across all barangays', icon: '📊', color: '#DC2626' },
    ].map(c => `
      <div style="background:white;border:1px solid #E5E7EB;border-radius:10px;padding:18px;">
        <div style="font-size:18px;margin-bottom:6px;">${c.icon}</div>
        <div style="font-size:26px;font-weight:800;color:${c.color};line-height:1;margin-bottom:4px;">${c.value}</div>
        <div style="font-size:11px;font-weight:600;color:#111827;margin-bottom:2px;">${c.label}</div>
        <div style="font-size:10.5px;color:#9CA3AF;">${c.sub}</div>
      </div>
    `).join('')}
  </div>

  <!-- About box -->
  <div style="background:white;border:1px solid #E5E7EB;border-radius:10px;padding:18px 22px;margin-bottom:28px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <div style="width:3px;height:16px;background:#1D4ED8;border-radius:2px;"></div>
      <div style="font-size:13px;font-weight:700;color:#111827;">About This Report</div>
    </div>
    ${[
      `This report covers <strong>${barangayList.length} barangay(s)</strong> and includes forecasted case counts for <strong>${diseases.length} disease categories</strong> over <strong>${allPeriods.length} months</strong>.`,
      `Each section includes a line chart of predicted trends, a bar chart of disease burden, automated analysis, and a full data table per month.`,
      `Trend direction is determined by comparing the first and last forecasted month: <strong style="color:#DC2626;">Increasing (&gt;+10%)</strong>, <strong style="color:#6B7280;">Stable (±10%)</strong>, <strong style="color:#16A34A;">Decreasing (&lt;-10%)</strong>.`,
    ].map(pt => `
      <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:7px;">
        <div style="width:5px;height:5px;background:#1D4ED8;border-radius:50%;margin-top:6px;flex-shrink:0;"></div>
        <div style="font-size:12.5px;color:#374151;line-height:1.6;">${pt}</div>
      </div>
    `).join('')}
  </div>

  <!-- ══ EXECUTIVE SUMMARY ══ -->
  <div style="page-break-before:always;"></div>

  <div style="background:linear-gradient(135deg,#1e3a5f 0%,#1D4ED8 100%);color:white;padding:24px 36px;border-radius:12px;margin-bottom:20px;">
    <div style="font-size:11px;letter-spacing:2px;opacity:0.7;text-transform:uppercase;margin-bottom:4px;">Section 1</div>
    <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">Executive Summary</div>
    <div style="font-size:13px;opacity:0.7;margin-top:2px;">City-wide Overview Across All Selected Barangays</div>
  </div>

  <div style="display:grid;grid-template-columns:1fr auto;gap:16px;margin-bottom:20px;">
    <div style="background:white;border:1px solid #E5E7EB;border-radius:10px;padding:18px;">
      <div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:14px;">Total Forecast Cases by Disease Category</div>
      ${cityBarChart}
    </div>
    <div style="background:white;border:1px solid #E5E7EB;border-radius:10px;padding:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:180px;">
      <div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:12px;">Disease Trends</div>
      ${cityDonut}
      <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;">
        ${[
          { color: '#EF4444', label: `Increasing (${cityIncreasing})` },
          { color: '#94A3B8', label: `Stable (${cityDiseases.filter(d => d.trend === 'Stable').length})` },
          { color: '#22C55E', label: `Decreasing (${cityDiseases.filter(d => d.trend === 'Decreasing').length})` },
        ].map(l => `
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="width:10px;height:10px;background:${l.color};border-radius:2px;flex-shrink:0;"></div>
            <div style="font-size:11px;color:#374151;">${l.label}</div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- City-wide table -->
  <div style="background:white;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;margin-bottom:20px;">
    <div style="padding:14px 18px;border-bottom:1px solid #F3F4F6;background:#F8FAFC;">
      <div style="font-size:13px;font-weight:700;color:#111827;">Disease Burden Summary — All Barangays Combined</div>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#F8FAFC;">
          <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Disease Category</th>
          <th style="padding:9px 12px;text-align:right;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Total Forecast</th>
          <th style="padding:9px 12px;text-align:right;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Share %</th>
          <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Trend</th>
          <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Peak Month</th>
        </tr>
      </thead>
      <tbody>${cityTableRows}</tbody>
    </table>
  </div>

  <!-- Executive Insights -->
  <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:18px;margin-bottom:28px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <div style="width:3px;height:16px;background:#1D4ED8;border-radius:2px;"></div>
      <div style="font-size:13px;font-weight:700;color:#1D4ED8;">Executive Insights</div>
    </div>
    ${[
      `The most prevalent disease category is <strong>${cityDiseases[0]?.label}</strong> with ${cityDiseases[0]?.total.toLocaleString()} total forecasted cases.`,
      `<strong>${topBarangay}</strong> has the highest forecasted disease burden with ${barangayData[topBarangay]?.grandTotal.toLocaleString()} total cases.`,
      `<strong>${cityIncPct}%</strong> of disease-barangay combinations show an increasing trend — these should be prioritized for intervention.`,
      `A total of <strong>${cityTotal.toLocaleString()} cases</strong> are projected across all ${barangayList.length} barangay(s) during the forecast period.`,
    ].map(pt => `
      <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
        <div style="width:5px;height:5px;background:#1D4ED8;border-radius:50%;margin-top:6px;flex-shrink:0;"></div>
        <div style="font-size:12.5px;color:#1E40AF;line-height:1.6;">${pt}</div>
      </div>
    `).join('')}
  </div>

  <!-- ══ BARANGAY SECTIONS ══ -->
  ${barangaySections}

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #E5E7EB;text-align:center;">
    <div style="font-size:11px;color:#9CA3AF;">PredictHealth — Barangay Forecast Report · Generated ${genDate}</div>
  </div>

</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `forecast_report_${timestamp}.html`; a.click();
    URL.revokeObjectURL(url);
  }
};

const ExportMenu = ({ forecastHistory, confirmedBarangays, availableDiseases, cityLabel }) => {
  const [open,      setOpen]      = useState(false);
  const [exporting, setExporting] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const disabled = confirmedBarangays.size === 0 || forecastHistory.length === 0;

  const handleExport = async (format) => {
    setOpen(false); setExporting(true);
    try { await exportTableData(format, forecastHistory, confirmedBarangays, availableDiseases, cityLabel); }
    finally { setExporting(false); }
  };

  return (
    <Box ref={ref} sx={{ position: 'relative', flexShrink: 0 }}>
      <Tooltip title={disabled ? 'Confirm a barangay first' : 'Export forecast data'} placement="top">
        <span>
          <Button
            onClick={() => !disabled && !exporting && setOpen(o => !o)}
            disabled={disabled || exporting}
            startIcon={exporting ? <CircularProgress size={13} color="inherit" /> : <FileDownloadIcon sx={{ fontSize: 14 }} />}
            endIcon={!exporting && <ArrowDownIcon sx={{ fontSize: 13, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 500, color: T.textMuted,
              backgroundColor: '#FFFFFF', border: `1px solid ${T.border}`, borderRadius: '8px',
              px: 1.5, py: '6px', '&:hover': { backgroundColor: T.borderSoft, borderColor: T.blue },
              '&:disabled': { opacity: 0.5 } }}>
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        </span>
      </Tooltip>
      {open && (
        <Box sx={{ position: 'fixed', zIndex: 1400, backgroundColor: '#FFFFFF',
          border: `1px solid ${T.border}`, borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 190, overflow: 'hidden' }}
          ref={el => {
            if (el && ref.current) {
              const btn = ref.current.getBoundingClientRect();
              el.style.top   = (btn.bottom + 6) + 'px';
              el.style.right = (window.innerWidth - btn.right) + 'px';
            }
          }}>
          <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${T.borderSoft}`, backgroundColor: T.pageBg }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {confirmedBarangays.size} barangay{confirmedBarangays.size > 1 ? 's' : ''} selected
            </Typography>
          </Box>
          {[
  { format: 'pdf', label: 'Export as PDF Report', sub: 'Full report with charts', icon: '📄' },
  { format: 'csv', label: 'Export as CSV',         sub: 'Spreadsheet format',      icon: '📊' },
  { format: 'txt', label: 'Export as TXT',         sub: 'Plain text report',       icon: '📝' },
].map(opt => (
  <Box key={opt.format} onClick={() => handleExport(opt.format)}
    sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.25,
      cursor: 'pointer', '&:hover': { backgroundColor: T.borderSoft } }}>
    <span style={{ fontSize: 14 }}>{opt.icon}</span>
    <Box>
      <Typography sx={{ fontSize: 12.5, color: T.textBody, fontWeight: 500 }}>{opt.label}</Typography>
      <Typography sx={{ fontSize: 10.5, color: T.textFaint }}>{opt.sub}</Typography>
    </Box>
  </Box>
))}
        </Box>
      )}
    </Box>
  );
};

// ── Barangay Picker ───────────────────────────────────────────────────────────
const BarangayPicker = ({ availableBarangays, generatedBarangays, pending, onPendingChange, onConfirm, confirmed }) => {
  const [popupOpen, setPopupOpen] = useState(false);
  const popupRef = useRef(null);
  const btnRef   = useRef(null);

  const handleOpen = () => { onPendingChange(new Set(confirmed)); setPopupOpen(true); };

  useEffect(() => {
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target) &&
          btnRef.current   && !btnRef.current.contains(e.target))
        setPopupOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectableBarangays = availableBarangays.filter(b => generatedBarangays.has(b));
  const allSelected = selectableBarangays.length > 0 && selectableBarangays.every(b => pending.has(b));

  const toggle = (b) => {
    if (!generatedBarangays.has(b)) return;
    const next = new Set(pending);
    next.has(b) ? next.delete(b) : next.add(b);
    onPendingChange(next);
  };

  const handleCancel  = () => { onPendingChange(new Set(confirmed)); setPopupOpen(false); };
  const handleConfirm = () => { onConfirm(pending); setPopupOpen(false); };

  return (
    <Box>
      <Button ref={btnRef} size="small" onClick={handleOpen}
        startIcon={<LocationOnIcon sx={{ fontSize: 13 }} />}
        sx={{ textTransform: 'none', fontSize: 12, fontWeight: 600,
          color: popupOpen ? T.blue : T.textBody,
          border: `1.5px solid ${popupOpen ? T.blue : T.border}`,
          borderRadius: '8px', px: 1.75, py: '5px',
          backgroundColor: popupOpen ? T.blueDim : '#FFFFFF',
          '&:hover': { borderColor: T.blue, color: T.blue, backgroundColor: T.blueDim } }}>
        {confirmed.size > 0 ? `${confirmed.size} Barangay${confirmed.size > 1 ? 's' : ''} Selected` : 'Select Barangay'}
      </Button>

      {popupOpen && ReactDOM.createPortal(
        <>
          <Box onClick={handleCancel} sx={{ position: 'fixed', inset: 0, zIndex: 1399, backgroundColor: 'rgba(0,0,0,0.45)' }} />
          <Box ref={el => { popupRef.current = el; }} sx={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 1400, backgroundColor: '#FFFFFF', border: `1px solid ${T.border}`,
            borderRadius: '14px', boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
            width: '90vw', maxWidth: 760, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 2.5, py: 1.75, borderBottom: `1px solid ${T.borderSoft}`, backgroundColor: T.pageBg, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocationOnIcon sx={{ fontSize: 13, color: T.blue }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textHead }}>Select Barangay</Typography>
                {pending.size > 0 && (
                  <Box sx={{ px: 1, py: 0.2, borderRadius: '4px', backgroundColor: T.blueDim, border: '1px solid rgba(27,79,138,0.2)' }}>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: T.blue }}>{pending.size} selected</Typography>
                  </Box>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {selectableBarangays.length > 0 && (
                  <Typography onClick={() => onPendingChange(allSelected ? new Set() : new Set(selectableBarangays))}
                    sx={{ fontSize: 11.5, color: T.blue, cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </Typography>
                )}
                <IconButton size="small" onClick={handleCancel} sx={{ p: 0.4, color: T.textMuted }}>
                  <CloseIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Box>
            </Box>

            <Box sx={{ p: 2.5, flex: 1, overflowY: 'auto' }}>
              {availableBarangays.length === 0 ? (
                <Typography sx={{ fontSize: 12, color: T.textMuted, py: 1, textAlign: 'center' }}>No barangays available.</Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                  {availableBarangays.map(b => {
                    const isGenerated = generatedBarangays.has(b);
                    const isSelected  = pending.has(b);
                    return (
                      <Tooltip key={b} title={!isGenerated ? 'No forecast yet — generate from Dashboard first' : ''} placement="top">
                        <Box onClick={() => toggle(b)} sx={{
                          py: '8px', px: 1.25, borderRadius: '8px',
                          border: `1.5px solid ${isSelected ? T.blue : isGenerated ? T.border : T.borderSoft}`,
                          backgroundColor: isSelected ? T.blueDim : isGenerated ? '#FFFFFF' : '#F7F8FA',
                          cursor: isGenerated ? 'pointer' : 'not-allowed',
                          opacity: isGenerated ? 1 : 0.5,
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '5px',
                          transition: 'all 0.13s', userSelect: 'none',
                          '&:hover': isGenerated ? { borderColor: T.blue } : {},
                        }}>
                          {isSelected
                            ? <CheckCircleIcon sx={{ fontSize: 11, color: T.blue, flexShrink: 0 }} />
                            : <LocationOnIcon  sx={{ fontSize: 11, color: isGenerated ? T.textMuted : T.textFaint, flexShrink: 0 }} />}
                          <Typography sx={{ fontSize: 11.5, fontWeight: isSelected ? 600 : 400,
                            color: isSelected ? T.blue : isGenerated ? T.textBody : T.textFaint,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {b}
                          </Typography>
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              )}
            </Box>

            <Box sx={{ px: 2.5, py: 1.75, borderTop: `1px solid ${T.borderSoft}`,
              display: 'flex', justifyContent: 'flex-end', gap: 1, backgroundColor: T.pageBg }}>
              <Button size="small" onClick={handleCancel}
                sx={{ textTransform: 'none', fontSize: 12, color: T.textMuted,
                  border: `1px solid ${T.border}`, borderRadius: '7px', px: 1.75, py: 0.5 }}>
                Cancel
              </Button>
              <Button size="small" disabled={pending.size === 0} onClick={handleConfirm}
                startIcon={<TableChartIcon sx={{ fontSize: 12 }} />}
                sx={{ textTransform: 'none', fontSize: 12, fontWeight: 600,
                  backgroundColor: T.blue, color: '#fff', borderRadius: '7px', px: 1.75, py: 0.5,
                  '&:hover': { backgroundColor: T.blueMid },
                  '&:disabled': { backgroundColor: T.borderSoft, color: T.textFaint } }}>
                Confirm
              </Button>
            </Box>
          </Box>
        </>
      , document.body)}
    </Box>
  );
};

// ── Forecast Table ────────────────────────────────────────────────────────────
const ForecastTable = ({ forecastHistory, confirmedBarangays, availableDiseases,
                         selectedYear, selectedMonth, onRowClick }) => {
  const [page, setPage] = useState(1);

  const diseases = availableDiseases.length > 0
    ? availableDiseases
    : [...new Set(forecastHistory.map(h => h.disease))];

  const filteredHistory = forecastHistory.filter(h => {
    if (selectedYear  && getPeriodYear(h.period)  !== selectedYear)  return false;
    if (selectedMonth && getPeriodMonth(h.period) !== selectedMonth) return false;
    return true;
  });

  const lookup = {};
  filteredHistory.forEach(h => {
    if (!confirmedBarangays.has(h.barangay)) return;
    if (!lookup[h.barangay]) lookup[h.barangay] = {};
    if (!lookup[h.barangay][h.period]) lookup[h.barangay][h.period] = {};
    lookup[h.barangay][h.period][h.disease] = h;
  });

  const allRows = [];
  [...confirmedBarangays].forEach(barangay => {
    Object.keys(lookup[barangay] || {}).sort().forEach(period => {
      const diseaseMap = lookup[barangay][period] || {};
      const total      = Math.round(diseases.reduce((s, d) => s + (diseaseMap[d]?.predictedValue ?? 0), 0));
      const trendCount = { increasing: 0, decreasing: 0, stable: 0 };
      diseases.forEach(d => {
        const entries = forecastHistory.filter(h => h.barangay === barangay && h.disease === d);
        trendCount[getTrendFromEntries(entries)]++;
      });
      const rowTrend = Object.entries(trendCount).sort((a,b) => b[1]-a[1])[0]?.[0] || 'stable';
      allRows.push({ barangay, period, total, rowTrend });
    });
  });

  useEffect(() => { setPage(1); }, [selectedYear, selectedMonth, confirmedBarangays]);

  const totalPages = Math.max(1, Math.ceil(allRows.length / ROWS_PER_PAGE));
  const pageRows   = allRows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const thSx = {
    fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase',
    letterSpacing: '0.5px', padding: '10px 14px', textAlign: 'left',
    whiteSpace: 'nowrap', backgroundColor: T.pageBg, borderBottom: `1px solid ${T.border}`,
  };
  const tdSx = {
    fontSize: 12.5, color: T.textBody, padding: '10px 14px',
    borderBottom: `1px solid ${T.borderSoft}`, verticalAlign: 'middle',
  };

  if (allRows.length === 0) return (
    <Box sx={{ py: 5, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>No forecast data found for the selected filter.</Typography>
    </Box>
  );

  return (
    <Box>
      <Box sx={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thSx}>Barangay</th>
              <th style={thSx}>Year</th>
              <th style={thSx}>Month</th>
              <th style={{ ...thSx, textAlign: 'right' }}>Total Forecast</th>
              <th style={{ ...thSx, textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                  Trend
                  <Tooltip title={
                    <Box sx={{ p: 0.5 }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 600, mb: 0.5 }}>Trend is based on % change (first → last forecast month):</Typography>
                      {[
                        { icon: <TrendingUpIcon sx={{ fontSize: 11 }} />,   text: 'Increasing — cases rose more than 10%'     },
                        { icon: <RemoveIcon     sx={{ fontSize: 11 }} />,   text: 'Stable — change within ±10%'               },
                        { icon: <TrendingDownIcon sx={{ fontSize: 11 }} />, text: 'Decreasing — cases dropped more than 10%'  },
                      ].map(({ icon, text }) => (
                        <Box key={text} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                          {icon}
                          <Typography sx={{ fontSize: 11 }}>{text}</Typography>
                        </Box>
                      ))}
                    </Box>
                  } placement="top" arrow>
                    <InfoIcon sx={{ fontSize: 12, color: T.textFaint, cursor: 'help' }} />
                  </Tooltip>
                </Box>
              </th>
              <th style={{ ...thSx, textAlign: 'center' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(({ barangay, period, total, rowTrend }) => (
              <tr key={`${barangay}-${period}`} style={{ backgroundColor: '#FFFFFF' }}>
                <td style={{ ...tdSx, fontWeight: 600, color: T.textHead }}>{barangay}</td>
                <td style={{ ...tdSx, color: T.textMuted, fontWeight: 500 }}>{getPeriodYear(period)}</td>
                <td style={tdSx}>{formatMonthLabel(period)}</td>
                <td style={{ ...tdSx, textAlign: 'right', fontWeight: 700, color: T.textHead }}>{total.toLocaleString()}</td>
                <td style={{ ...tdSx, textAlign: 'center' }}><TrendTag trend={rowTrend} /></td>
                <td style={{ ...tdSx, textAlign: 'center' }}>
                  <Button size="small" onClick={() => onRowClick(barangay, period)}
                    sx={{ textTransform: 'none', fontSize: 11, fontWeight: 600,
                      color: T.blue, backgroundColor: T.blueDim,
                      border: '1px solid rgba(37,99,235,0.2)', borderRadius: '6px',
                      px: 1.25, py: 0.25, minWidth: 'auto',
                      '&:hover': { backgroundColor: 'rgba(37,99,235,0.12)' } }}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Box sx={{ px: 2.5, py: 1.75, borderTop: `1px solid ${T.borderSoft}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: T.pageBg, flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{ fontSize: 12, color: T.textMuted }}>
          Showing{' '}
          <strong style={{ color: T.textBody }}>{(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, allRows.length)}</strong>
          {' '}of{' '}
          <strong style={{ color: T.textBody }}>{allRows.length}</strong>
          {' '}entries
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <IconButton size="small" disabled={page === 1} onClick={() => setPage(p => p - 1)}
            sx={{ p: 0.5, border: `1px solid ${T.border}`, borderRadius: '7px',
              backgroundColor: '#FFFFFF', color: page === 1 ? T.textFaint : T.textBody,
              '&:hover': { borderColor: T.blue, color: T.blue } }}>
            <ChevronLeftIcon sx={{ fontSize: 16 }} />
          </IconButton>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === '...' ? (
                <Typography key={`e-${idx}`} sx={{ fontSize: 12, color: T.textFaint, px: 0.5 }}>…</Typography>
              ) : (
                <Box key={p} onClick={() => setPage(p)} sx={{
                  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '7px', cursor: 'pointer',
                  border: `1px solid ${page === p ? T.blue : T.border}`,
                  backgroundColor: page === p ? T.blue : '#FFFFFF',
                  '&:hover': { borderColor: T.blue, backgroundColor: page === p ? T.blue : T.blueDim },
                }}>
                  <Typography sx={{ fontSize: 12, fontWeight: page === p ? 700 : 400,
                    color: page === p ? '#fff' : T.textBody }}>{p}</Typography>
                </Box>
              )
            )}
          <IconButton size="small" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
            sx={{ p: 0.5, border: `1px solid ${T.border}`, borderRadius: '7px',
              backgroundColor: '#FFFFFF', color: page === totalPages ? T.textFaint : T.textBody,
              '&:hover': { borderColor: T.blue, color: T.blue } }}>
            <ChevronRightIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>
      <Box sx={{ px: 2.5, py: 2, borderTop: `1px solid ${T.borderSoft}`, backgroundColor: '#FAFBFC' }}>
        <TrendLegend showThresholds={true} />
      </Box>
    </Box>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const LS_CONFIRMED  = 'predictionConfirmedBarangays';
const LS_SEL_YEAR   = 'predictionSelectedYear';
const LS_SEL_MONTH  = 'predictionSelectedMonth';

const saveConfirmed = (set) => { try { localStorage.setItem(LS_CONFIRMED, JSON.stringify([...set])); } catch {} };
const loadConfirmed = () => {
  try { const s = localStorage.getItem(LS_CONFIRMED); return s ? new Set(JSON.parse(s)) : new Set(); }
  catch { return new Set(); }
};

const buildHistoryEntries = (result, brgy, cityLabel) => {
  const diseases = result.disease_columns || Object.keys(result.predictions || {});
  return diseases.flatMap(disease => {
    const preds    = result.predictions[disease] || [];
    const firstVal = preds[0] ?? 0;
    const lastVal  = preds[preds.length - 1] ?? 0;
    const trend    = preds.length >= 2 ? computeTrendPct(firstVal, lastVal) : 'stable';
    return result.forecast_dates.map((fd, i) => ({
      id: Date.now() + Math.random(),
      disease, label: getDiseaseInfo(disease).label,
      period: fd.slice(0, 7), predictedValue: preds[i] ?? 0,
      trend, barangay: brgy, city: result.city || cityLabel,
    }));
  });
};

const getCurrentYear  = () => String(new Date().getFullYear());
const getCurrentMonth = () => String(new Date().getMonth() + 1).padStart(2, '0');

// ── Main Prediction Page ──────────────────────────────────────────────────────
const Prediction = ({ onNavigate, onLogout }) => {
  const [forecastData,       setForecastData]       = useState(() => {
    try { const s = localStorage.getItem('cachedForecastData'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [availableBarangays, setAvailableBarangays] = useState([]);
  const [availableDiseases,  setAvailableDiseases]  = useState([]);
  const [forecastHistory,    setForecastHistory]    = useState([]);
  const [pendingBarangays,   setPendingBarangays]   = useState(new Set());
  const [confirmedBarangays, setConfirmedBarangays] = useState(() => loadConfirmed());
  const [selectedYear,       setSelectedYear]       = useState(() => { try { return localStorage.getItem(LS_SEL_YEAR)  || null; } catch { return null; } });
  const [selectedMonth,      setSelectedMonth]      = useState(() => { try { return localStorage.getItem(LS_SEL_MONTH) || null; } catch { return null; } });
  const [loadingBarangay,    setLoadingBarangay]    = useState(null);
  const [isInitializing,     setIsInitializing]     = useState(() => loadConfirmed().size > 0);
  const [detailPanel,        setDetailPanel]        = useState(null);
  const [detailForecast,     setDetailForecast]     = useState(null);
  const [detailLoading,      setDetailLoading]      = useState(false);

  const cityLabel = localStorage.getItem('datasetCity') || '';

  useEffect(() => {
    try {
      if (selectedYear)  localStorage.setItem(LS_SEL_YEAR,  selectedYear);
      else               localStorage.removeItem(LS_SEL_YEAR);
      if (selectedMonth) localStorage.setItem(LS_SEL_MONTH, selectedMonth);
      else               localStorage.removeItem(LS_SEL_MONTH);
    } catch {}
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    const dis = localStorage.getItem('diseaseColumns');
    if (dis) setAvailableDiseases(JSON.parse(dis));
    const bar = localStorage.getItem('availableBarangays');
    if (bar) setAvailableBarangays(JSON.parse(bar));

    let existingHistory = [];
    try {
      const hist = localStorage.getItem('forecastHistory');
      if (hist) { existingHistory = JSON.parse(hist); setForecastHistory(existingHistory); }
    } catch {}

    const confirmed = loadConfirmed();
    if (confirmed.size === 0) { setIsInitializing(false); return; }

    const existingBarangays = new Set(existingHistory.map(h => h.barangay).filter(Boolean));
    const needsRestore = [...confirmed].filter(b => !existingBarangays.has(b));
    if (needsRestore.length === 0) { setIsInitializing(false); return; }

    const city = localStorage.getItem('datasetCity') || '';
    Promise.allSettled(
      needsRestore.map(brgy => getSavedForecast(brgy, city).then(result => ({ brgy, result })))
    ).then(results => {
      const newEntries = [];
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value.result)
          newEntries.push(...buildHistoryEntries(r.value.result, r.value.brgy, city));
      });
      if (newEntries.length > 0) {
        setForecastHistory(prev => {
          const fetched  = new Set(needsRestore);
          const filtered = prev.filter(h => !fetched.has(h.barangay));
          const updated  = [...filtered, ...newEntries];
          try { localStorage.setItem('forecastHistory', JSON.stringify(updated)); } catch {}
          return updated;
        });
      }
    }).finally(() => setIsInitializing(false));
  }, []);

  useEffect(() => { saveConfirmed(confirmedBarangays); }, [confirmedBarangays]);

  const generatedBarangays = new Set(forecastHistory.map(h => h.barangay).filter(b => b && b !== ALL_BARANGAYS));
  const hasDbData = availableBarangays.length > 0;
  const effectiveGeneratedBarangays = hasDbData ? new Set(availableBarangays) : generatedBarangays;

  const availableYears = [...new Set(forecastHistory.map(h => getPeriodYear(h.period)).filter(Boolean))].sort();

  const handleFilterDateSelect = useCallback(({ year, month }) => { setSelectedYear(year); setSelectedMonth(month); }, []);

  const handleRowClick = useCallback(async (barangay, period) => {
    setDetailPanel({ barangay, period });
    setDetailForecast(null);
    setDetailLoading(true);
    try {
      const cached         = localStorage.getItem('cachedForecastData');
      const cachedData     = cached ? JSON.parse(cached) : null;
      const cachedBarangay = localStorage.getItem('cachedForecastBarangay');
      if (cachedData && (cachedBarangay === barangay || barangay === ALL_BARANGAYS)) {
        setDetailForecast(cachedData);
      } else {
        const result = await getSavedForecast(barangay, cityLabel);
        if (result) setDetailForecast(result);
      }
    } catch (e) { console.error('Failed to load forecast details:', e); }
    finally     { setDetailLoading(false); }
  }, [cityLabel]);

  const handleConfirmBarangays = useCallback(async (selected) => {
    setConfirmedBarangays(new Set(selected));
    setSelectedYear(getCurrentYear());
    setSelectedMonth(getCurrentMonth());

    const existingBarangays = new Set(forecastHistory.map(h => h.barangay).filter(Boolean));
    const missing = [...selected].filter(b => !existingBarangays.has(b));

    for (const brgy of missing) {
      try {
        setLoadingBarangay(brgy);
        const result = await getSavedForecast(brgy, cityLabel);
        if (!result) continue;
        const newEntries = buildHistoryEntries(result, brgy, cityLabel);
        setForecastHistory(prev => {
          const filtered = prev.filter(h => h.barangay !== brgy);
          const updated  = [...filtered, ...newEntries];
          try { localStorage.setItem('forecastHistory', JSON.stringify(updated)); } catch {}
          return updated;
        });
      } catch (e) { console.error(`Failed to load forecast for ${brgy}:`, e); }
      finally     { setLoadingBarangay(null); }
    }
  }, [forecastHistory, cityLabel]);

  const showSkeleton   = isInitializing && confirmedBarangays.size > 0;
  const showNoForecast = !isInitializing && effectiveGeneratedBarangays.size === 0;
  const showNoPick     = !isInitializing && effectiveGeneratedBarangays.size > 0 && confirmedBarangays.size === 0;
  const showTable      = !isInitializing && confirmedBarangays.size > 0;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: T.pageBg }}>
      <Sidebar currentPage="prediction" onNavigate={onNavigate} onLogout={onLogout} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        <Box sx={{ px: '24px', minHeight: 64, display: 'flex', alignItems: 'center',
          backgroundColor: '#FFFFFF', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: T.textHead, letterSpacing: '-0.2px' }}>
            Prediction
          </Typography>
        </Box>

        <Box sx={{ px: '24px', pt: '20px', pb: '28px', overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>

          <SCard sx={{ mb: '14px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                  <BarangayPicker
                    availableBarangays={availableBarangays}
                    generatedBarangays={effectiveGeneratedBarangays}
                    pending={pendingBarangays}
                    onPendingChange={setPendingBarangays}
                    onConfirm={handleConfirmBarangays}
                    confirmed={confirmedBarangays}
                  />

                  {confirmedBarangays.size > 0 && !isInitializing && (
                    <FilterDatePicker
                      availableYears={availableYears}
                      selectedYear={selectedYear}
                      selectedMonth={selectedMonth}
                      onSelect={handleFilterDateSelect}
                    />
                  )}

                  {(selectedYear || selectedMonth) && confirmedBarangays.size > 0 && !isInitializing && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5,
                      px: 1.25, py: 0.5, borderRadius: '6px',
                      backgroundColor: T.blueDim, border: '1px solid rgba(37,99,235,0.2)' }}>
                      <CalendarMonthIcon sx={{ fontSize: 11, color: T.blue }} />
                      <Typography sx={{ fontSize: 11.5, fontWeight: 500, color: T.blue }}>
                        {selectedMonth && selectedYear
                          ? `${MONTH_NAMES[parseInt(selectedMonth, 10) - 1]} ${selectedYear}`
                          : selectedYear || ''}
                      </Typography>
                      <IconButton size="small" onClick={() => { setSelectedYear(null); setSelectedMonth(null); }}
                        sx={{ p: 0.15, ml: 0.25, color: T.blue, '&:hover': { backgroundColor: 'rgba(37,99,235,0.15)' } }}>
                        <CloseIcon sx={{ fontSize: 11 }} />
                      </IconButton>
                    </Box>
                  )}

                  {(isInitializing || loadingBarangay) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={12} sx={{ color: T.blue }} />
                      <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
                        {loadingBarangay ? `Loading ${loadingBarangay}…` : 'Restoring selection…'}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <ExportMenu
                  forecastHistory={forecastHistory}
                  confirmedBarangays={confirmedBarangays}
                  availableDiseases={availableDiseases}
                  cityLabel={cityLabel}
                />
              </Box>
            </CardContent>
          </SCard>

          <SCard sx={{ flex: showTable ? 'none' : 1, display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
              {showSkeleton   && <TableLoadingSkeleton barangayCount={confirmedBarangays.size} />}
              {showNoForecast && (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', textAlign: 'center', py: 4 }}>
                  <PsychologyIcon sx={{ fontSize: 38, color: T.textFaint, mb: 1.5 }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead, mb: 0.5 }}>No forecast generated yet</Typography>
                  <Typography sx={{ fontSize: 12, color: T.textMuted, mb: 2 }}>
                    Go to the <strong>Dashboard</strong> and generate a forecast first.
                  </Typography>
                  <Button size="small" onClick={() => onNavigate?.('dashboard')}
                    startIcon={<PsychologyIcon sx={{ fontSize: 13 }} />}
                    sx={{ textTransform: 'none', fontSize: 12, fontWeight: 600, color: T.blue,
                      backgroundColor: T.blueDim, border: '1px solid rgba(37,99,235,0.25)',
                      borderRadius: '7px', px: 2, py: 0.75 }}>
                    Go to Dashboard
                  </Button>
                </Box>
              )}
              {showNoPick && (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', textAlign: 'center', py: 4 }}>
                  <LocationOnIcon sx={{ fontSize: 38, color: T.textFaint, mb: 1.5 }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead, mb: 0.5 }}>No barangay selected</Typography>
                  <Typography sx={{ fontSize: 12, color: T.textMuted }}>
                    Click <strong>Select Barangay</strong> above then click <strong>Confirm</strong>.
                  </Typography>
                </Box>
              )}
              {showTable && (
                <ForecastTable
                  forecastHistory={forecastHistory}
                  confirmedBarangays={confirmedBarangays}
                  availableDiseases={availableDiseases}
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  onRowClick={handleRowClick}
                />
              )}
            </CardContent>
          </SCard>
        </Box>
      </Box>

      {/* Detail Panel */}
      {detailPanel && (
        detailLoading ? (
          <Box sx={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex',
            alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
            <Box sx={{ backgroundColor: '#fff', borderRadius: '14px', p: 4,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={32} sx={{ color: T.blue }} />
              <Typography sx={{ fontSize: 13, color: T.textMuted }}>Loading forecast details…</Typography>
            </Box>
          </Box>
        ) : detailForecast ? (
          <DiseaseDetailPanel
            barangay={detailPanel.barangay}
            forecastData={detailForecast}
            city={cityLabel}
            onClose={() => { setDetailPanel(null); setDetailForecast(null); }}
          />
        ) : (
          <Box sx={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex',
            alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}
            onClick={() => setDetailPanel(null)}>
            <Box sx={{ backgroundColor: '#fff', borderRadius: '14px', p: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: T.textMuted }}>No forecast data found.</Typography>
              <Button size="small" onClick={() => setDetailPanel(null)} sx={{ mt: 2 }}>Close</Button>
            </Box>
          </Box>
        )
      )}
    </Box>
  );
};

export default Prediction;