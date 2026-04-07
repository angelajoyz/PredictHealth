import { forecastAll, getSavedForecast, getDiseaseBreakdown } from './services/api';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Button,
  Alert, LinearProgress, Select, MenuItem as MenuItemComponent,
  CircularProgress, Skeleton, Tooltip,
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
  Lock as LockIcon,
} from '@mui/icons-material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import Sidebar, { T } from './Sidebar';

const ALL_BARANGAYS = '__ALL__';
const FORECAST_MONTHS = 12;

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

const getConfidence = (disease) =>
  ({ dengue_cases:87, respiratory_cases:79, covid_cases:76,
     cardiovascular_cases:83, diabetes_cases:80 })[disease] ?? 78;

// ── Check if forecast is still valid (covers up to Dec of current year) ───────
const isForecastValid = (forecastDates) => {
  if (!forecastDates || forecastDates.length === 0) return false;
  const now        = new Date();
  const endOfYear  = `${now.getFullYear()}-12`;
  const lastDate   = forecastDates[forecastDates.length - 1];
  return lastDate >= endOfYear;
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
        backgroundColor: trendBg(effectiveType),
        border: `1px solid ${trendBorder(effectiveType)}`,
        cursor: canExpand ? 'pointer' : 'default', transition: 'all 0.15s',
        '&:hover': canExpand ? { opacity: 0.88 } : {},
      }}>
        <TrendRowIcon type={item.type} />
        <Typography sx={{ fontSize: 12.5, color: T.textBody, lineHeight: 1.5, flex: 1 }}>
          {item.text}
        </Typography>
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
  const [forecastIsValid,     setForecastIsValid]    = useState(false); // true = locked until Dec
  const [hasData,             setHasData]            = useState(false);
  const [uploadedInfo,        setUploadedInfo]       = useState(null);
  const [forecastHistory,     setForecastHistory]    = useState([]);
  const [diseaseSummary,      setDiseaseSummary]     = useState([]);
  const [totalForecasted,     setTotalForecasted]    = useState(0);
  const [latestForecastMonth, setLatestForecastMonth]= useState('N/A');
  const [hasDbData,           setHasDbData]          = useState(false);
  const [checkingData,        setCheckingData]       = useState(true);

  const [accumulatedChart, setAccumulatedChart] = useState(() => {
    try { const s = localStorage.getItem('cachedChartData'); return s ? JSON.parse(s) : {}; }
    catch { return {}; }
  });

  const cityLabel = localStorage.getItem('datasetCity') || '';

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
        setHasSavedForecasts(data.has_saved_forecasts || false);

        // Check if existing forecast is still valid
        if (data.has_saved_forecasts) {
          try {
            const city = data.city || localStorage.getItem('datasetCity') || '';
            const saved = await getSavedForecast(ALL_BARANGAYS, city);
            if (saved) {
              setForecastIsValid(isForecastValid(saved.forecast_dates));
            }
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

  // Auto-fetch saved forecast when barangay changes
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
    const dates = forecastData.forecast_dates || [];
    const now   = new Date();
    const currentMonthKey = now.toISOString().slice(0, 7);
    const nextMonthKey    = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 7);
    let currentIdx = dates.findIndex(d => d.slice(0, 7) === currentMonthKey);
    let nextIdx    = dates.findIndex(d => d.slice(0, 7) === nextMonthKey);
    if (currentIdx < 0) currentIdx = 0;
    if (nextIdx < 0)    nextIdx    = Math.min(1, dates.length - 1);
    const sumAt = (idx) => {
      if (idx < 0 || idx >= dates.length) return 0;
      return activeDiseases.reduce((s, d) => s + ((forecastData.predictions[d] || [])[idx] ?? 0), 0);
    };
    const currentFinal = Math.round(sumAt(currentIdx));
    const nextFinal    = Math.round(sumAt(nextIdx));
    const diff  = nextFinal - currentFinal;
    const pct   = (diff / (currentFinal || 1)) * 100;
    const trend = diff > 0.5 ? 'increasing' : diff < -0.5 ? 'decreasing' : 'stable';
    return {
      currentVal:   currentFinal, nextVal: nextFinal, trend,
      pct:          (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%',
      currentMonth: dates[currentIdx]?.slice(0, 7) || currentMonthKey,
      nextMonth:    dates[nextIdx]?.slice(0, 7)    || nextMonthKey,
      periodLabel:  dates.length ? `${dates[0]?.slice(0, 7)} – ${dates[dates.length - 1]?.slice(0, 7)}` : '',
    };
  };

  const buildChartData = () => {
    const now             = new Date();
    const currentMonthKey = now.toISOString().slice(0, 7);
    const endOfYear       = `${now.getFullYear()}-12`;
    const inRange         = (month) => month >= currentMonthKey && month <= endOfYear;

    if (forecastData && selectedDisease !== 'all' && activeDiseases.length > 0) {
      return (forecastData.forecast_dates || [])
        .filter(date => inRange(date.slice(0, 7)))
        .map(date => {
          const origIdx = (forecastData.forecast_dates || []).indexOf(date);
          return {
            month:     date.slice(0, 7),
            predicted: Math.round((forecastData.predictions[selectedDisease] || [])[origIdx] ?? 0),
          };
        });
    }

    if (forecastData && selectedDisease === 'all' && activeDiseases.length > 0) {
      const freshMap = {};
      (forecastData.forecast_dates || []).forEach((date, i) => {
        const month = date.slice(0, 7);
        if (!inRange(month)) return;
        let total = 0;
        activeDiseases.forEach(d => { total += (forecastData.predictions[d] || [])[i] || 0; });
        freshMap[month] = Math.round(total);
      });
      const merged = { ...accumulatedChart, ...freshMap };
      return Object.entries(merged)
        .filter(([month]) => inRange(month))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, predicted]) => ({ month, predicted }));
    }

    return Object.entries(accumulatedChart)
      .filter(([month]) => inRange(month))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, predicted]) => ({ month, predicted }));
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

  const handleGenerateAll = async () => {
    if (!hasDbData || availableBarangays.length === 0) {
      setForecastError('No dataset found. Please upload in Data Import first.');
      return;
    }
    // Block if forecast is still valid
    if (forecastIsValid) return;

    setForecastLoading(true);
    setForecastError('');
    setGenerateAllProgress({ completed: 0, total: availableBarangays.length });
    try {
      const city   = localStorage.getItem('datasetCity') || '';
      const result = await forecastAll(availableDiseases, FORECAST_MONTHS, city);
      setHasSavedForecasts(true);
      setGenerateAllProgress({ completed: result.completed, total: result.total });
      const saved = await getSavedForecast(selectedBarangay, city);
      if (saved) {
        setForecastData(saved);
        setForecastIsValid(isForecastValid(saved.forecast_dates));
        const diseases = saved.disease_columns || Object.keys(saved.predictions || {});
        setAccumulatedChart(prev => {
          const updated = { ...prev };
          (saved.forecast_dates || []).forEach((date, i) => {
            const month = date.slice(0, 7);
            let total = 0;
            diseases.forEach(d => { total += (saved.predictions[d] || [])[i] || 0; });
            updated[month] = Math.round(total);
          });
          return updated;
        });
      }
      if (result.failed > 0)
        setForecastError(`Done! ${result.completed}/${result.total} barangays completed. ${result.failed} failed.`);
    } catch (err) {
      setForecastError(err.message || 'Generate All failed. Please try again.');
    } finally {
      setForecastLoading(false);
      setTimeout(() => setGenerateAllProgress(null), 4000);
    }
  };

  const stats      = getSummaryStats();
  const chartData  = buildChartData();
  const trendItems = buildTrendSummary();
  const currentMonth   = new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const nextMonthDate  = new Date(); nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const nextMonthLabel = nextMonthDate.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const thisMonthKey   = new Date().toISOString().slice(0, 7);
  const totalThisMonth = forecastHistory.filter(h => h.period === thisMonthKey).reduce((s, h) => s + (h.predictedValue || 0), 0);
  const chartColor     = selectedDisease !== 'all' && CATEGORY_MAP[selectedDisease]
    ? CATEGORY_MAP[selectedDisease].color : T.blue;

  const forecastPeriodLabel = (() => {
    if (stats?.periodLabel) return stats.periodLabel;
    if (forecastData?.forecast_dates?.length) {
      const dates = forecastData.forecast_dates;
      return `${dates[0]} – ${dates[dates.length - 1]}`;
    }
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + FORECAST_MONTHS, 1);
    return `${start.toISOString().slice(0, 7)} – ${end.toISOString().slice(0, 7)}`;
  })();

  // Button state
  const now        = new Date();
  const endOfYear  = `${now.getFullYear()}-12`;
  const buttonLocked   = forecastIsValid && hasSavedForecasts;
  const buttonDisabled = forecastLoading || !hasDbData || buttonLocked;
  const buttonLabel = forecastLoading
    ? 'Generating…'
    : buttonLocked
      ? `Generate All`
      : hasSavedForecasts ? 'Generate All' : 'Generate All';
  const buttonTooltip = buttonLocked
    ? `Forecast is valid until December ${now.getFullYear()}. You can generate again in January ${now.getFullYear() + 1}.`
    : !hasDbData
      ? 'Upload a dataset first'
      : 'Generate 12-month forecast for all barangays';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: T.pageBg }}>
      <Sidebar currentPage="dashboard" onNavigate={onNavigate} onLogout={onLogout} />
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
              <Typography component="span" onClick={() => onNavigate?.('dataimport')}
                sx={{ fontWeight: 600, fontSize: 13, cursor: 'pointer', color: T.blue,
                  '&:hover': { opacity: 0.75 }, display: 'inline' }}>
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
                <Tooltip title={buttonTooltip} placement="top">
                  <span style={{ marginLeft: 'auto' }}>
                    <Button
                      variant="contained"
                      onClick={handleGenerateAll}
                      disabled={buttonDisabled}
                      startIcon={forecastLoading
                        ? <CircularProgress size={13} color="inherit" />
                        : buttonLocked
                          ? <LockIcon sx={{ fontSize: 15 }} />
                          : <PsychologyIcon sx={{ fontSize: 15 }} />}
                      sx={{
                        textTransform: 'none', fontWeight: 600, fontSize: 13, borderRadius: '8px',
                        px: 2.5, py: '7px',
                        backgroundColor: buttonLocked ? T.borderSoft : T.blue,
                        color: buttonLocked ? T.textMuted : '#fff',
                        boxShadow: buttonLocked ? 'none' : '0 2px 8px rgba(37,99,235,0.2)',
                        '&:hover': { backgroundColor: buttonLocked ? T.borderSoft : T.blueMid },
                        '&:disabled': { opacity: buttonLocked ? 1 : 0.5,
                          backgroundColor: buttonLocked ? T.borderSoft : undefined,
                          color: buttonLocked ? T.textMuted : undefined },
                      }}>
                      {buttonLabel}
                    </Button>
                  </span>
                </Tooltip>
              </Box>

              {/* Status hint below controls */}
              <Box sx={{ mt: 1.5, px: '2px' }}>
                {!hasSavedForecasts && hasDbData && (
                  <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
                    💡 Click <strong>Generate All</strong> to train 12-month forecasts for all {availableBarangays.length} barangays.
                  </Typography>
                )}
                {hasSavedForecasts && forecastIsValid && (
                  <Typography sx={{ fontSize: 11.5, color: T.ok }}>
                    ✅ Forecasts are valid until <strong>December {now.getFullYear()}</strong>.
                    Generation will be available again in <strong>January {now.getFullYear() + 1}</strong>.
                  </Typography>
                )}
                {hasSavedForecasts && !forecastIsValid && (
                  <Typography sx={{ fontSize: 11.5, color: T.warn }}>
                    ⚠️ Forecast period has ended. Click <strong>Generate All</strong> to generate forecasts for {now.getFullYear()}.
                  </Typography>
                )}
              </Box>
            </CardContent>
          </SCard>

          {forecastLoading && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress sx={{ borderRadius: 2, height: 3, backgroundColor: T.borderSoft,
                '& .MuiLinearProgress-bar': { backgroundColor: T.blue } }} />
              <Typography sx={{ fontSize: 11, color: T.textMuted, mt: 0.75, textAlign: 'center' }}>
                Training all barangays… this may take several minutes
              </Typography>
            </Box>
          )}

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
                <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 0.25 }}>{currentMonth}</Typography>
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
                <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 0.25 }}>
                  {stats?.nextMonth
                    ? new Date(stats.nextMonth + '-01').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
                    : nextMonthLabel}
                </Typography>
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
                  12{' '}
                  <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color: T.textMuted }}>Months</Typography>
                </Typography>
                <Typography sx={{ fontSize: 10.5, color: T.textFaint, mt: 0.5 }}>
                  {forecastPeriodLabel}
                </Typography>
              </CardContent>
            </SCard>
          </Box>

          {/* Chart */}
          <SCard sx={{ mb: '14px' }}>
            <CardContent sx={{ p: '18px 20px 14px', '&:last-child': { pb: '14px' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>
                  Predicted Patient Volume
                </Typography>
                {selectedDisease !== 'all' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75,
                    px: '10px', py: '3px', borderRadius: '20px',
                    backgroundColor: `${chartColor}18`, border: `1px solid ${chartColor}40` }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: chartColor }} />
                    <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: chartColor }}>
                      {getDiseaseInfo(selectedDisease).label}
                    </Typography>
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
                    <Line type="monotone" dataKey="predicted" name="Predicted"
                      stroke={chartColor} strokeWidth={2} strokeDasharray="5 3"
                      dot={{ fill: chartColor, r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 4, fill: chartColor, stroke: '#fff', strokeWidth: 2 }}
                      connectNulls={true} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}>
                  <Typography sx={{ fontSize: 13, color: T.textMuted }}>
                    {hasSavedForecasts ? 'Select a barangay to view its forecast' : 'Click Generate All to create forecasts for all barangays'}
                  </Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 2, borderRadius: 1, backgroundColor: chartColor }} />
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
                    <ResultRow
                      key={`${selectedBarangay}-${item.disease || 'warning'}-${i}`}
                      item={item}
                      forecastData={forecastData}
                      selectedBarangay={selectedBarangay}
                    />
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