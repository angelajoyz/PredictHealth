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
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  LineChart, Line, ReferenceLine,
} from 'recharts';
import Sidebar, { T } from './Sidebar';

const ALL_BARANGAYS = '__ALL__';

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
  if (m) {
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    return months[parseInt(m[2], 10) - 1] ?? period;
  }
  return period;
};

const getPeriodYear = (period) => {
  const m = period?.match(/^(\d{4})/);
  return m ? m[1] : null;
};

const tooltipStyle = {
  borderRadius: '8px', border: `1px solid ${T.border}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: 12, color: T.textBody, background: '#FFFFFF',
};

// ── Trend Legend (for Detail Panel) ──────────────────────────────────────────
const TrendLegend = ({ showThresholds = false }) => (
  <Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      <Typography sx={{ fontSize: 11, color: T.textFaint, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trend:</Typography>
      {[
        { trend: 'increasing', icon: <TrendingUpIcon sx={{ fontSize: 12 }} />, label: 'Increasing' },
        { trend: 'stable',     icon: <RemoveIcon     sx={{ fontSize: 12 }} />, label: 'Stable'     },
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
      <Box sx={{ mt: 1.25, p: '8px 12px', borderRadius: '6px',
        backgroundColor: '#F8FAFC', border: `1px solid ${T.borderSoft}` }}>
        <Typography sx={{ fontSize: 11, color: T.textMuted, fontWeight: 600, mb: 0.5 }}>
          How trend is determined (last vs first forecast month):
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <TrendingUpIcon sx={{ fontSize: 11, color: T.danger }} />
            <Typography sx={{ fontSize: 11, color: T.textBody }}>
              <strong style={{ color: T.danger }}>Increasing</strong> — difference &gt; +0.5 cases
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <RemoveIcon sx={{ fontSize: 11, color: T.textMuted }} />
            <Typography sx={{ fontSize: 11, color: T.textBody }}>
              <strong style={{ color: T.textMuted }}>Stable</strong> — difference between −0.5 and +0.5 cases
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <TrendingDownIcon sx={{ fontSize: 11, color: T.ok }} />
            <Typography sx={{ fontSize: 11, color: T.textBody }}>
              <strong style={{ color: T.ok }}>Decreasing</strong> — difference &lt; −0.5 cases
            </Typography>
          </Box>
        </Box>
      </Box>
    )}
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
    <Box sx={{ p: 2 }}>
      <Skeleton variant="rectangular" height={180} sx={{ borderRadius: '8px' }} />
    </Box>
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
  const malePct     = total > 0 ? Math.round((totalMale / total) * 100) : 0;
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
            borderRadius: '8px', backgroundColor: `${info.color}12`,
            border: `1px solid ${info.color}30` }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: info.color }}>
              Peak: Age {peak.age_group} ({peak.total.toLocaleString()} cases)
            </Typography>
          </Box>
        )}
      </Box>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
          <XAxis dataKey="age_group" axisLine={false} tickLine={false}
            tick={{ fontSize: 10, fill: T.textFaint }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: T.textFaint }} />
          <RechartsTooltip contentStyle={tooltipStyle}
            formatter={(value, name) => [value.toLocaleString(), name === 'male' ? 'Male' : 'Female']} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }}
            formatter={v => v === 'male' ? 'Male' : 'Female'} />
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

  const getTopDisease = () => {
    if (!allDiseases.length) return null;
    return allDiseases.reduce((best, d) => {
      const val  = (forecastData.predictions[d] || [])[0] ?? 0;
      const bval = (forecastData.predictions[best] || [])[0] ?? 0;
      return val > bval ? d : best;
    }, allDiseases[0]);
  };

  const [selectedDisease, setSelectedDisease] = useState(() => getTopDisease());

  const disease = selectedDisease || allDiseases[0];
  const info    = getDiseaseInfo(disease);
  const preds   = forecastData?.predictions?.[disease] || [];
  const dates   = forecastData?.forecast_dates || [];
  const histDates = forecastData?.historical_data?.dates || [];
  const histVals  = forecastData?.historical_data?.[disease] || [];

  // Year selection for actual data
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
    const catKey = disease.replace('_cases', '');
    getDiseaseBreakdown(catKey, barangay, city || '', 6)
      .then(setBreakdown)
      .catch(() => setBreakdown(null))
      .finally(() => setBLoading(false));
  }, [disease, barangay, city]);

  // Filter actual data by selected year
  const filteredHistIndices = histDates.reduce((acc, d, i) => {
    if (!selectedHistYear || d.slice(0,4) === selectedHistYear) acc.push(i);
    return acc;
  }, []);
  const filteredHistDates = filteredHistIndices.map(i => histDates[i]);
  const filteredHistVals  = filteredHistIndices.map(i => histVals[i]);

  // Actual data chart
  const actualChartData = filteredHistDates.map((d, i) => ({
    month: d.slice(0,7),
    label: formatMonthLabel(d.slice(0,7)),
    actual: Math.round(filteredHistVals[i] ?? 0),
  }));

  // Forecast-only chart
  const forecastChartData = dates.map((d, i) => ({
    month: d.slice(0,7),
    label: formatMonthLabel(d.slice(0,7)),
    predicted: Math.round(preds[i] ?? 0),
  }));

  const trend = preds.length < 2 ? 'stable'
    : preds[preds.length-1] - preds[0] > 0.5 ? 'increasing'
    : preds[preds.length-1] - preds[0] < -0.5 ? 'decreasing'
    : 'stable';

  const nextMonthVal = Math.round(preds[0] ?? 0);
  const peakForecast = Math.round(Math.max(...preds, 0));

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

          {/* Title row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '8px',
                backgroundColor: `${info.color}18`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 16 }}>
                {info.icon || '🏥'}
              </Box>
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textHead }}>
                  {info.label}
                </Typography>
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

          {/* ── Disease dropdown + 2 stat boxes in one aligned row ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.25, alignItems: 'stretch' }}>

            {/* Disease selector */}
            <Box sx={{ p: '10px 12px', borderRadius: '10px',
              backgroundColor: '#FFFFFF', border: `1px solid ${T.border}`,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 0.75 }}>
              <Typography sx={{ fontSize: 10.5, color: T.textMuted, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.5px' }}>Disease</Typography>
              <FormControl size="small" fullWidth>
                <Select
                  value={selectedDisease || ''}
                  onChange={e => setSelectedDisease(e.target.value)}
                  displayEmpty
                  sx={{
                    fontSize: 12, fontWeight: 600, color: T.textHead,
                    backgroundColor: 'transparent',
                    borderRadius: '7px',
                    '.MuiOutlinedInput-notchedOutline': { borderColor: T.borderSoft },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.blue },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: T.blue },
                    '.MuiSelect-select': { py: '5px', px: '8px', display: 'flex', alignItems: 'center', gap: 0.5 },
                  }}
                  renderValue={(val) => {
                    const dInfo = getDiseaseInfo(val);
                    return (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                        <span style={{ fontSize: 13 }}>{dInfo.icon || '🏥'}</span>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.textHead }}>{dInfo.label}</Typography>
                      </Box>
                    );
                  }}
                >
                  {allDiseases.map(d => {
                    const dInfo   = getDiseaseInfo(d);
                    const nextVal = Math.round((forecastData?.predictions?.[d] || [])[0] ?? 0);
                    return (
                      <MenuItem key={d} value={d}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                          <span style={{ fontSize: 14 }}>{dInfo.icon || '🏥'}</span>
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 12.5, color: T.textHead }}>{dInfo.label}</Typography>
                            <Typography sx={{ fontSize: 10.5, color: T.textFaint }}>{nextVal.toLocaleString()} next mo.</Typography>
                          </Box>
                          {d === selectedDisease && <CheckCircleIcon sx={{ fontSize: 13, color: T.blue }} />}
                        </Box>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Box>

            {/* Next Month Forecast */}
            <Box sx={{ p: '10px 12px', borderRadius: '10px',
              backgroundColor: '#FFFFFF', border: `1px solid ${T.border}` }}>
              <Typography sx={{ fontSize: 10.5, color: T.textMuted, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next Month Forecast</Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 700, color: T.textHead, lineHeight: 1.2, mt: 0.5 }}>
                {nextMonthVal.toLocaleString()}
              </Typography>
              <Typography sx={{ fontSize: 11, color: T.textFaint, mt: 0.25 }}>{dates[0] || ''}</Typography>
            </Box>

            {/* Peak Forecast */}
            <Box sx={{ p: '10px 12px', borderRadius: '10px',
              backgroundColor: '#FFFFFF', border: `1px solid ${T.border}` }}>
              <Typography sx={{ fontSize: 10.5, color: T.textMuted, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.5px' }}>Peak Forecast</Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 700, color: T.textHead, lineHeight: 1.2, mt: 0.5 }}>
                {peakForecast.toLocaleString()}
              </Typography>
              <Typography sx={{ fontSize: 11, color: T.textFaint, mt: 0.25 }}>highest predicted</Typography>
            </Box>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ overflow: 'auto', flex: 1, p: 3 }}>

          {/* ── Forecast Chart FIRST ── */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.textHead }}>
                Forecast
              </Typography>
              <TrendTag trend={trend} />
            </Box>
            {forecastChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={forecastChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false}
                    tick={{ fontSize: 10, fill: T.textFaint }} />
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

          {/* ── Actual Data Chart (with year selector) ── */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.textHead }}>
                Actual Data
              </Typography>
              {allHistYears.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <Select
                    value={selectedHistYear || ''}
                    onChange={e => setSelectedHistYear(e.target.value)}
                    displayEmpty
                    sx={{
                      fontSize: 12, color: T.textBody, backgroundColor: '#FFFFFF',
                      borderRadius: '7px',
                      '.MuiOutlinedInput-notchedOutline': { borderColor: T.border },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.blue },
                      '.MuiSelect-select': { py: '5px', px: '10px' },
                    }}
                  >
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
                  <XAxis dataKey="label" axisLine={false} tickLine={false}
                    tick={{ fontSize: 10, fill: T.textFaint }} />
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

          {/* ── Age/Sex breakdown ── */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <BarChartIcon sx={{ fontSize: 14, color: T.blue }} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.textHead }}>
                Age & Sex Breakdown
              </Typography>
            </Box>
            <AgeSexChart barangay={barangay} disease={disease} city={city} />
          </Box>

          {/* ── Specific disease breakdown ── */}
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
                      <Box sx={{ display: 'flex', alignItems: 'flex-start',
                        justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: idx === 0 ? 600 : 400,
                          color: idx === 0 ? T.textHead : T.textBody,
                          flex: 1, mr: 1, lineHeight: 1.4 }}>
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
                          <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.textHead,
                            minWidth: 48, textAlign: 'right' }}>
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
        </Box>
      </Box>
    </Box>
  );
};

// ── Year Picker ───────────────────────────────────────────────────────────────
const YearPicker = ({ availableYears, selectedYear, onSelect }) => {
  const [popupOpen, setPopupOpen] = useState(false);
  const popupRef = useRef(null);
  const btnRef   = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target) &&
          btnRef.current   && !btnRef.current.contains(e.target)) {
        setPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <Box>
      <Button ref={btnRef} size="small" onClick={() => setPopupOpen(o => !o)}
        startIcon={<CalendarMonthIcon sx={{ fontSize: 13 }} />}
        sx={{ textTransform: 'none', fontSize: 12, fontWeight: 600,
          color: popupOpen ? T.blue : T.textBody,
          border: `1.5px solid ${popupOpen ? T.blue : T.border}`,
          borderRadius: '8px', px: 1.75, py: '5px',
          backgroundColor: popupOpen ? T.blueDim : '#FFFFFF',
          '&:hover': { borderColor: T.blue, color: T.blue, backgroundColor: T.blueDim } }}>
        {selectedYear || 'All Years'}
      </Button>

      {popupOpen && ReactDOM.createPortal(
        <>
          <Box onClick={() => setPopupOpen(false)}
            sx={{ position: 'fixed', inset: 0, zIndex: 1399, backgroundColor: 'rgba(0,0,0,0.28)' }} />
          <Box ref={el => { popupRef.current = el; }} sx={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1400, backgroundColor: '#FFFFFF',
            border: `1px solid ${T.border}`, borderRadius: '14px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.18)', width: 340,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 2.5, py: 1.75, borderBottom: `1px solid ${T.borderSoft}`,
              backgroundColor: T.pageBg, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarMonthIcon sx={{ fontSize: 13, color: T.blue }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textHead }}>Select Year</Typography>
              </Box>
              <IconButton size="small" onClick={() => setPopupOpen(false)}
                sx={{ p: 0.4, color: T.textMuted }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
            </Box>
            <Box sx={{ p: 2.5 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <Box onClick={() => { onSelect(null); setPopupOpen(false); }}
                  sx={{ py: '10px', px: 1, borderRadius: '8px', cursor: 'pointer',
                    border: `1.5px solid ${!selectedYear ? T.blue : T.border}`,
                    backgroundColor: !selectedYear ? T.blueDim : '#FFFFFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    '&:hover': { borderColor: T.blue, backgroundColor: T.blueDim } }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: !selectedYear ? 600 : 400,
                    color: !selectedYear ? T.blue : T.textBody }}>All Years</Typography>
                </Box>
                {availableYears.map(yr => (
                  <Box key={yr} onClick={() => { onSelect(yr); setPopupOpen(false); }}
                    sx={{ py: '10px', px: 1, borderRadius: '8px', cursor: 'pointer',
                      border: `1.5px solid ${selectedYear === yr ? T.blue : T.border}`,
                      backgroundColor: selectedYear === yr ? T.blueDim : '#FFFFFF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      '&:hover': { borderColor: T.blue } }}>
                    <Typography sx={{ fontSize: 11.5, fontWeight: selectedYear === yr ? 600 : 400,
                      color: selectedYear === yr ? T.blue : T.textBody }}>{yr}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            <Box sx={{ px: 2.5, py: 1.75, borderTop: `1px solid ${T.borderSoft}`,
              display: 'flex', justifyContent: 'flex-end', backgroundColor: T.pageBg }}>
              <Button size="small" onClick={() => setPopupOpen(false)}
                sx={{ textTransform: 'none', fontSize: 12, color: T.textMuted,
                  border: `1px solid ${T.border}`, borderRadius: '7px', px: 1.75, py: 0.5 }}>
                Close
              </Button>
            </Box>
          </Box>
        </>
      , document.body)}
    </Box>
  );
};

// ── Export ────────────────────────────────────────────────────────────────────
const exportTableData = (format, forecastHistory, selectedBarangays, availableDiseases, cityLabel) => {
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

  const rows = [];
  [...selectedBarangays].forEach(barangay => {
    Object.keys(lookup[barangay] || {}).sort().forEach(period => {
      const diseaseMap = lookup[barangay][period] || {};
      const vals  = diseases.map(d => diseaseMap[d]?.predictedValue ?? 0);
      const total = vals.reduce((s, v) => s + v, 0);
      rows.push({ barangay, period, vals, total });
    });
  });

  if (format === 'csv') {
    const headers  = ['Barangay','Year','Month',...diseases.map(d => getDiseaseInfo(d).label),'Total'];
    const csvRows  = [headers.join(','), ...rows.map(r => [
      r.barangay, getPeriodYear(r.period), formatMonthLabel(r.period),
      ...r.vals.map(v => Math.round(v)), Math.round(r.total)
    ].join(','))];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `forecast_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  } else {
    const lines = ['PREDICTHEALTH — BARANGAY FORECAST TABLE', '='.repeat(60)];
    if (cityLabel) lines.push(`City: ${cityLabel}`);
    lines.push(`Generated: ${new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}`, '');
    rows.forEach(r => {
      lines.push(`${r.barangay} | ${getPeriodYear(r.period)} ${formatMonthLabel(r.period)}`);
      diseases.forEach((d, i) => lines.push(`  ${getDiseaseInfo(d).label}: ${Math.round(r.vals[i])}`));
      lines.push(`  Total: ${Math.round(r.total)}`, '');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `forecast_${new Date().toISOString().slice(0,10)}.txt`; a.click();
    URL.revokeObjectURL(url);
  }
};

const ExportMenu = ({ forecastHistory, confirmedBarangays, availableDiseases, cityLabel }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const disabled = confirmedBarangays.size === 0 || forecastHistory.length === 0;
  return (
    <Box ref={ref} sx={{ position: 'relative', flexShrink: 0 }}>
      <Tooltip title={disabled ? 'Confirm a barangay first' : 'Export table data'} placement="top">
        <span>
          <Button onClick={() => !disabled && setOpen(o => !o)} disabled={disabled}
            startIcon={<FileDownloadIcon sx={{ fontSize: 14 }} />}
            endIcon={<ArrowDownIcon sx={{ fontSize: 13, transition: 'transform 0.2s',
              transform: open ? 'rotate(180deg)' : 'none' }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 500, color: T.textMuted,
              backgroundColor: '#FFFFFF', border: `1px solid ${T.border}`, borderRadius: '8px',
              px: 1.5, py: '6px', '&:hover': { backgroundColor: T.borderSoft, borderColor: T.blue },
              '&:disabled': { opacity: 0.4 } }}>
            Export
          </Button>
        </span>
      </Tooltip>
      {open && (
        <Box sx={{ position: 'fixed', zIndex: 1400, backgroundColor: '#FFFFFF',
          border: `1px solid ${T.border}`, borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 170, overflow: 'hidden' }}
          ref={el => {
            if (el && ref.current) {
              const btn = ref.current.getBoundingClientRect();
              el.style.top  = (btn.bottom + 6) + 'px';
              el.style.right = (window.innerWidth - btn.right) + 'px';
            }
          }}>
          {[{ format: 'csv', label: 'Export as CSV' }, { format: 'txt', label: 'Export as TXT' }].map(opt => (
            <Box key={opt.format}
              onClick={() => { exportTableData(opt.format, forecastHistory, confirmedBarangays, availableDiseases, cityLabel); setOpen(false); }}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.125,
                cursor: 'pointer', '&:hover': { backgroundColor: T.borderSoft } }}>
              <FileIcon sx={{ fontSize: 14, color: T.textMuted }} />
              <Typography sx={{ fontSize: 12.5, color: T.textBody }}>{opt.label}</Typography>
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

  const handleOpen = () => {
    onPendingChange(new Set(confirmed));
    setPopupOpen(true);
  };

  useEffect(() => {
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target) &&
          btnRef.current   && !btnRef.current.contains(e.target)) {
        setPopupOpen(false);
      }
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

  const handleCancel = () => {
    onPendingChange(new Set(confirmed));
    setPopupOpen(false);
  };

  const handleConfirm = () => {
    onConfirm(pending);
    setPopupOpen(false);
  };

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
          <Box onClick={handleCancel}
            sx={{ position: 'fixed', inset: 0, zIndex: 1399, backgroundColor: 'rgba(0,0,0,0.45)' }} />
          <Box ref={el => { popupRef.current = el; }} sx={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1400, backgroundColor: '#FFFFFF',
            border: `1px solid ${T.border}`, borderRadius: '14px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
            width: '90vw', maxWidth: 760,
            maxHeight: '80vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 2.5, py: 1.75, borderBottom: `1px solid ${T.borderSoft}`,
              backgroundColor: T.pageBg, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocationOnIcon sx={{ fontSize: 13, color: T.blue }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textHead }}>Select Barangay</Typography>
                {pending.size > 0 && (
                  <Box sx={{ px: 1, py: 0.2, borderRadius: '4px', backgroundColor: T.blueDim,
                    border: '1px solid rgba(27,79,138,0.2)' }}>
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
                <IconButton size="small" onClick={handleCancel}
                  sx={{ p: 0.4, color: T.textMuted }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
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
// Simplified: Barangay | Year | Month | Total Forecast | Details
const ForecastTable = ({ forecastHistory, confirmedBarangays, availableDiseases,
                         selectedYear, onRowClick }) => {
  const diseases = availableDiseases.length > 0
    ? availableDiseases
    : [...new Set(forecastHistory.map(h => h.disease))];

  const filteredHistory = selectedYear
    ? forecastHistory.filter(h => getPeriodYear(h.period) === selectedYear)
    : forecastHistory;

  const lookup = {};
  filteredHistory.forEach(h => {
    if (!confirmedBarangays.has(h.barangay)) return;
    if (!lookup[h.barangay]) lookup[h.barangay] = {};
    if (!lookup[h.barangay][h.period]) lookup[h.barangay][h.period] = {};
    lookup[h.barangay][h.period][h.disease] = h;
  });

  const thSx = {
    fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase',
    letterSpacing: '0.5px', padding: '10px 14px', textAlign: 'left',
    whiteSpace: 'nowrap', backgroundColor: T.pageBg, borderBottom: `1px solid ${T.border}`,
  };
  const tdSx = {
    fontSize: 12.5, color: T.textBody, padding: '10px 14px',
    borderBottom: `1px solid ${T.borderSoft}`, verticalAlign: 'middle',
  };

  const rows = [];
  [...confirmedBarangays].forEach(barangay => {
    Object.keys(lookup[barangay] || {}).sort().forEach(period => {
      const diseaseMap = lookup[barangay][period] || {};
      const vals  = diseases.map(d => Math.round(diseaseMap[d]?.predictedValue ?? 0));
      const total = vals.reduce((s, v) => s + v, 0);

      // Majority-vote trend
      const trendCount = { increasing: 0, decreasing: 0, stable: 0 };
      diseases.forEach(d => { const t = diseaseMap[d]?.trend || 'stable'; trendCount[t]++; });
      const rowTrend = Object.entries(trendCount).sort((a,b) => b[1]-a[1])[0]?.[0] || 'stable';

      rows.push({ barangay, period, total, rowTrend });
    });
  });

  if (rows.length === 0) return (
    <Box sx={{ py: 5, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>
        No forecast data found for the selected barangay(s).
      </Typography>
    </Box>
  );

  return (
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
                    <Typography sx={{ fontSize: 11, fontWeight: 600, mb: 0.5, color: '#fff' }}>How trend is determined:</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                      <TrendingUpIcon sx={{ fontSize: 11 }} />
                      <Typography sx={{ fontSize: 11 }}>Increasing — last vs first &gt; +0.5</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                      <RemoveIcon sx={{ fontSize: 11 }} />
                      <Typography sx={{ fontSize: 11 }}>Stable — between −0.5 and +0.5</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <TrendingDownIcon sx={{ fontSize: 11 }} />
                      <Typography sx={{ fontSize: 11 }}>Decreasing — last vs first &lt; −0.5</Typography>
                    </Box>
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
          {rows.map(({ barangay, period, total, rowTrend }) => (
            <tr key={`${barangay}-${period}`} style={{ backgroundColor: '#FFFFFF' }}>
              <td style={{ ...tdSx, fontWeight: 600, color: T.textHead }}>{barangay}</td>
              <td style={{ ...tdSx, color: T.textMuted, fontWeight: 500 }}>{getPeriodYear(period)}</td>
              <td style={tdSx}>{formatMonthLabel(period)}</td>
              <td style={{ ...tdSx, textAlign: 'right', fontWeight: 700, color: T.textHead }}>
                {total.toLocaleString()}
              </td>
              <td style={{ ...tdSx, textAlign: 'center' }}>
                <TrendTag trend={rowTrend} />
              </td>
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

      {/* Trend legend with thresholds below table */}
      <Box sx={{ px: 2.5, py: 2, borderTop: `1px solid ${T.borderSoft}`, backgroundColor: T.pageBg }}>
        <TrendLegend showThresholds={true} />
      </Box>
    </Box>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const LS_CONFIRMED = 'predictionConfirmedBarangays';
const LS_SEL_YEAR  = 'predictionSelectedYear';

const saveConfirmed = (set) => {
  try { localStorage.setItem(LS_CONFIRMED, JSON.stringify([...set])); } catch {}
};
const loadConfirmed = () => {
  try {
    const s = localStorage.getItem(LS_CONFIRMED);
    return s ? new Set(JSON.parse(s)) : new Set();
  } catch { return new Set(); }
};

// Build forecastHistory entries from a getSavedForecast result
const buildHistoryEntries = (result, brgy, cityLabel) => {
  const diseases = result.disease_columns || Object.keys(result.predictions || {});
  return diseases.flatMap(disease => {
    const preds = result.predictions[disease] || [];
    return result.forecast_dates.map((fd, i) => ({
      id: Date.now() + Math.random(),
      disease,
      label: getDiseaseInfo(disease).label,
      period: fd.slice(0, 7),
      predictedValue: Math.round(preds[i] ?? 0),
      trend: preds.length >= 2
        ? (preds[preds.length-1]-preds[0] > 0.5 ? 'increasing'
          : preds[preds.length-1]-preds[0] < -0.5 ? 'decreasing' : 'stable')
        : 'stable',
      barangay: brgy,
      city: result.city || cityLabel,
    }));
  });
};

// ── Main Prediction Page ──────────────────────────────────────────────────────
const Prediction = ({ onNavigate, onLogout }) => {
  const [forecastData,       setForecastData]       = useState(() => {
    try { const s = localStorage.getItem('cachedForecastData'); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });
  const [availableBarangays, setAvailableBarangays] = useState([]);
  const [availableDiseases,  setAvailableDiseases]  = useState([]);
  const [forecastHistory,    setForecastHistory]    = useState([]);
  const [pendingBarangays,   setPendingBarangays]   = useState(new Set());

  // ── Restore confirmed barangays + year from localStorage on mount ──
  const [confirmedBarangays, setConfirmedBarangays] = useState(() => loadConfirmed());
  const [selectedYear,       setSelectedYear]       = useState(() => {
    try { return localStorage.getItem(LS_SEL_YEAR) || null; } catch { return null; }
  });
  const [loadingBarangay,    setLoadingBarangay]    = useState(null);
  const [restoringSelection, setRestoringSelection] = useState(false);

  const [detailPanel,    setDetailPanel]    = useState(null);
  const [detailForecast, setDetailForecast] = useState(null);
  const [detailLoading,  setDetailLoading]  = useState(false);

  const cityLabel = localStorage.getItem('datasetCity') || '';

  // ── Persist selectedYear whenever it changes ──
  useEffect(() => {
    try {
      if (selectedYear) localStorage.setItem(LS_SEL_YEAR, selectedYear);
      else localStorage.removeItem(LS_SEL_YEAR);
    } catch {}
  }, [selectedYear]);

  // ── On mount: load base data + restore confirmed barangay history ──
  useEffect(() => {
    const dis  = localStorage.getItem('diseaseColumns');
    if (dis)  setAvailableDiseases(JSON.parse(dis));
    const bar  = localStorage.getItem('availableBarangays');
    if (bar)  setAvailableBarangays(JSON.parse(bar));

    // Load existing history from localStorage first
    let existingHistory = [];
    try {
      const hist = localStorage.getItem('forecastHistory');
      if (hist) {
        existingHistory = JSON.parse(hist);
        setForecastHistory(existingHistory);
      }
    } catch {}

    // Restore data for confirmed barangays not yet in forecastHistory
    const confirmed = loadConfirmed();
    if (confirmed.size === 0) return;

    const existingBarangays = new Set(existingHistory.map(h => h.barangay).filter(Boolean));
    const needsRestore = [...confirmed].filter(b => !existingBarangays.has(b));

    if (needsRestore.length === 0) return;

    // Fetch missing barangays in background
    setRestoringSelection(true);
    const city = localStorage.getItem('datasetCity') || '';

    Promise.allSettled(
      needsRestore.map(brgy =>
        getSavedForecast(brgy, city).then(result => ({ brgy, result }))
      )
    ).then(results => {
      const newEntries = [];
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value.result) {
          newEntries.push(...buildHistoryEntries(r.value.result, r.value.brgy, city));
        }
      });
      if (newEntries.length > 0) {
        setForecastHistory(prev => {
          // Don't duplicate — remove any existing entries for these barangays then add fresh
          const fetched = new Set(needsRestore);
          const filtered = prev.filter(h => !fetched.has(h.barangay));
          const updated  = [...filtered, ...newEntries];
          try { localStorage.setItem('forecastHistory', JSON.stringify(updated)); } catch {}
          return updated;
        });
      }
    }).finally(() => setRestoringSelection(false));
  }, []); // run once on mount

  // ── Persist confirmedBarangays whenever it changes ──
  useEffect(() => {
    saveConfirmed(confirmedBarangays);
  }, [confirmedBarangays]);

  const generatedBarangays = new Set(
    forecastHistory.map(h => h.barangay).filter(b => b && b !== ALL_BARANGAYS)
  );
  const hasDbData = availableBarangays.length > 0;
  const effectiveGeneratedBarangays = hasDbData
    ? new Set(availableBarangays)
    : generatedBarangays;

  const availableYears = [...new Set(
    forecastHistory.map(h => getPeriodYear(h.period)).filter(Boolean)
  )].sort();

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
    } catch (e) {
      console.error('Failed to load forecast details:', e);
    } finally {
      setDetailLoading(false);
    }
  }, [cityLabel]);

  const handleConfirmBarangays = useCallback(async (selected) => {
    setConfirmedBarangays(new Set(selected));
    // saveConfirmed is handled by the useEffect above

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
      } catch (e) {
        console.error(`Failed to load forecast for ${brgy}:`, e);
      } finally {
        setLoadingBarangay(null);
      }
    }
  }, [forecastHistory, cityLabel]);

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

        <Box sx={{ px: '24px', pt: '20px', pb: '28px', overflow: 'auto', flex: 1,
          display: 'flex', flexDirection: 'column' }}>

          <SCard sx={{ mb: '14px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                  <BarangayPicker
                    availableBarangays={availableBarangays}
                    generatedBarangays={effectiveGeneratedBarangays}
                    pending={pendingBarangays}
                    onPendingChange={setPendingBarangays}
                    onConfirm={handleConfirmBarangays}
                    confirmed={confirmedBarangays}
                  />
                  <YearPicker
                    availableYears={availableYears}
                    selectedYear={selectedYear}
                    onSelect={setSelectedYear}
                  />
                  {loadingBarangay && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={12} sx={{ color: T.blue }} />
                      <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
                        Loading {loadingBarangay}…
                      </Typography>
                    </Box>
                  )}
                  {restoringSelection && !loadingBarangay && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={12} sx={{ color: T.blue }} />
                      <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
                        Restoring selection…
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

          <SCard sx={{ flex: confirmedBarangays.size === 0 ? 1 : 'none',
            display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
              {effectiveGeneratedBarangays.size === 0 && (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', textAlign: 'center', py: 4 }}>
                  <PsychologyIcon sx={{ fontSize: 38, color: T.textFaint, mb: 1.5 }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead, mb: 0.5 }}>
                    No forecast generated yet
                  </Typography>
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
              {effectiveGeneratedBarangays.size > 0 && confirmedBarangays.size === 0 && (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', textAlign: 'center', py: 4 }}>
                  <LocationOnIcon sx={{ fontSize: 38, color: T.textFaint, mb: 1.5 }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead, mb: 0.5 }}>
                    No barangay selected
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: T.textMuted }}>
                    Click <strong>Select Barangay</strong> above then click <strong>Confirm</strong>.
                  </Typography>
                </Box>
              )}
              {confirmedBarangays.size > 0 && (
                <ForecastTable
                  forecastHistory={forecastHistory}
                  confirmedBarangays={confirmedBarangays}
                  availableDiseases={availableDiseases}
                  selectedYear={selectedYear}
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