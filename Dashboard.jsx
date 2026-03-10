import { getForecast } from './services/api';
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Chip,
  Alert, LinearProgress, Select, MenuItem as MenuItemComponent,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  CloudUpload as CloudUploadIcon,
  Warning as WarningIcon,
  InfoOutlined as InfoOutlinedIcon,
  Psychology as PsychologyIcon,
  CheckCircle as CheckCircleIcon,
  Group as GroupIcon,
  LocationOn as LocationOnIcon,
  CalendarMonth as CalendarIcon,
  LocationCity as CityIcon,
  TrendingUp as TrendIcon,
} from '@mui/icons-material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import Sidebar, { T } from './Sidebar';

// ── Constants ─────────────────────────────────────────────────────────────────
const ALL_BARANGAYS = '__ALL__';

// ── Disease config ────────────────────────────────────────────────────────────
const DISEASE_MAP = {
  dengue_cases:                { label: 'Dengue',         color: T.danger,      icon: '🦟' },
  diarrhea_cases:              { label: 'Diarrhea',       color: '#0EA5E9',     icon: '💧' },
  respiratory_cases:           { label: 'Respiratory',    color: T.warn,        icon: '🫁' },
  malnutrition_cases:          { label: 'Malnutrition',   color: T.neutralLight,icon: '⚕️' },
  malnutrition_prevalence_pct: { label: 'Malnutrition %', color: T.neutralLight,icon: '⚕️' },
  hypertension_cases:          { label: 'Hypertension',   color: T.neutralLight,icon: '❤️' },
  diabetes_cases:              { label: 'Diabetes',       color: T.warn,        icon: '🩸' },
};

const getDiseaseInfo = (col) => {
  if (DISEASE_MAP[col]) return DISEASE_MAP[col];
  const label = col
    .replace(/_cases$/, '').replace(/_prevalence_pct$/, ' %')
    .replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return { label, color: T.blue, icon: '🏥' };
};

const trendColor  = (t) => t === 'increasing' ? T.danger  : t === 'decreasing' ? T.ok  : T.textMuted;
const trendBg     = (t) => t === 'increasing' ? T.dangerBg  : t === 'decreasing' ? T.okBg  : T.borderSoft;
const trendBorder = (t) => t === 'increasing' ? T.dangerBorder : t === 'decreasing' ? T.okBorder : T.border;

const getTrend = (preds) => {
  if (!preds || preds.length < 2) return 'stable';
  const diff = preds[preds.length - 1] - preds[0];
  return diff > 0.5 ? 'increasing' : diff < -0.5 ? 'decreasing' : 'stable';
};

const getConfidence = (disease) =>
  ({ dengue_cases:87, diarrhea_cases:82, respiratory_cases:79, malnutrition_prevalence_pct:74, malnutrition_cases:76, hypertension_cases:83, diabetes_cases:80 })[disease] ?? 78;

// ── Shared components ─────────────────────────────────────────────────────────
const SCard = ({ children, sx = {} }) => (
  <Card sx={{
    borderRadius: '10px',
    backgroundColor: '#FFFFFF',
    border: `1px solid ${T.border}`,
    boxShadow: 'none',
    ...sx,
  }}>
    {children}
  </Card>
);

const SelectSx = {
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  fontSize: 13,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.blue },
  '& .MuiSelect-select': { py: '7px', px: '12px' },
};

