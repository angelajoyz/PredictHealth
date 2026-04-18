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

  const roundedPreds = preds.map(v => Math.round(v ?? 0));

  const currentYM = new Date().toISOString().slice(0, 7);
  const thisMonthIdx = dates.findIndex(d => d.slice(0, 7) === currentYM);
  const resolvedThisIdx       = thisMonthIdx >= 0 ? thisMonthIdx : 0;
  const thisMonthForecastVal  = roundedPreds[resolvedThisIdx] ?? 0;
  const thisMonthForecastDate = dates[resolvedThisIdx]?.slice(0, 7) || '';

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

        <Box sx={{ overflow: 'auto', flex: 1, p: 3 }}>
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

          {!isTotal && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <BarChartIcon sx={{ fontSize: 14, color: T.blue }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.textHead }}>Age & Sex Breakdown</Typography>
              </Box>
              <AgeSexChart barangay={barangay} disease={disease} city={city} />
            </Box>
          )}

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

const exportTableData = async (format, forecastHistory, selectedBarangays, availableDiseases, cityLabel, selectedYear, selectedMonth) => {
  if (!forecastHistory?.length || selectedBarangays.size === 0) return;

  const filteredHistory = forecastHistory.filter(h => {
    if (selectedYear  && getPeriodYear(h.period)  !== selectedYear)  return false;
    if (selectedMonth && getPeriodMonth(h.period) !== selectedMonth) return false;
    return true;
  });

  const diseases = availableDiseases.length > 0
    ? availableDiseases
    : [...new Set(forecastHistory.map(h => h.disease))];

  const lookup = {};
  filteredHistory.forEach(h => {
    if (!selectedBarangays.has(h.barangay)) return;
    if (!lookup[h.barangay]) lookup[h.barangay] = {};
    if (!lookup[h.barangay][h.period]) lookup[h.barangay][h.period] = {};
    lookup[h.barangay][h.period][h.disease] = h;
  });

  const city = localStorage.getItem('datasetCity') || '';
  const timestamp = new Date().toISOString().slice(0, 10);

  // build rows
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
        const dInfo = getDiseaseInfo(d);
        rows.push({ barangay, year: getPeriodYear(period) || '', month: formatMonthLabel(period), period, category: dInfo.label, color: dInfo.color, disease: d, predicted, trend, topDisease: '—' });
      });
    });
  });

  if (rows.length === 0) return;

  // ── CSV ──────────────────────────────────────────────────────────────────────
  if (format === 'csv') {
    const headers = ['Barangay', 'Year', 'Month', 'Disease Category', 'Predicted Cases', 'Trend'];
    const csvRows = [
      headers.join(','),
      ...rows.map(r => [`"${r.barangay}"`, r.year, r.month, `"${r.category}"`, r.predicted, r.trend].join(',')),
    ];
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `forecast_${timestamp}.csv`; a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // ── TXT ──────────────────────────────────────────────────────────────────────
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
        lines.push(`  ${'Disease Category'.padEnd(24)} ${'Predicted'.padStart(9)}   ${'Trend'.padEnd(12)}`);
        lines.push(`  ${'-'.repeat(60)}`);
        diseaseRows.forEach(r => {
          const trendIcon = r.trend === 'Increasing' ? '↑' : r.trend === 'Decreasing' ? '↓' : '—';
          lines.push(`  ${r.category.padEnd(24)} ${String(r.predicted).padStart(9)}   ${`${trendIcon} ${r.trend}`.padEnd(12)}`);
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

  // ── PDF ───────────────────────────────────────────────────────────────────────
// Sa loob ng exportTableData function, bago ang existing if (format === 'csv') block:

if (format === 'pdf_data') {
  // Build city-wide disease summary (same logic as before)
  const cityDiseaseMap = {};
  rows.forEach(r => {
    if (!cityDiseaseMap[r.disease])
      cityDiseaseMap[r.disease] = { label: r.category, color: r.color, total: 0, trend: r.trend, peakMonth: '' };
    cityDiseaseMap[r.disease].total += r.predicted;
  });

  const cityDiseases = Object.entries(cityDiseaseMap)
    .map(([d, v]) => ({ disease: d, ...v }))
    .filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total);

  const cityTotal = cityDiseases.reduce((s, d) => s + d.total, 0);
  cityDiseases.forEach(d => {
    d.share = cityTotal > 0 ? ((d.total / cityTotal) * 100).toFixed(1) : '0.0';
    const dRows = rows.filter(r => r.disease === d.disease);
    const periodTotals = {};
    dRows.forEach(r => { periodTotals[r.period] = (periodTotals[r.period] || 0) + r.predicted; });
    let peakP = Object.keys(periodTotals)[0];
    Object.keys(periodTotals).forEach(p => { if ((periodTotals[p] || 0) > (periodTotals[peakP] || 0)) peakP = p; });
    d.peakMonth = peakP ? `${formatMonthLabel(peakP)} ${getPeriodYear(peakP)}` : '—';
    const trendCounts = { Increasing: 0, Decreasing: 0, Stable: 0 };
    [...selectedBarangays].forEach(brgy => {
      const brgyDRows = rows.filter(r => r.barangay === brgy && r.disease === d.disease);
      if (brgyDRows.length) trendCounts[brgyDRows[0].trend]++;
    });
    d.trend = Object.entries(trendCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Stable';
  });

  const allPeriods = [...new Set(rows.map(r => r.period))].sort();
  const forecastPeriod = allPeriods.length
    ? `${formatMonthLabel(allPeriods[0])} ${getPeriodYear(allPeriods[0])} – ${formatMonthLabel(allPeriods[allPeriods.length - 1])} ${getPeriodYear(allPeriods[allPeriods.length - 1])}`
    : '—';

  return {
    rows,
    cityDiseases,
    cityTotal,
    barangayList: [...selectedBarangays],
    forecastPeriod,
    genDate: new Date().toLocaleDateString('en-PH', { dateStyle: 'long' }),
  };
}
};

const ExportMenu = ({ forecastHistory, confirmedBarangays, availableDiseases, cityLabel, selectedYear, selectedMonth }) => {
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
  setOpen(false);
  setExporting(true);
  try {
// ─────────────────────────────────────────────────────────────────────────────
// REPLACEMENT: paste this entire block in place of the existing
//   if (format === 'pdf') { ... }
// inside the handleExport function in ExportMenu.
// ─────────────────────────────────────────────────────────────────────────────

if (format === 'pdf') {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, WidthType, BorderStyle, ShadingType, LevelFormat, PageBreak,
    ImageRun,
  } = await import('docx');

  const result = await exportTableData(
    'pdf_data', forecastHistory, confirmedBarangays, availableDiseases,
    cityLabel, selectedYear, selectedMonth
  );
  if (!result) return;

  const { rows, cityDiseases, cityTotal, barangayList, forecastPeriod, genDate } = result;

  // ── Shared style helpers ──────────────────────────────────────────────────
  const border  = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

  const trendArrow = (t) =>
    t === 'Increasing' ? '↑ Increasing' : t === 'Decreasing' ? '↓ Decreasing' : '— Stable';
  const trendHex   = (t) =>
    t === 'Increasing' ? 'DC2626' : t === 'Decreasing' ? '16A34A' : '6B7280';
  const trendFill  = (t) =>
    t === 'Increasing' ? 'FEF2F2' : t === 'Decreasing' ? 'F0FDF4' : 'F9FAFB';

  // ── SVG → PNG helper (runs in browser) ───────────────────────────────────
  const renderLineChart = async (chartData, color) => {
    if (!chartData || chartData.length === 0) return null;
    const W = 560, H = 160;
    const pL = 46, pR = 14, pT = 12, pB = 32;
    const cW = W - pL - pR, cH = H - pT - pB;

    const vals   = chartData.map(d => d.value ?? 0);
    const maxVal = Math.max(...vals, 1);
    const minVal = 0;
    const range  = maxVal || 1;

    const toX = (i) => pL + (i / Math.max(chartData.length - 1, 1)) * cW;
    const toY = (v) => pT + cH - (v / range) * cH;

    const gridLines = [0, 0.5, 1].map(t => {
      const y   = pT + cH * (1 - t);
      const val = Math.round(t * maxVal);
      return `<line x1="${pL}" y1="${y}" x2="${pL + cW}" y2="${y}"
                stroke="#E5E7EB" stroke-width="1" stroke-dasharray="4,3"/>
              <text x="${pL - 5}" y="${y + 4}" font-size="9" fill="#9CA3AF" text-anchor="end">${val}</text>`;
    }).join('');

    const step    = Math.max(1, Math.ceil(chartData.length / 7));
    const xLabels = chartData.map((d, i) => {
      if (i % step !== 0 && i !== chartData.length - 1) return '';
      return `<text x="${toX(i)}" y="${pT + cH + 20}" font-size="8" fill="#9CA3AF" text-anchor="middle">${d.label}</text>`;
    }).join('');

    const pathD = chartData.map((d, i) =>
      `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.value ?? 0).toFixed(1)}`
    ).join(' ');
    const areaD = `${pathD} L${toX(chartData.length - 1).toFixed(1)},${(pT + cH).toFixed(1)} L${pL},${(pT + cH).toFixed(1)} Z`;
    const dots  = chartData.map((d, i) =>
      `<circle cx="${toX(i).toFixed(1)}" cy="${toY(d.value ?? 0).toFixed(1)}" r="3.5" fill="${color}" stroke="white" stroke-width="1.5"/>`
    ).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="white"/>
      ${gridLines}
      <line x1="${pL}" y1="${pT}" x2="${pL}" y2="${pT + cH}" stroke="#D1D5DB" stroke-width="1"/>
      <line x1="${pL}" y1="${pT + cH}" x2="${pL + cW}" y2="${pT + cH}" stroke="#D1D5DB" stroke-width="1"/>
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.01"/>
        </linearGradient>
      </defs>
      <path d="${areaD}" fill="url(#g)"/>
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.2" stroke-dasharray="6,3" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${xLabels}
    </svg>`;

    return new Promise((resolve) => {
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const img  = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = W * 2; canvas.height = H * 2;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);
        ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0, W, H);
        URL.revokeObjectURL(url);
        canvas.toBlob(b2 => b2.arrayBuffer().then(buf => resolve(new Uint8Array(buf))), 'image/png');
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const renderBarChart = async (breakdown, color) => {
    if (!breakdown || breakdown.length === 0) return null;
    const W = 560, H = 160;
    const pL = 44, pR = 14, pT = 12, pB = 44;
    const cW = W - pL - pR, cH = H - pT - pB;
    const maxVal = Math.max(...breakdown.map(d => d.total), 1);
    const bGW  = cW / breakdown.length;
    const barW = Math.min(bGW * 0.32, 18);

    const bars = breakdown.map((d, i) => {
      const cx = pL + (i + 0.5) * bGW;
      const mH = (d.male   / maxVal) * cH;
      const fH = (d.female / maxVal) * cH;
      return `
        <rect x="${(cx - barW - 1.5).toFixed(1)}" y="${(pT + cH - mH).toFixed(1)}" width="${barW}" height="${mH.toFixed(1)}" fill="#3B82F6" rx="2"/>
        <rect x="${(cx + 1.5).toFixed(1)}"         y="${(pT + cH - fH).toFixed(1)}" width="${barW}" height="${fH.toFixed(1)}" fill="#EC4899" rx="2"/>
        <text x="${cx.toFixed(1)}" y="${pT + cH + 14}" font-size="8" fill="#9CA3AF" text-anchor="middle">${d.age_group}</text>`;
    }).join('');

    const yLines = [0, 0.5, 1].map(t => {
      const y = pT + cH * (1 - t);
      return `<line x1="${pL}" y1="${y.toFixed(1)}" x2="${pL + cW}" y2="${y.toFixed(1)}"
                stroke="#E5E7EB" stroke-width="1" stroke-dasharray="4,3"/>
              <text x="${pL - 5}" y="${(y + 4).toFixed(1)}" font-size="9" fill="#9CA3AF" text-anchor="end">${Math.round(t * maxVal)}</text>`;
    }).join('');

    const legendY = pT + cH + 30;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="white"/>
      ${yLines}
      <line x1="${pL}" y1="${pT}" x2="${pL}" y2="${pT + cH}" stroke="#D1D5DB" stroke-width="1"/>
      <line x1="${pL}" y1="${pT + cH}" x2="${pL + cW}" y2="${pT + cH}" stroke="#D1D5DB" stroke-width="1"/>
      ${bars}
      <rect x="${pL}" y="${legendY}" width="10" height="10" fill="#3B82F6" rx="2"/>
      <text x="${pL + 14}" y="${legendY + 9}" font-size="10" fill="#374151">Male</text>
      <rect x="${pL + 60}" y="${legendY}" width="10" height="10" fill="#EC4899" rx="2"/>
      <text x="${pL + 74}" y="${legendY + 9}" font-size="10" fill="#374151">Female</text>
    </svg>`;

    return new Promise((resolve) => {
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const img  = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = W * 2; canvas.height = H * 2;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);
        ctx.fillStyle = 'white'; ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0, W, H);
        URL.revokeObjectURL(url);
        canvas.toBlob(b2 => b2.arrayBuffer().then(buf => resolve(new Uint8Array(buf))), 'image/png');
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  // ── Cell helpers ──────────────────────────────────────────────────────────
  const hCell = (text, width) => new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, font: 'Arial', size: 18, color: '6B7280' })] })],
  });

  const dCell = (text, width, opts = {}) => new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), font: 'Arial', size: 18, bold: opts.bold || false, color: opts.color || '374151' })],
    })],
  });

  const trendCell = (trend, width) => new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: { fill: trendFill(trend), type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: trendArrow(trend), font: 'Arial', size: 18, bold: true, color: trendHex(trend) })],
    })],
  });

  const statCell = (value, label, valueFill, valueColor, cellWidth) => new TableCell({
    borders, width: { size: cellWidth, type: WidthType.DXA },
    shading: { fill: valueFill, type: ShadingType.CLEAR },
    margins: { top: 160, bottom: 160, left: 200, right: 200 },
    children: [
      new Paragraph({ children: [new TextRun({ text: String(value), bold: true, font: 'Arial', size: 52, color: valueColor })] }),
      new Paragraph({ children: [new TextRun({ text: label, font: 'Arial', size: 16, color: '6B7280' })] }),
    ],
  });

  const sectionHeading = (text) => new Paragraph({
    children: [new TextRun({ text, bold: true, font: 'Arial', size: 26, color: '111827' })],
    spacing: { before: 320, after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '2563EB', space: 2 } },
  });

  const diseaseHeading = (label, icon, color) => new Paragraph({
    children: [new TextRun({ text: `${icon}  ${label}`, bold: true, font: 'Arial', size: 28, color: color?.replace('#', '') || '1D4ED8' })],
    spacing: { before: 280, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '93C5FD', space: 2 } },
  });

  const analysisBox = (title, items) => new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({ children: [new TableCell({
      borders: {
        top:    { style: BorderStyle.SINGLE, size: 2, color: '93C5FD' },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: '93C5FD' },
        left:   { style: BorderStyle.SINGLE, size: 8, color: '3B82F6' },
        right:  { style: BorderStyle.SINGLE, size: 2, color: '93C5FD' },
      },
      width: { size: 9360, type: WidthType.DXA },
      shading: { fill: 'EFF6FF', type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: `📋  ${title}`, bold: true, font: 'Arial', size: 20, color: '1D4ED8' })],
          spacing: { after: 100 },
        }),
        ...items.map(item => new Paragraph({
          children: [new TextRun({ text: `*  ${item}`, font: 'Arial', size: 19, color: '374151' })],
          spacing: { after: 60 },
          indent: { left: 200 },
        })),
      ],
    })]})],
  });

  // ── Chart label helper ────────────────────────────────────────────────────
  const chartLabelBox = (label, color) => new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({ children: [new TableCell({
      borders: noBorders,
      width: { size: 9360, type: WidthType.DXA },
      shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 160, right: 160 },
      children: [new Paragraph({
        children: [
          new TextRun({ text: '— — ', font: 'Arial', size: 18, color: color?.replace('#', '') || '2563EB' }),
          new TextRun({ text: ' Predicted (dashed line)', font: 'Arial', size: 18, color: '6B7280' }),
        ],
      })],
    })]})],
  });

  // Helper: image paragraph
  const imageParagraph = (bytes, widthEmu, heightEmu, label) => {
    if (!bytes) return new Paragraph({
      children: [new TextRun({ text: `[${label} chart unavailable]`, font: 'Arial', size: 18, color: '9CA3AF', italics: true })],
      spacing: { after: 80 },
    });
    return new Paragraph({
      children: [new ImageRun({ data: bytes, transformation: { width: Math.round(widthEmu / 9144), height: Math.round(heightEmu / 9144) }, type: 'png' })],
      spacing: { after: 80 },
    });
  };

  // ── Build document ────────────────────────────────────────────────────────
  const children = [];
  const increasingCount = cityDiseases.filter(d => d.trend === 'Increasing').length;

  // Cover page
  children.push(
    new Paragraph({ children: [new TextRun({ text: 'PREDICTHEALTH — BARANGAY FORECAST REPORT', bold: true, font: 'Arial', size: 18, color: '6B7280', allCaps: true })], spacing: { after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: 'Disease Forecast & Analysis', bold: true, font: 'Arial', size: 52, color: '0F172A' })], spacing: { after: 140 } }),
    new Paragraph({ children: [new TextRun({ text: `City: ${cityLabel || 'N/A'}`, font: 'Arial', size: 22, color: '374151' })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: `Generated: ${genDate}`, font: 'Arial', size: 20, color: '6B7280' })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: `Barangays: ${barangayList.join(', ')}`, font: 'Arial', size: 20, color: '6B7280' })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: `Forecast Period: ${forecastPeriod}`, font: 'Arial', size: 20, color: '2563EB', bold: true })], spacing: { after: 360 } }),
  );

  // Summary stat grid
  const W4 = Math.floor(9360 / 4);
  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [W4, W4, W4, 9360 - W4 * 3],
    rows: [new TableRow({ children: [
      statCell(cityTotal.toLocaleString(), 'Total Predicted Cases', 'FEF2F2', 'DC2626', W4),
      statCell(String(cityDiseases.length), 'Disease Categories',   'F5F3FF', '7C3AED', W4),
      statCell(String(barangayList.length), 'Barangays',            'EFF6FF', '1D4ED8', W4),
      statCell(String(increasingCount),     'Increasing Trends',    'FEF2F2', 'EF4444', 9360 - W4 * 3),
    ]})],
  }));
  children.push(new Paragraph({ spacing: { after: 320 }, children: [] }));

  // City-wide burden table
  children.push(sectionHeading('Disease Burden Summary — All Barangays Combined'));
  const sCols = [2800, 1400, 900, 1660, 1600];
  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: sCols,
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('Disease Category', sCols[0]), hCell('Total Forecast', sCols[1]), hCell('Share %', sCols[2]), hCell('Trend', sCols[3]), hCell('Peak Month', sCols[4])] }),
      ...cityDiseases.map((d, i) => new TableRow({ children: [
        dCell((i === 0 ? '★ ' : '') + d.label, sCols[0], { bold: i === 0 }),
        dCell(d.total.toLocaleString(), sCols[1], { align: AlignmentType.RIGHT, bold: true }),
        dCell(d.share + '%', sCols[2], { align: AlignmentType.RIGHT }),
        trendCell(d.trend, sCols[3]),
        dCell(d.peakMonth, sCols[4], { align: AlignmentType.CENTER }),
      ]})),
    ],
  }));

  // ── Per-barangay sections ─────────────────────────────────────────────────
  for (const brgy of barangayList) {
    const brgyRows = rows.filter(r => r.barangay === brgy);
    const diseases = availableDiseases.length > 0
      ? availableDiseases
      : [...new Set(brgyRows.map(r => r.disease))];
    const allPeriods = [...new Set(brgyRows.map(r => r.period))].sort();

    // Build per-barangay disease summary
    const diseaseSummary = diseases.map(d => {
      const dRows = brgyRows.filter(r => r.disease === d);
      const total = dRows.reduce((s, r) => s + r.predicted, 0);
      if (total === 0) return null;
      const info = getDiseaseInfo(d);
      return { disease: d, label: dRows[0]?.category || d, icon: info.icon || '🏥', color: info.color || '#2563EB', total, trend: dRows[0]?.trend || 'Stable' };
    }).filter(Boolean);

    const grandTotal = diseaseSummary.reduce((s, d) => s + d.total, 0);
    diseaseSummary.forEach(d => {
      d.share = grandTotal > 0 ? ((d.total / grandTotal) * 100).toFixed(1) : '0.0';
    });
    diseaseSummary.sort((a, b) => b.total - a.total);

    // Page break + barangay header
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: brgy, bold: true, font: 'Arial', size: 48, color: '1D4ED8' })],
        spacing: { after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '1D4ED8', space: 2 } },
      }),
      new Paragraph({
        children: [new TextRun({
          text: `${cityLabel || 'City'} · ${diseaseSummary.length} active diseases · ${allPeriods.length} months · Total: ${grandTotal.toLocaleString()} cases`,
          font: 'Arial', size: 20, color: '6B7280',
        })],
        spacing: { after: 300 },
      }),
    );

    children.push(sectionHeading('Disease Summary'));

    // ── Per-disease detail blocks ─────────────────────────────────────────
    for (const d of diseaseSummary) {
      const dRows    = brgyRows.filter(r => r.disease === d.disease);
      const dPeriods = allPeriods.map(p => ({
        period: p,
        label:  (() => {
          const m = p.match(/^\d{4}-(\d{2})/);
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          return m ? months[parseInt(m[1], 10) - 1] : p;
        })(),
        value: dRows.find(r => r.period === p)?.predicted ?? 0,
      }));

      const peakEntry = [...dPeriods].sort((a, b) => b.value - a.value)[0];
      const peakLabel = peakEntry
        ? `${peakEntry.label} ${peakEntry.period?.slice(0, 4)} (${peakEntry.value} cases)`
        : '—';
      const firstVal  = dPeriods[0]?.value ?? 0;
      const lastVal   = dPeriods[dPeriods.length - 1]?.value ?? 0;
      const pctChange = firstVal > 0
        ? (((lastVal - firstVal) / firstVal) * 100).toFixed(1)
        : lastVal > 0 ? '+∞' : '0';
      const maxVal = Math.max(...dPeriods.map(x => x.value));
      const hexColor = d.color?.replace('#', '') || '2563EB';

      // Disease heading
      children.push(diseaseHeading(d.label, d.icon, d.color));

      // ── FORECAST LINE CHART ──────────────────────────────────────────────
      const forecastChartBytes = await renderLineChart(dPeriods, d.color || '#2563EB');
      // Chart image — 560px wide → in EMU: 560 * 9144 = 5,120,640; height 160*9144=1,463,040
      const chartImgW = 5120640, chartImgH = 1463040;

      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Forecast (Monthly Predicted Cases)', bold: true, font: 'Arial', size: 20, color: '374151' })],
          spacing: { before: 120, after: 80 },
        }),
      );

      if (forecastChartBytes) {
        children.push(new Paragraph({
          children: [new ImageRun({ data: forecastChartBytes, transformation: { width: 560, height: 160 }, type: 'png' })],
          spacing: { after: 60 },
        }));
      } else {
        children.push(new Paragraph({
          children: [new TextRun({ text: '[Forecast chart unavailable]', font: 'Arial', size: 18, color: '9CA3AF', italics: true })],
          spacing: { after: 60 },
        }));
      }

      // Chart legend
      children.push(new Paragraph({
        children: [
          new TextRun({ text: '--- ', font: 'Arial', size: 18, color: hexColor }),
          new TextRun({ text: 'Predicted Cases (dashed)', font: 'Arial', size: 18, color: '6B7280' }),
          new TextRun({ text: '     ', font: 'Arial', size: 18 }),
          new TextRun({ text: `Trend: ${trendArrow(d.trend)}`, bold: true, font: 'Arial', size: 18, color: trendHex(d.trend) }),
        ],
        spacing: { after: 200 },
      }));

      // ── AGE/SEX BREAKDOWN CHART ──────────────────────────────────────────
      // Fetch real age/sex breakdown from the API
      let ageSexBytes = null;
      let ageSexSummary = null;
      try {
        const catKey  = d.disease.replace('_cases', '');
        const city    = localStorage.getItem('datasetCity') || '';
        const asData  = await getAgeSexBreakdown(catKey, brgy, city);
        if (asData && asData.total_cases > 0) {
          const filtered = (asData.breakdown || []).filter(x => x.total > 0);
          ageSexBytes = await renderBarChart(filtered, d.color || '#2563EB');
          const peak  = filtered.reduce((a, b) => b.total > a.total ? b : a, filtered[0] || {});
          ageSexSummary = {
            totalMale:   asData.total_male,
            totalFemale: asData.total_female,
            total:       asData.total_cases,
            peak,
          };
        }
      } catch (e) {
        console.warn('Age/sex breakdown failed for', d.disease, e);
      }

      children.push(new Paragraph({
        children: [new TextRun({ text: 'Age & Sex Breakdown', bold: true, font: 'Arial', size: 20, color: '374151' })],
        spacing: { before: 80, after: 80 },
      }));

      if (ageSexBytes) {
        // Male/Female summary chips
        const malePct   = ageSexSummary.total > 0 ? Math.round((ageSexSummary.totalMale   / ageSexSummary.total) * 100) : 0;
        const femalePct = ageSexSummary.total > 0 ? Math.round((ageSexSummary.totalFemale / ageSexSummary.total) * 100) : 0;

        // Small summary row
        const chipCW = 3120;
        children.push(new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [chipCW, chipCW, 9360 - chipCW * 2],
          rows: [new TableRow({ children: [
            new TableCell({
              borders: noBorders, width: { size: chipCW, type: WidthType.DXA },
              shading: { fill: 'EFF6FF', type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 140, right: 140 },
              children: [new Paragraph({ children: [new TextRun({ text: `♂ Male: ${ageSexSummary.totalMale.toLocaleString()} (${malePct}%)`, font: 'Arial', size: 19, bold: true, color: '1D4ED8' })] })],
            }),
            new TableCell({
              borders: noBorders, width: { size: chipCW, type: WidthType.DXA },
              shading: { fill: 'FDF2F8', type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 140, right: 140 },
              children: [new Paragraph({ children: [new TextRun({ text: `♀ Female: ${ageSexSummary.totalFemale.toLocaleString()} (${femalePct}%)`, font: 'Arial', size: 19, bold: true, color: 'BE185D' })] })],
            }),
            new TableCell({
              borders: noBorders, width: { size: 9360 - chipCW * 2, type: WidthType.DXA },
              shading: { fill: hexColor, type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 140, right: 140 },
              children: [new Paragraph({ children: [new TextRun({ text: ageSexSummary.peak ? `Peak: Age ${ageSexSummary.peak.age_group} (${ageSexSummary.peak.total.toLocaleString()} cases)` : '', font: 'Arial', size: 19, bold: true, color: hexColor })] })],
            }),
          ]})],
        }));
        children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));

        // Chart image
        children.push(new Paragraph({
          children: [new ImageRun({ data: ageSexBytes, transformation: { width: 560, height: 160 }, type: 'png' })],
          spacing: { after: 80 },
        }));

        if (ageSexSummary.peak) {
          children.push(new Paragraph({
            children: [new TextRun({
              text: `Age group ${ageSexSummary.peak.age_group} has the highest ${d.label} cases with ${ageSexSummary.peak.total.toLocaleString()} cases (${ageSexSummary.peak.male.toLocaleString()} male, ${ageSexSummary.peak.female.toLocaleString()} female).`,
              font: 'Arial', size: 18, color: '374151',
            })],
            spacing: { after: 100 },
          }));
        }
      } else {
        children.push(new Paragraph({
          children: [new TextRun({ text: 'No age/sex breakdown data available for this disease.', font: 'Arial', size: 18, color: '9CA3AF', italics: true })],
          spacing: { after: 80 },
        }));
      }

      // ── Monthly forecast table ─────────────────────────────────────────
      const fCols = [1440, ...Array(6).fill(Math.floor((9360 - 1440) / 6))];
      const halves = [dPeriods.slice(0, 6), dPeriods.slice(6)];
      halves.forEach((half, hi) => {
        if (half.length === 0) return;
        const pad = Array(6 - half.length).fill({ period: '', label: '', value: null });
        children.push(new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: fCols,
          rows: [
            new TableRow({ children: [
              hCell(hi === 0 ? 'Forecast' : '', fCols[0]),
              ...[...half, ...pad].map((p, i) => hCell(p.label || '', fCols[i + 1])),
            ]}),
            new TableRow({ children: [
              dCell('Predicted', fCols[0], { bold: true, color: '1D4ED8' }),
              ...[...half, ...pad].map((p, i) => {
                if (p.value === null) return dCell('', fCols[i + 1]);
                const isMax = p.value === maxVal && maxVal > 0;
                return dCell(p.value.toLocaleString(), fCols[i + 1], {
                  align: AlignmentType.CENTER,
                  bold: isMax,
                  fill: isMax ? 'DBEAFE' : undefined,
                  color: isMax ? '1D4ED8' : '374151',
                });
              }),
            ]}),
          ],
        }));
        children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
      });

      // Trend + peak summary
      children.push(new Paragraph({
        children: [
          new TextRun({ text: 'Trend: ', bold: true, font: 'Arial', size: 20, color: '374151' }),
          new TextRun({ text: trendArrow(d.trend), bold: true, font: 'Arial', size: 20, color: trendHex(d.trend) }),
          new TextRun({ text: `   |   Peak: ${peakLabel}`, font: 'Arial', size: 20, color: '6B7280' }),
        ],
        spacing: { after: 120 },
      }));

      // Analysis callout
      children.push(analysisBox(`Analysis — ${d.label}`, [
        `${d.label} accounts for ${d.share}% of total forecasted cases (${d.total.toLocaleString()} cases).`,
        `Forecast trend is ${d.trend} — peak cases projected in ${peakLabel}.`,
        `Overall change from first to last forecast month: ${pctChange}%.`,
      ]));
      children.push(new Paragraph({ spacing: { after: 280 }, children: [] }));
    } // end per-disease loop

    // ── Monthly Forecast Data Sheet ──────────────────────────────────────
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(sectionHeading('Monthly Forecast Data Sheet'));

    const topD = diseaseSummary.slice(0, 5);
    const mW = 900, yW = 700, tW = 1000;
    const dCW = topD.length > 0 ? Math.floor((9360 - mW - yW - tW) / topD.length) : 1400;
    const mCols = [mW, yW, ...Array(topD.length).fill(dCW), tW];

    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: mCols,
      rows: [
        new TableRow({ tableHeader: true, children: [
          hCell('Month', mW), hCell('Year', yW),
          ...topD.map(d => hCell(d.label.length > 12 ? d.label.slice(0, 12) + '…' : d.label, dCW)),
          hCell('TOTAL', tW),
        ]}),
        ...allPeriods.map(period => {
          const pRows = brgyRows.filter(r => r.period === period);
          const total = pRows.reduce((s, r) => s + r.predicted, 0);
          const [yr, mo] = period.split('-');
          const MONTH_NAMES_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          const mName = MONTH_NAMES_FULL[parseInt(mo, 10) - 1] || mo;
          return new TableRow({ children: [
            dCell(mName, mW),
            dCell(yr, yW, { align: AlignmentType.CENTER }),
            ...topD.map(d => {
              const found = pRows.find(r => r.category === d.label);
              return dCell((found?.predicted || 0).toLocaleString(), dCW, { align: AlignmentType.RIGHT });
            }),
            dCell(total.toLocaleString(), tW, { align: AlignmentType.RIGHT, bold: true }),
          ]});
        }),
        // Totals row
        new TableRow({ children: [
          new TableCell({ borders, width: { size: mW, type: WidthType.DXA }, shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL', bold: true, font: 'Arial', size: 18, color: '111827' })] })] }),
          new TableCell({ borders, width: { size: yW, type: WidthType.DXA }, shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [] })] }),
          ...topD.map(d => {
            const dTot = brgyRows.filter(r => r.category === d.label).reduce((s, r) => s + r.predicted, 0);
            return new TableCell({ borders, width: { size: dCW, type: WidthType.DXA }, shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: dTot.toLocaleString(), bold: true, font: 'Arial', size: 18, color: '111827' })] })] });
          }),
          new TableCell({ borders, width: { size: tW, type: WidthType.DXA }, shading: { fill: 'F1F5F9', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: grandTotal.toLocaleString(), bold: true, font: 'Arial', size: 18, color: '1D4ED8' })] })] }),
        ]}),
      ],
    }));

    // Overall analysis box
    children.push(new Paragraph({ spacing: { after: 240 }, children: [] }));
    const peakPeriodEntry = allPeriods.map(p => ({
      p,
      total: diseases.reduce((s, d) => s + (brgyRows.find(r => r.period === p && r.disease === d)?.predicted ?? 0), 0),
    })).sort((a, b) => b.total - a.total)[0];
    const MONTH_NAMES_FULL2 = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const fmtPeriod = (p) => { const [yr, mo] = (p || '').split('-'); return `${MONTH_NAMES_FULL2[parseInt(mo, 10) - 1] || mo} ${yr}`; };
    const peakPeriodLabel = peakPeriodEntry ? `${fmtPeriod(peakPeriodEntry.p)} with ${peakPeriodEntry.total} total cases` : '—';
    const firstTotal = diseases.reduce((s, d) => s + (brgyRows.find(r => r.period === allPeriods[0] && r.disease === d)?.predicted ?? 0), 0);
    const lastTotal  = diseases.reduce((s, d) => s + (brgyRows.find(r => r.period === allPeriods[allPeriods.length - 1] && r.disease === d)?.predicted ?? 0), 0);
    const overallPct = firstTotal > 0 ? (((lastTotal - firstTotal) / firstTotal) * 100).toFixed(1) : '—';
    const increasingDiseases = diseaseSummary.filter(d => d.trend === 'Increasing').map(d => d.label);

    children.push(analysisBox(`Overall Analysis — ${brgy}`, [
      `${diseaseSummary[0]?.label || 'N/A'} is the leading disease category with ${diseaseSummary[0]?.total.toLocaleString() || 0} cases (${diseaseSummary[0]?.share || 0}% of total).`,
      increasingDiseases.length > 0
        ? `${increasingDiseases.join(', ')} show an increasing trend — requiring priority intervention.`
        : 'No disease categories show an increasing trend.',
      `Peak disease burden projected for ${peakPeriodLabel}.`,
      `Overall forecast will ${parseFloat(overallPct) > 0 ? 'increase' : parseFloat(overallPct) < 0 ? 'decrease' : 'remain stable'} by ${Math.abs(parseFloat(overallPct)) || 0}% from ${fmtPeriod(allPeriods[0])} to ${fmtPeriod(allPeriods[allPeriods.length - 1])}.`,
    ]));
  } // end per-barangay loop

  // Footer
  children.push(
    new Paragraph({ spacing: { before: 480 }, children: [] }),
    new Paragraph({
      children: [new TextRun({ text: `PredictHealth — Barangay Forecast Report · Generated ${genDate}`, font: 'Arial', size: 16, color: '9CA3AF', italics: true })],
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB', space: 2 } },
    }),
  );

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `forecast_report_${new Date().toISOString().slice(0, 10)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
 
    else {
      await exportTableData(format, forecastHistory, confirmedBarangays, availableDiseases, cityLabel, selectedYear, selectedMonth);
    }
  } finally {
    setExporting(false);
  }
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
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 200, overflow: 'hidden' }}
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
            { format: 'pdf', label: 'Export as Word Report (.docx)', sub: 'Full report, properly paginated', icon: '📝' },
            { format: 'csv', label: 'Export as CSV',         sub: 'Spreadsheet format',                 icon: '📊' },
            { format: 'txt', label: 'Export as TXT',         sub: 'Plain text report',                  icon: '📝' },
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
const Prediction = ({ onNavigate, onLogout, isPublic = false }) => {
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
    setSelectedYear(null);
    setSelectedMonth(null);

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
    <>
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: T.pageBg }}>
<Sidebar currentPage="prediction" onNavigate={onNavigate} onLogout={onLogout} isPublic={isPublic} />
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
                
                {!isPublic && (
                  <ExportMenu
                    forecastHistory={forecastHistory}
                    confirmedBarangays={confirmedBarangays}
                    availableDiseases={availableDiseases}
                    cityLabel={cityLabel}
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                  />
                )}
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

    {/* ── PDF Preview Modal — renders as centered popup, not a page takeover ── */}
    </>
  );
};

export default Prediction;