const tooltipStyle = {
  borderRadius: '8px',
  border: `1px solid ${T.border}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: 12,
  color: T.textBody,
  background: '#FFFFFF',
};

// ── Trend row icon ─────────────────────────────────────────────────────────────
const TrendRowIcon = ({ type }) => {
  const cfg = {
    increasing: { color: T.danger,    bg: T.dangerBg,  icon: '↑' },
    decreasing: { color: T.ok,        bg: T.okBg,      icon: '↓' },
    warning:    { color: T.warn,      bg: T.warnBg,    icon: '⚠' },
    stable:     { color: T.textMuted, bg: T.borderSoft, icon: '—' },
  };
  const c = cfg[type] || cfg.stable;
  return (
    <Box sx={{
      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
      backgroundColor: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, color: c.color,
    }}>{c.icon}</Box>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = ({ onNavigate, onLogout, uploadedFile, uploadedData }) => {

  const [selectedBarangay,   setSelectedBarangay]   = useState(() => localStorage.getItem('cachedForecastBarangay') || ALL_BARANGAYS);
  const [selectedDisease,    setSelectedDisease]    = useState(() => localStorage.getItem('cachedForecastDisease')  || 'all');
  const [forecastHorizon,    setForecastHorizon]    = useState(() => localStorage.getItem('cachedForecastHorizon')  || '3');
  const [availableBarangays, setAvailableBarangays] = useState([]);
  const [availableDiseases,  setAvailableDiseases]  = useState([]);
  const [forecastLoading,    setForecastLoading]    = useState(false);
  const [forecastError,      setForecastError]      = useState('');
  const [forecastData,       setForecastData]       = useState(() => {
    try { const s = localStorage.getItem('cachedForecastData'); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });
  const [displayedBarangay,  setDisplayedBarangay]  = useState(() => localStorage.getItem('cachedForecastBarangay') || null);
  const [displayedHorizon,   setDisplayedHorizon]   = useState(() => localStorage.getItem('cachedForecastHorizon')  || null);

  const [hasData,             setHasData]             = useState(false);
  const [uploadedInfo,        setUploadedInfo]        = useState(null);
  const [forecastHistory,     setForecastHistory]     = useState([]);
  const [diseaseSummary,      setDiseaseSummary]      = useState([]);
  const [miniTrendData,       setMiniTrendData]       = useState([]);
  const [totalForecasted,     setTotalForecasted]     = useState(0);
  const [latestForecastMonth, setLatestForecastMonth] = useState('N/A');

  const cityLabel     = localStorage.getItem('datasetCity') || '';
  const barangayLabel = selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : selectedBarangay;

  useEffect(() => {
    try {
      const up  = localStorage.getItem('uploadedData');
      if (up)  setUploadedInfo(JSON.parse(up));
      const bar = localStorage.getItem('availableBarangays');
      if (bar) { const p = JSON.parse(bar); setAvailableBarangays(Array.isArray(p) ? p : []); }
      const dis = localStorage.getItem('diseaseColumns');
      if (dis) setAvailableDiseases(JSON.parse(dis));
      const raw = localStorage.getItem('forecastHistory');
      if (raw) {
        const h = JSON.parse(raw);
        setForecastHistory(h);
        setHasData(h.length > 0);
        computeInsights(h);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { if (selectedBarangay) localStorage.setItem('cachedForecastBarangay', selectedBarangay); }, [selectedBarangay]);
  useEffect(() => { localStorage.setItem('cachedForecastHorizon', forecastHorizon); }, [forecastHorizon]);
  useEffect(() => { localStorage.setItem('cachedForecastDisease', selectedDisease); }, [selectedDisease]);
  useEffect(() => {
    if (forecastData) {
      try { localStorage.setItem('cachedForecastData', JSON.stringify(forecastData)); } catch {}
    }
  }, [forecastData]);

  const computeInsights = (history) => {
    if (!history?.length) return;
    const periods = history.map(h => h.period).filter(Boolean).sort();
    const latest  = periods[periods.length - 1] || 'N/A';
    setLatestForecastMonth(latest);
    setTotalForecasted(history.filter(h => h.period === latest).reduce((s, h) => s + (h.predictedValue || 0), 0));

    const dMap = {};
    history.forEach(item => {
      if (!dMap[item.disease]) dMap[item.disease] = {
        disease: item.disease,
        label: item.label || getDiseaseInfo(item.disease).label,
        info: getDiseaseInfo(item.disease),
        values: [], trend: 'stable', latestValue: 0, confidence: 78,
      };
      dMap[item.disease].values.push(item.predictedValue || 0);
      if (!dMap[item.disease].latestPeriod || item.period > dMap[item.disease].latestPeriod) {
        Object.assign(dMap[item.disease], {
          latestPeriod: item.period, latestValue: item.predictedValue || 0,
          trend: item.trend || 'stable', confidence: item.confidence || 78,
        });
      }
    });
    const sumArr = Object.values(dMap);
    setDiseaseSummary(sumArr);

    const pMap = {};
    history.forEach(item => { pMap[item.period] = (pMap[item.period] || 0) + (item.predictedValue || 0); });
    setMiniTrendData(
      Object.entries(pMap).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
        .map(([p, c]) => ({ month: p.slice(0, 7), cases: Math.round(c) }))
    );
  };

  const activeDiseases = forecastData
    ? (selectedDisease === 'all'
        ? Object.keys(forecastData.predictions)
        : [selectedDisease].filter(d => forecastData.predictions?.[d]))
    : [];

  const getSummaryStats = () => {
    if (!forecastData || activeDiseases.length === 0) return null;
    if (selectedDisease === 'all') {
      let totalNext = 0, totalStart = 0, totalEnd = 0;
      activeDiseases.forEach(d => {
        const p = forecastData.predictions[d] || [];
        totalNext += p[0] || 0; totalStart += p[0] || 0; totalEnd += p[p.length - 1] || 0;
      });
      const diff = totalEnd - totalStart;
      const trend = diff > 0.5 ? 'increasing' : diff < -0.5 ? 'decreasing' : 'stable';
      const pct   = ((totalEnd - totalStart) / (totalStart || 1)) * 100;
      return {
        nextVal: Math.round(totalNext), trend,
        pct: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%',
        confidence: Math.round(activeDiseases.reduce((s, d) => s + getConfidence(d), 0) / activeDiseases.length),
        nextMonth: forecastData.forecast_dates?.[0]?.slice(0, 7) || '',
        periodLabel: forecastData.forecast_dates?.length
          ? `${forecastData.forecast_dates[0]?.slice(0, 7)} – ${forecastData.forecast_dates[forecastData.forecast_dates.length - 1]?.slice(0, 7)}`
          : '',
      };
    } else {
      const preds = forecastData.predictions[selectedDisease] || [];
      const diff  = preds.length >= 2 ? preds[preds.length - 1] - preds[0] : 0;
      const pct   = (diff / (preds[0] || 1)) * 100;
      return {
        nextVal: Math.round(preds[0] ?? 0),
        trend: diff > 0.5 ? 'increasing' : diff < -0.5 ? 'decreasing' : 'stable',
        pct: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%',
        confidence: getConfidence(selectedDisease),
        nextMonth: forecastData.forecast_dates?.[0]?.slice(0, 7) || '',
        periodLabel: forecastData.forecast_dates?.length
          ? `${forecastData.forecast_dates[0]?.slice(0, 7)} – ${forecastData.forecast_dates[forecastData.forecast_dates.length - 1]?.slice(0, 7)}`
          : '',
      };
    }
  };

  const buildChartData = () => {
    if (!forecastData) return miniTrendData.map(d => ({ month: d.month, actual: d.cases, predicted: null }));
    const data = [];
    const histDates = forecastData.historical_data?.dates?.slice(-6) || [];
    histDates.forEach((date, i) => {
      let total = 0;
      activeDiseases.forEach(d => { total += (forecastData.historical_data[d] || []).slice(-6)[i] || 0; });
      data.push({ month: date.slice(0, 7), actual: Math.round(total), predicted: null });
    });
    forecastData.forecast_dates?.forEach((date, i) => {
      let total = 0;
      activeDiseases.forEach(d => { total += (forecastData.predictions[d] || [])[i] || 0; });
      data.push({ month: date.slice(0, 7), actual: null, predicted: Math.round(total) });
    });
    return data;
  };

  const buildTrendSummary = () => {
    const sourceData = forecastData
      ? activeDiseases.map(d => ({
          disease: d,
          label: getDiseaseInfo(d).label,
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
      const barangayStr = selectedBarangay === ALL_BARANGAYS ? 'all barangays' : selectedBarangay;
      if (d.trend === 'increasing') {
        items.push({ type: 'increasing', text: `${d.label} cases are projected to increase${d.pct ? ' by ' + d.pct : ''} in ${barangayStr} — increased monitoring recommended.` });
      } else if (d.trend === 'decreasing') {
        items.push({ type: 'decreasing', text: `${d.label} cases are projected to decline${d.pct ? ' by ' + d.pct : ''} in ${barangayStr} — positive outlook.` });
      } else {
        items.push({ type: 'stable', text: `${d.label} cases are expected to remain stable in ${barangayStr}.` });
      }
    });

    const increasing = filtered.filter(d => d.trend === 'increasing');
    if (selectedDisease === 'all' && increasing.length >= 2) {
      items.unshift({ type: 'warning', text: `${increasing.length} diseases are trending upward simultaneously — consider prioritizing resources across multiple health programs.` });
    }

    return items;
  };

  const handleGenerateForecast = async () => {
    if (!uploadedFile) { setForecastError('No dataset loaded. Please go to Data Import first.'); return; }
    setForecastLoading(true); setForecastError('');
    try {
      const months   = parseInt(forecastHorizon);
      const diseases = availableDiseases;

      let result;
      if (selectedBarangay === ALL_BARANGAYS) {
        const barangayResults = await Promise.all(
          availableBarangays.map(b => getForecast(uploadedFile, b, diseases, months).catch(() => null))
        );
        const valid = barangayResults.filter(Boolean);
        if (!valid.length) throw new Error('No forecast data returned for any barangay.');
        const base = valid[0];
        const mergedPredictions = {};
        const mergedHistorical  = { dates: base.historical_data.dates };
        diseases.forEach(d => {
          mergedPredictions[d] = base.forecast_dates.map((_, i) => valid.reduce((sum, r) => sum + ((r.predictions[d] || [])[i] || 0), 0));
          mergedHistorical[d]  = base.historical_data.dates.map((_, i) => valid.reduce((sum, r) => sum + ((r.historical_data[d] || [])[i] || 0), 0));
        });
        result = { ...base, predictions: mergedPredictions, historical_data: mergedHistorical };
      } else {
        result = await getForecast(uploadedFile, selectedBarangay, diseases, months);
      }

      setForecastData(result);
      setDisplayedBarangay(selectedBarangay);
      setDisplayedHorizon(forecastHorizon);

      if (result.disease_columns?.length > 0) {
        setAvailableDiseases(prev => {
          const merged = Array.from(new Set([...prev, ...result.disease_columns]));
          localStorage.setItem('diseaseColumns', JSON.stringify(merged));
          return merged;
        });
      }

      const now     = new Date();
      const dateStr = now.toISOString().slice(0, 10) + ' at ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const newEntries = Object.keys(result.predictions).flatMap((disease, idx) => {
        const preds = result.predictions[disease] || [];
        return result.forecast_dates.map((fd, i) => ({
          id: Date.now() + idx * 100 + i, disease,
          label: getDiseaseInfo(disease).label,
          period: fd.slice(0, 7), monthsAhead: i + 1,
          predictedValue: Math.round(preds[i] ?? 0),
          trend: getTrend(preds), confidence: getConfidence(disease),
          status: 'Completed', createdAt: dateStr,
          fileName: uploadedData?.fileName || uploadedFile?.name || 'dataset.xlsx',
          forecastHorizon: months + ' Month' + (months > 1 ? 's' : ''),
          barangay: selectedBarangay,
        }));
      });

      const updatedHistory = [...newEntries, ...forecastHistory];
      setForecastHistory(updatedHistory);
      setHasData(true);
      computeInsights(updatedHistory);
      localStorage.setItem('forecastHistory', JSON.stringify(updatedHistory));

    } catch (err) {
      setForecastError(err.message || 'Forecast failed. Please try again.');
    } finally {
      setForecastLoading(false);
    }
  };

  const stats      = getSummaryStats();
  const chartData  = buildChartData();
  const trendItems = buildTrendSummary();
  const isStale    = forecastData && displayedBarangay && (displayedBarangay !== selectedBarangay || displayedHorizon !== forecastHorizon);
  const isUpToDate = forecastData && displayedBarangay && displayedBarangay === selectedBarangay && displayedHorizon === forecastHorizon;

  const currentMonth   = new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const nextMonthDate  = new Date(); nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const nextMonthLabel = nextMonthDate.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const thisMonthKey   = new Date().toISOString().slice(0, 7);
  const totalThisMonth = forecastHistory.filter(h => h.period === thisMonthKey).reduce((s, h) => s + (h.predictedValue || 0), 0);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: T.pageBg }}>
      <Sidebar currentPage="dashboard" onNavigate={onNavigate} onLogout={onLogout} />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* ── Page header ── */}
        <Box sx={{
          px: '24px',
          minHeight: 64,
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          flexShrink: 0,
        }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: T.textHead, letterSpacing: '-0.2px' }}>
            Barangay Health Dashboard
          </Typography>
        </Box>

        <Box sx={{ px: '24px', pt: '20px', pb: '28px', overflow: 'auto', flex: 1 }}>

          {/* ── No dataset warning ── */}
          {!uploadedFile && (
            <Alert severity="info" icon={<InfoOutlinedIcon fontSize="small" />}
              sx={{ mb: 2.5, borderRadius: '10px', backgroundColor: T.blueDim, color: T.textHead, border: `1px solid rgba(37,99,235,0.18)`, fontSize: 13, '& .MuiAlert-icon': { color: T.blue } }}>
              <strong>No data uploaded yet.</strong>{' '}
              <Typography component="span" onClick={() => onNavigate?.('dataimport')}
                sx={{ fontWeight: 600, fontSize: 13, cursor: 'pointer', color: T.blue, '&:hover': { opacity: 0.75 }, display: 'inline' }}>
                Upload your health dataset
              </Typography>
            </Alert>
          )}

          {/* ── Forecast Controls ── */}
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
                    <MenuItemComponent value="all" sx={{ fontSize: 13 }}>All Diseases</MenuItemComponent>
                    {availableDiseases.map(col => {
                      const info = getDiseaseInfo(col);
                      return <MenuItemComponent key={col} value={col} sx={{ fontSize: 13 }}>{info.label}</MenuItemComponent>;
                    })}
                  </Select>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 12, color: T.textMuted, fontWeight: 500, whiteSpace: 'nowrap' }}>Horizon:</Typography>
                  <Select value={forecastHorizon} size="small" sx={{ ...SelectSx, minWidth: 130 }} onChange={(e) => setForecastHorizon(e.target.value)}>
                    <MenuItemComponent value="1" sx={{ fontSize: 13 }}>1 Month</MenuItemComponent>
                    <MenuItemComponent value="3" sx={{ fontSize: 13 }}>3 Months</MenuItemComponent>
                    <MenuItemComponent value="6" sx={{ fontSize: 13 }}>6 Months</MenuItemComponent>
                  </Select>
                </Box>
                <Button
                  variant="contained"
                  onClick={handleGenerateForecast}
                  disabled={forecastLoading || !uploadedFile}
                  startIcon={forecastLoading ? <CircularProgress size={13} color="inherit" /> : <PsychologyIcon sx={{ fontSize: 15 }} />}
                  sx={{
                    ml: 'auto', textTransform: 'none', fontWeight: 600, fontSize: 13,
                    borderRadius: '8px', px: 2.5, py: '7px',
                    backgroundColor: T.blue, color: '#fff',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.2)',
                    '&:hover': { backgroundColor: T.blueMid },
                    '&:disabled': { opacity: 0.5 },
                  }}>
                  {forecastLoading ? 'Generating…' : 'Generate Forecast'}
                </Button>
              </Box>
            </CardContent>
          </SCard>

          {/* ── Loading bar ── */}
          {forecastLoading && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress sx={{ borderRadius: 2, height: 3, backgroundColor: T.borderSoft, '& .MuiLinearProgress-bar': { backgroundColor: T.blue } }} />
              <Typography sx={{ fontSize: 11, color: T.textMuted, mt: 0.75, textAlign: 'center' }}>
                Analyzing data for {selectedBarangay === ALL_BARANGAYS ? 'all barangays' : selectedBarangay}… (30–60 seconds)
              </Typography>
            </Box>
          )}

          {forecastError && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px', fontSize: 13 }}>{forecastError}</Alert>}

          {/* ── Stale / Up-to-date banners ── */}
          {isStale && (
            <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.25, mb: '14px', borderRadius: '8px', backgroundColor: T.warnBg, border: `1px solid ${T.warnBorder}` }}>
              <InfoOutlinedIcon sx={{ fontSize: 14, color: T.warn, mr: 1, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12.5, color: T.textBody }}>
                Showing old forecast — click <strong>Generate Forecast</strong> to update.
              </Typography>
            </Box>
          )}
          {isUpToDate && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, mb: '14px', borderRadius: '8px', backgroundColor: T.okBg, border: `1px solid ${T.okBorder}` }}>
              <CheckCircleIcon sx={{ fontSize: 14, color: T.ok }} />
              <Typography sx={{ fontSize: 12.5, color: T.textBody }}>
                Forecast ready for <strong>{displayedBarangay === ALL_BARANGAYS ? 'All Barangays' : displayedBarangay}</strong> · {displayedHorizon} months ahead
              </Typography>
            </Box>
          )}

          {/* ── 4 Stat cards ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', mb: '14px' }}>

            {/* Location */}
            <SCard sx={{ borderTop: `3px solid ${T.blue}` }}>
              <CardContent sx={{ p: '16px', '&:last-child': { pb: '16px' } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: T.textFaint }}>Location</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '6px', backgroundColor: T.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LocationOnIcon sx={{ fontSize: 15, color: T.blue }} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textHead, lineHeight: 1.3 }}>
                  {cityLabel || (uploadedInfo?.fileName ? '—' : '—')}
                </Typography>
                <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.25 }}>
                  {selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : (selectedBarangay || '—')}
                </Typography>
                <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {uploadedInfo?.fileName || 'No dataset loaded'}
                </Typography>
              </CardContent>
            </SCard>

            {/* Total Patients This Month */}
            <SCard sx={{ borderTop: `3px solid ${T.blue}` }}>
              <CardContent sx={{ p: '16px', '&:last-child': { pb: '16px' } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: T.textFaint }}>Total Patients</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '6px', backgroundColor: T.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GroupIcon sx={{ fontSize: 15, color: T.blue }} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, color: T.textHead, lineHeight: 1, letterSpacing: '-0.5px' }}>
                  {hasData ? (stats?.nextVal ?? totalThisMonth ?? totalForecasted).toLocaleString() : '—'}
                </Typography>
                {stats && (
                  <Typography sx={{ fontSize: 11.5, color: trendColor(stats.trend), fontWeight: 600, mt: 0.5 }}>
                    {stats.pct} from current
                  </Typography>
                )}
                <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 0.25 }}>{currentMonth}</Typography>
              </CardContent>
            </SCard>

            {/* Predicted Next Month */}
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
                {stats && (
                  <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: trendColor(stats.trend), mt: 0.5 }}>
                    {stats.pct} from current
                  </Typography>
                )}
                <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 0.25 }}>{stats?.nextMonth || nextMonthLabel}</Typography>
              </CardContent>
            </SCard>

            {/* Forecast Periods */}
            <SCard sx={{ borderTop: `3px solid ${T.ok}` }}>
              <CardContent sx={{ p: '16px', '&:last-child': { pb: '16px' } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: T.textFaint }}>Forecast Period</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '6px', backgroundColor: T.okBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarIcon sx={{ fontSize: 15, color: T.ok }} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, color: T.textHead, lineHeight: 1, letterSpacing: '-0.5px' }}>
                  {forecastHorizon} <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color: T.textMuted }}>{parseInt(forecastHorizon) === 1 ? 'Month' : 'Months'}</Typography>
                </Typography>
                <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 0.5 }}>
                  {stats?.periodLabel || (hasData ? `Last: ${latestForecastMonth}` : 'No forecasts yet')}
                </Typography>
              </CardContent>
            </SCard>
          </Box>

          {/* ── Chart ── */}
          <SCard sx={{ mb: '14px' }}>
            <CardContent sx={{ p: '18px 20px 14px', '&:last-child': { pb: '14px' } }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead, mb: 2 }}>
                Predicted Patient Volume
              </Typography>

              {(hasData || forecastData) && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                    <YAxis axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                    <RechartsTooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="actual" name="actual" stroke={T.ok} strokeWidth={2}
                      dot={{ fill: T.ok, r: 3, strokeWidth: 0 }} activeDot={{ r: 4, fill: T.ok, stroke: '#fff', strokeWidth: 2 }} connectNulls={false} />
                    <Line type="monotone" dataKey="predicted" name="predicted" stroke={T.blue} strokeWidth={2}
                      strokeDasharray="5 3"
                      dot={{ fill: T.blue, r: 3, strokeWidth: 0 }} activeDot={{ r: 4, fill: T.blue, stroke: '#fff', strokeWidth: 2 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}>
                  <Typography sx={{ fontSize: 13, color: T.textMuted }}>
                    No chart data yet — generate a forecast to see the trend
                  </Typography>
                </Box>
              )}
              {/* Centered legend below chart */}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 2, borderRadius: 1, backgroundColor: T.ok }} />
                  <Typography sx={{ fontSize: 11, color: T.textMuted }}>Actual</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 2, borderRadius: 1, backgroundColor: T.blue }} />
                  <Typography sx={{ fontSize: 11, color: T.textMuted }}>Predicted</Typography>
                </Box>
              </Box>
            </CardContent>
          </SCard>

          {/* ── Results ── */}
          <SCard>
            <CardContent sx={{ p: '18px 20px', '&:last-child': { pb: '20px' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.75 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>Results</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
                    {selectedDisease === 'all' ? 'All Diseases' : getDiseaseInfo(selectedDisease).label}
                  </Typography>
                  <Box sx={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: T.textFaint }} />
                  <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
                    {selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : selectedBarangay}
                  </Typography>
                  <Box sx={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: T.textFaint }} />
                  <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
                    {forecastHorizon} month{parseInt(forecastHorizon) > 1 ? 's' : ''}
                  </Typography>
                </Box>
              </Box>

              {trendItems.length === 0 ? (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 13, color: T.textMuted }}>Generate a forecast to see results</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {trendItems.map((item, i) => (
                    <Box key={i} sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      p: '10px 14px', borderRadius: '8px',
                      backgroundColor: trendBg(item.type === 'warning' ? 'increasing' : item.type),
                      border: `1px solid ${trendBorder(item.type === 'warning' ? 'increasing' : item.type)}`,
                    }}>
                      <TrendRowIcon type={item.type} />
                      <Typography sx={{ fontSize: 12.5, color: T.textBody, lineHeight: 1.5 }}>
                        {item.text}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Button size="small" onClick={() => onNavigate?.('prediction')}
                  sx={{ textTransform: 'none', color: T.blue, fontSize: 12, fontWeight: 500, px: 0, '&:hover': { backgroundColor: 'transparent', opacity: 0.7 } }}>
                  View detailed predictions →
                </Button>
                <Button size="small" onClick={() => onNavigate?.('history')}
                  sx={{ textTransform: 'none', color: T.textMuted, fontSize: 12, fontWeight: 500, px: 0, '&:hover': { backgroundColor: 'transparent', opacity: 0.7 } }}>
                  View history
                </Button>
              </Box>
            </CardContent>
          </SCard>

        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
