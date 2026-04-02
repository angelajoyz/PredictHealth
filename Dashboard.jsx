import { forecastFromDb, getDiseaseBreakdown } from './services/api';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Button,
  Alert, LinearProgress, Select, MenuItem as MenuItemComponent,
  CircularProgress, Skeleton,
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
  BarChart as BarChartIcon,
} from '@mui/icons-material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import Sidebar, { T } from './Sidebar';

const ALL_BARANGAYS = '__ALL__';

// ── Disease category config ────────────────────────────────────────────────────
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

// ── Disease Breakdown Section ──────────────────────────────────────────────────
const DiseaseBreakdownSection = ({ selectedBarangay, forecastData, activeDiseases }) => {
  const [breakdowns,  setBreakdowns]  = useState({});
  const [loadingCats, setLoadingCats] = useState({});
  const [expandedCat, setExpandedCat] = useState(null);
  const city = localStorage.getItem('datasetCity') || '';

  const forecastedCategories = activeDiseases
    .map(d => ({
      col:   d,
      info:  getDiseaseInfo(d),
      preds: forecastData?.predictions?.[d] || [],
      trend: getTrend(forecastData?.predictions?.[d] || []),
      total: (forecastData?.predictions?.[d] || []).reduce((s, v) => s + v, 0),
    }))
    .sort((a, b) => b.total - a.total);

  const fetchBreakdown = useCallback(async (categoryCol) => {
    const catKey = categoryCol.replace('_cases', '');
    if (breakdowns[catKey] || loadingCats[catKey]) return;
    setLoadingCats(prev => ({ ...prev, [catKey]: true }));
    try {
      const data = await getDiseaseBreakdown(catKey, selectedBarangay, city, 6);
      setBreakdowns(prev => ({ ...prev, [catKey]: data }));
    } catch (e) {
      console.error('Breakdown fetch failed:', e);
      setBreakdowns(prev => ({ ...prev, [catKey]: { breakdown: [], monthly_trend: [] } }));
    } finally {
      setLoadingCats(prev => ({ ...prev, [catKey]: false }));
    }
  }, [selectedBarangay, city, breakdowns, loadingCats]);

  const handleExpand = (categoryCol) => {
    const catKey = categoryCol.replace('_cases', '');
    if (expandedCat === catKey) { setExpandedCat(null); return; }
    setExpandedCat(catKey);
    fetchBreakdown(categoryCol);
  };

  if (!forecastData || forecastedCategories.length === 0) return null;

  return (
    <SCard sx={{ mt: '14px' }}>
      <CardContent sx={{ p: '18px 20px', '&:last-child': { pb: '20px' } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BarChartIcon sx={{ fontSize: 16, color: T.blue }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>
              Disease Breakdown by Category
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
            Click a category to see specific diseases
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {forecastedCategories.map(({ col, info, preds, trend }) => {
            const catKey    = col.replace('_cases', '');
            const isOpen    = expandedCat === catKey;
            const isLoading = loadingCats[catKey];
            const data      = breakdowns[catKey];
            const nextVal   = Math.round(preds[0] ?? 0);

            return (
              <Box key={col}>
                {/* Category header row */}
                <Box
                  onClick={() => handleExpand(col)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    p: '10px 14px',
                    borderRadius: isOpen ? '8px 8px 0 0' : '8px',
                    backgroundColor: isOpen ? trendBg(trend) : T.pageBg,
                    border: `1px solid ${isOpen ? trendBorder(trend) : T.borderSoft}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                    '&:hover': { backgroundColor: trendBg(trend), borderColor: trendBorder(trend) },
                  }}
                >
                  <Box sx={{ fontSize: 16, flexShrink: 0 }}>{info.icon}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.textHead, lineHeight: 1.2 }}>
                      {info.label}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: T.textMuted, mt: 0.25 }}>
                      {nextVal.toLocaleString()} projected next month
                    </Typography>
                  </Box>
                  <Box sx={{
                    px: '8px', py: '3px', borderRadius: '20px', flexShrink: 0,
                    backgroundColor: trendBg(trend), border: `1px solid ${trendBorder(trend)}`,
                  }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: trendColor(trend) }}>
                      {trend === 'increasing' ? '↑ Rising' : trend === 'decreasing' ? '↓ Falling' : '— Stable'}
                    </Typography>
                  </Box>
                  <ExpandMoreIcon sx={{
                    fontSize: 18, color: T.textMuted, flexShrink: 0,
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }} />
                </Box>

                {/* Expanded panel */}
                {isOpen && (
                  <Box sx={{
                    borderRadius: '0 0 8px 8px',
                    border: `1px solid ${trendBorder(trend)}`,
                    borderTop: 'none',
                    backgroundColor: '#FAFBFC',
                  }}>
                    {isLoading ? (
                      <Box sx={{ p: '14px 16px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {[1,2,3].map(i => <Skeleton key={i} variant="rectangular" height={34} sx={{ borderRadius: '6px' }} />)}
                      </Box>
                    ) : data?.breakdown?.length > 0 ? (
                      <Box sx={{ p: '14px 16px' }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 600, color: T.textFaint,
                          textTransform: 'uppercase', letterSpacing: '0.5px', mb: 1.5 }}>
                          Top specific diseases — {info.label}
                        </Typography>

                        {/* Disease bars */}
                        {data.breakdown.map((item, idx) => {
                          const maxCases = data.breakdown[0]?.total_cases || 1;
                          const pct = Math.round((item.total_cases / maxCases) * 100);
                          const barColors = [info.color, '#60A5FA', '#34D399', '#FBBF24', '#A78BFA'];
                          const barColor  = barColors[idx] || info.color;
                          return (
                            <Box key={idx} sx={{ mb: 1.25 }}>
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography sx={{
                                  fontSize: 12, fontWeight: idx === 0 ? 600 : 400,
                                  color: idx === 0 ? T.textHead : T.textBody,
                                  flex: 1, mr: 1, lineHeight: 1.4,
                                }}>
                                  {idx === 0 ? '★ ' : ''}{item.label}
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
                                <Box sx={{
                                  height: '100%', borderRadius: 3,
                                  width: `${pct}%`, backgroundColor: barColor,
                                  transition: 'width 0.45s ease',
                                }} />
                              </Box>
                            </Box>
                          );
                        })}

                        {/* Mini trend chart */}
                        {data.monthly_trend?.length > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T.textFaint,
                              textTransform: 'uppercase', letterSpacing: '0.5px', mb: 1 }}>
                              Historical trend — {data.breakdown[0]?.label}
                            </Typography>
                            <ResponsiveContainer width="100%" height={80}>
                              <LineChart data={data.monthly_trend}
                                margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                                <XAxis dataKey="period" axisLine={false} tickLine={false}
                                  tick={{ fontSize: 9, fill: T.textFaint }}
                                  tickFormatter={v => v.slice(5)} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: T.textFaint }} />
                                <RechartsTooltip contentStyle={{ ...tooltipStyle, fontSize: 11 }} />
                                <Line type="monotone" dataKey="cases" stroke={info.color}
                                  strokeWidth={2} dot={false} activeDot={{ r: 3, fill: info.color }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </Box>
                        )}

                        {/* Insight note */}
                        {data.breakdown[0] && (
                          <Box sx={{ mt: 1.5, p: '8px 12px', borderRadius: '6px',
                            backgroundColor: trendBg(trend), border: `1px solid ${trendBorder(trend)}` }}>
                            <Typography sx={{ fontSize: 12, lineHeight: 1.55,
                              color: trendColor(trend) === T.textMuted ? T.textBody : trendColor(trend) }}>
                              <strong>{data.breakdown[0].label}</strong> has the highest recorded cases
                              in the <strong>{info.label}</strong> category
                              {selectedBarangay !== ALL_BARANGAYS ? ` in ${selectedBarangay}` : ''}.
                              {trend === 'increasing' && ' Monitor this closely — category trend is rising.'}
                              {trend === 'decreasing' && ' Category trend is declining — maintain interventions.'}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    ) : (
                      <Box sx={{ p: '14px 16px', textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>
                          No specific disease breakdown available.
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </SCard>
  );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────────
const Dashboard = ({ onNavigate, onLogout }) => {
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
  const [hasData,            setHasData]            = useState(false);
  const [uploadedInfo,       setUploadedInfo]       = useState(null);
  const [forecastHistory,    setForecastHistory]    = useState([]);
  const [diseaseSummary,     setDiseaseSummary]     = useState([]);
  const [miniTrendData,      setMiniTrendData]      = useState([]);
  const [totalForecasted,    setTotalForecasted]    = useState(0);
  const [latestForecastMonth,setLatestForecastMonth]= useState('N/A');
  const [hasDbData,          setHasDbData]          = useState(false);

  const cityLabel = localStorage.getItem('datasetCity') || '';

  useEffect(() => {
    try {
      const up = localStorage.getItem('uploadedData');
      if (up) setUploadedInfo(JSON.parse(up));
      const bar = localStorage.getItem('availableBarangays');
      if (bar) { const p = JSON.parse(bar); if (Array.isArray(p) && p.length > 0) { setAvailableBarangays(p); setHasDbData(true); } }
      const dis = localStorage.getItem('diseaseColumns');
      if (dis) setAvailableDiseases(JSON.parse(dis));
      const raw = localStorage.getItem('forecastHistory');
      if (raw) { const h = JSON.parse(raw); setForecastHistory(h); setHasData(h.length > 0); computeInsights(h); }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { if (selectedBarangay) localStorage.setItem('cachedForecastBarangay', selectedBarangay); }, [selectedBarangay]);
  useEffect(() => { localStorage.setItem('cachedForecastHorizon', forecastHorizon); }, [forecastHorizon]);
  useEffect(() => { localStorage.setItem('cachedForecastDisease', selectedDisease); }, [selectedDisease]);
  useEffect(() => { if (forecastData) { try { localStorage.setItem('cachedForecastData', JSON.stringify(forecastData)); } catch {} } }, [forecastData]);

  const computeInsights = (history) => {
    if (!history?.length) return;
    const periods = history.map(h => h.period).filter(Boolean).sort();
    const latest  = periods[periods.length - 1] || 'N/A';
    setLatestForecastMonth(latest);
    setTotalForecasted(history.filter(h => h.period === latest).reduce((s, h) => s + (h.predictedValue || 0), 0));
    const dMap = {};
    history.forEach(item => {
      if (!dMap[item.disease]) dMap[item.disease] = { disease: item.disease, label: item.label || getDiseaseInfo(item.disease).label, info: getDiseaseInfo(item.disease), values: [], trend: 'stable', latestValue: 0, confidence: 78 };
      dMap[item.disease].values.push(item.predictedValue || 0);
      if (!dMap[item.disease].latestPeriod || item.period > dMap[item.disease].latestPeriod) {
        Object.assign(dMap[item.disease], { latestPeriod: item.period, latestValue: item.predictedValue || 0, trend: item.trend || 'stable', confidence: item.confidence || 78 });
      }
    });
    setDiseaseSummary(Object.values(dMap));
    const pMap = {};
    history.forEach(item => { pMap[item.period] = (pMap[item.period] || 0) + (item.predictedValue || 0); });
    setMiniTrendData(Object.entries(pMap).sort(([a],[b]) => a.localeCompare(b)).slice(-6).map(([p,c]) => ({ month: p.slice(0,7), cases: Math.round(c) })));
  };

  const activeDiseases = forecastData
    ? (selectedDisease === 'all' ? Object.keys(forecastData.predictions) : [selectedDisease].filter(d => forecastData.predictions?.[d]))
    : [];

const getSummaryStats = () => {
  if (!forecastData || activeDiseases.length === 0) return null;

  const now = new Date();
  const currentMonthKey = now.toISOString().slice(0, 7);
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthKey = nextMonthDate.toISOString().slice(0, 7);

  const dates = forecastData.forecast_dates || [];

  // ── ADD THIS ──
  console.log('forecast_dates:', dates);
  console.log('currentMonthKey:', currentMonthKey);
  console.log('nextMonthKey:', nextMonthKey);

  const currentIdx = dates.findIndex(d => d.slice(0, 7) === currentMonthKey);
  const nextIdx    = dates.findIndex(d => d.slice(0, 7) === nextMonthKey);

  console.log('currentIdx:', currentIdx, 'nextIdx:', nextIdx);

  const sumAt = (idx) => {
    if (idx < 0) return null;
    return activeDiseases.reduce((s, d) => s + ((forecastData.predictions[d] || [])[idx] ?? 0), 0);
  };

  const currentVal = sumAt(currentIdx);
  const nextVal    = sumAt(nextIdx);

  console.log('currentVal:', currentVal, 'nextVal:', nextVal);

  const currentFinal = currentVal !== null ? Math.round(currentVal) : Math.round(sumAt(0) ?? 0);
  const nextFinal    = nextVal    !== null ? Math.round(nextVal)    : Math.round(sumAt(1) ?? sumAt(0) ?? 0);

  const diff = nextFinal - currentFinal;
  const pct  = ((diff) / (currentFinal || 1)) * 100;
  const trend = diff > 0.5 ? 'increasing' : diff < -0.5 ? 'decreasing' : 'stable';
  const pctStr = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';

  const confidence = Math.round(
    activeDiseases.reduce((s, d) => s + getConfidence(d), 0) / activeDiseases.length
  );

  return {
    currentVal:  currentFinal,
    nextVal:     nextFinal,
    trend,
    pct:         pctStr,
    confidence,
    currentMonth: currentMonthKey,
    nextMonth:    nextMonthKey,
    periodLabel:  dates.length
      ? `${dates[0]?.slice(0, 7)} – ${dates[dates.length - 1]?.slice(0, 7)}`
      : '',
  };
};

  const buildChartData = () => {
    if (!forecastData) return miniTrendData.map(d => ({ month: d.month, actual: d.cases, predicted: null }));
    const data = [];
    const histDates = forecastData.historical_data?.dates?.slice(-6) || [];
    histDates.forEach((date, i) => { let total = 0; activeDiseases.forEach(d => { total += (forecastData.historical_data[d]||[]).slice(-6)[i]||0; }); data.push({ month: date.slice(0,7), actual: Math.round(total), predicted: null }); });
    forecastData.forecast_dates?.forEach((date, i) => { let total = 0; activeDiseases.forEach(d => { total += (forecastData.predictions[d]||[])[i]||0; }); data.push({ month: date.slice(0,7), actual: null, predicted: Math.round(total) }); });
    return data;
  };

  const buildTrendSummary = () => {
    const sourceData = forecastData
      ? activeDiseases.map(d => ({ disease: d, label: getDiseaseInfo(d).label, trend: getTrend(forecastData.predictions?.[d]||[]), pct: (() => { const p = forecastData.predictions?.[d]||[]; if (p.length<2) return '0%'; const pct=((p[p.length-1]-p[0])/(p[0]||1))*100; return (pct>=0?'+':'')+pct.toFixed(1)+'%'; })() }))
      : (selectedDisease === 'all' ? diseaseSummary : diseaseSummary.filter(d => d.disease === selectedDisease));
    if (!sourceData.length) return [];
    const filtered = selectedDisease === 'all' ? sourceData : sourceData.filter(d => d.disease === selectedDisease);
    const items = [];
    filtered.forEach(d => {
      const loc = selectedBarangay === ALL_BARANGAYS ? 'all barangays' : selectedBarangay;
      if (d.trend === 'increasing') items.push({ type: 'increasing', disease: d.disease, text: `${d.label} cases are projected to increase${d.pct ? ' by '+d.pct : ''} in ${loc} — increased monitoring recommended.` });
      else if (d.trend === 'decreasing') items.push({ type: 'decreasing', disease: d.disease, text: `${d.label} cases are projected to decline${d.pct ? ' by '+d.pct : ''} in ${loc} — positive outlook.` });
      else items.push({ type: 'stable', disease: d.disease, text: `${d.label} cases are expected to remain stable in ${loc}.` });
    });
    const increasing = filtered.filter(d => d.trend === 'increasing');
    if (selectedDisease === 'all' && increasing.length >= 2) items.unshift({ type: 'warning', text: `${increasing.length} disease categories are trending upward simultaneously — consider prioritizing resources.` });
    return items;
  };

  const handleGenerateForecast = async () => {
    if (!hasDbData || availableBarangays.length === 0) { setForecastError('No dataset found. Please upload in Data Import first.'); return; }
    if (availableDiseases.length === 0) { setForecastError('No disease columns found. Please re-upload your dataset.'); return; }
    setForecastLoading(true); setForecastError('');
    try {
      const months  = parseInt(forecastHorizon);
      const city    = localStorage.getItem('datasetCity') || '';
      const result  = await forecastFromDb(selectedBarangay, availableDiseases, months, city);
      setForecastData(result); setDisplayedBarangay(selectedBarangay); setDisplayedHorizon(forecastHorizon);
      if (result.disease_columns?.length > 0) { setAvailableDiseases(prev => { const m = Array.from(new Set([...prev,...result.disease_columns])); localStorage.setItem('diseaseColumns',JSON.stringify(m)); return m; }); }
      const now = new Date(); const dateStr = now.toISOString().slice(0,10)+' at '+now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
      const newEntries = Object.keys(result.predictions).flatMap((disease,idx) => { const preds=result.predictions[disease]||[]; return result.forecast_dates.map((fd,i) => ({ id:Date.now()+idx*100+i,disease,label:getDiseaseInfo(disease).label,period:fd.slice(0,7),monthsAhead:i+1,predictedValue:Math.round(preds[i]??0),trend:getTrend(preds),confidence:getConfidence(disease),status:'Completed',createdAt:dateStr,fileName:uploadedInfo?.fileName||'dataset',forecastHorizon:months+' Month'+(months>1?'s':''),barangay:selectedBarangay,city:result.city||city })); });
      const updatedHistory = [...newEntries,...forecastHistory]; setForecastHistory(updatedHistory); setHasData(true); computeInsights(updatedHistory); localStorage.setItem('forecastHistory',JSON.stringify(updatedHistory));
    } catch (err) { setForecastError(err.message||'Forecast failed. Please try again.'); }
    finally { setForecastLoading(false); }
  };

  const stats      = getSummaryStats();
  const chartData  = buildChartData();
  const trendItems = buildTrendSummary();
  const isStale    = forecastData && displayedBarangay && (displayedBarangay !== selectedBarangay || displayedHorizon !== forecastHorizon);
  const isUpToDate = forecastData && displayedBarangay && displayedBarangay === selectedBarangay && displayedHorizon === forecastHorizon;
  const currentMonth   = new Date().toLocaleDateString('en-PH', { month:'long', year:'numeric' });
  const nextMonthDate  = new Date(); nextMonthDate.setMonth(nextMonthDate.getMonth()+1);
  const nextMonthLabel = nextMonthDate.toLocaleDateString('en-PH', { month:'long', year:'numeric' });
  const thisMonthKey   = new Date().toISOString().slice(0,7);
  const totalThisMonth = forecastHistory.filter(h=>h.period===thisMonthKey).reduce((s,h)=>s+(h.predictedValue||0),0);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: T.pageBg }}>
      <Sidebar currentPage="dashboard" onNavigate={onNavigate} onLogout={onLogout} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        <Box sx={{ px:'24px', minHeight:64, display:'flex', alignItems:'center', backgroundColor:'#FFFFFF', position:'sticky', top:0, zIndex:10, flexShrink:0 }}>
          <Typography sx={{ fontSize:16, fontWeight:700, color:T.textHead, letterSpacing:'-0.2px' }}>Barangay Health Dashboard</Typography>
        </Box>

        <Box sx={{ px:'24px', pt:'20px', pb:'28px', overflow:'auto', flex:1 }}>

          {!hasDbData && (
            <Alert severity="info" icon={<InfoOutlinedIcon fontSize="small" />}
              sx={{ mb:2.5, borderRadius:'10px', backgroundColor:T.blueDim, color:T.textHead, border:`1px solid rgba(37,99,235,0.18)`, fontSize:13, '& .MuiAlert-icon':{ color:T.blue } }}>
              <strong>No dataset found.</strong>{' '}
              <Typography component="span" onClick={() => onNavigate?.('dataimport')}
                sx={{ fontWeight:600, fontSize:13, cursor:'pointer', color:T.blue, '&:hover':{ opacity:0.75 }, display:'inline' }}>
                Upload your health dataset →
              </Typography>
            </Alert>
          )}

          {/* Controls */}
          <SCard sx={{ mb:'14px' }}>
            <CardContent sx={{ p:'14px 16px', '&:last-child':{ pb:'14px' } }}>
              <Box sx={{ display:'flex', alignItems:'center', gap:2, flexWrap:'wrap' }}>
                <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                  <Typography sx={{ fontSize:12, color:T.textMuted, fontWeight:500, whiteSpace:'nowrap' }}>Barangay:</Typography>
                  <Select value={selectedBarangay} size="small" sx={{ ...SelectSx, minWidth:150 }} displayEmpty onChange={(e) => setSelectedBarangay(e.target.value)}>
                    <MenuItemComponent value={ALL_BARANGAYS} sx={{ fontSize:13 }}>All Barangays</MenuItemComponent>
                    {availableBarangays.map(b => <MenuItemComponent key={b} value={b} sx={{ fontSize:13 }}>{b}</MenuItemComponent>)}
                  </Select>
                </Box>
                <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                  <Typography sx={{ fontSize:12, color:T.textMuted, fontWeight:500, whiteSpace:'nowrap' }}>Disease:</Typography>
                  <Select value={selectedDisease} size="small" sx={{ ...SelectSx, minWidth:140 }} onChange={(e) => setSelectedDisease(e.target.value)}>
                    <MenuItemComponent value="all" sx={{ fontSize:13 }}>All Categories</MenuItemComponent>
                    {availableDiseases.map(col => <MenuItemComponent key={col} value={col} sx={{ fontSize:13 }}>{getDiseaseInfo(col).label}</MenuItemComponent>)}
                  </Select>
                </Box>
                <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                  <Typography sx={{ fontSize:12, color:T.textMuted, fontWeight:500, whiteSpace:'nowrap' }}>Horizon:</Typography>
                  <Select value={forecastHorizon} size="small" sx={{ ...SelectSx, minWidth:130 }} onChange={(e) => setForecastHorizon(e.target.value)}>
                    <MenuItemComponent value="1" sx={{ fontSize:13 }}>1 Month</MenuItemComponent>
                    <MenuItemComponent value="3" sx={{ fontSize:13 }}>3 Months</MenuItemComponent>
                    <MenuItemComponent value="6" sx={{ fontSize:13 }}>6 Months</MenuItemComponent>
                  </Select>
                </Box>
                <Button variant="contained" onClick={handleGenerateForecast} disabled={forecastLoading||!hasDbData}
                  startIcon={forecastLoading ? <CircularProgress size={13} color="inherit" /> : <PsychologyIcon sx={{ fontSize:15 }} />}
                  sx={{ ml:'auto', textTransform:'none', fontWeight:600, fontSize:13, borderRadius:'8px', px:2.5, py:'7px', backgroundColor:T.blue, color:'#fff', boxShadow:'0 2px 8px rgba(37,99,235,0.2)', '&:hover':{ backgroundColor:T.blueMid }, '&:disabled':{ opacity:0.5 } }}>
                  {forecastLoading ? 'Generating…' : 'Generate Forecast'}
                </Button>
              </Box>
            </CardContent>
          </SCard>

          {forecastLoading && (
            <Box sx={{ mb:2 }}>
              <LinearProgress sx={{ borderRadius:2, height:3, backgroundColor:T.borderSoft, '& .MuiLinearProgress-bar':{ backgroundColor:T.blue } }} />
              <Typography sx={{ fontSize:11, color:T.textMuted, mt:0.75, textAlign:'center' }}>
                Training LSTM model for {selectedBarangay === ALL_BARANGAYS ? 'all barangays' : selectedBarangay}… (30–90 seconds)
              </Typography>
            </Box>
          )}

          {forecastError && <Alert severity="error" sx={{ mb:2, borderRadius:'10px', fontSize:13 }}>{forecastError}</Alert>}

          {isStale && (
            <Box sx={{ display:'flex', alignItems:'center', px:2, py:1.25, mb:'14px', borderRadius:'8px', backgroundColor:T.warnBg, border:`1px solid ${T.warnBorder}` }}>
              <InfoOutlinedIcon sx={{ fontSize:14, color:T.warn, mr:1, flexShrink:0 }} />
              <Typography sx={{ fontSize:12.5, color:T.textBody }}>Showing old forecast — click <strong>Generate Forecast</strong> to update.</Typography>
            </Box>
          )}
          {isUpToDate && (
            <Box sx={{ display:'flex', alignItems:'center', gap:1, px:2, py:1.25, mb:'14px', borderRadius:'8px', backgroundColor:T.okBg, border:`1px solid ${T.okBorder}` }}>
              <CheckCircleIcon sx={{ fontSize:14, color:T.ok }} />
              <Typography sx={{ fontSize:12.5, color:T.textBody }}>Forecast ready for <strong>{displayedBarangay === ALL_BARANGAYS ? 'All Barangays' : displayedBarangay}</strong> · {displayedHorizon} months ahead</Typography>
            </Box>
          )}

          {/* Stat cards */}
          <Box sx={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'12px', mb:'14px' }}>
            <SCard sx={{ borderTop:`3px solid ${T.blue}` }}>
              <CardContent sx={{ p:'16px', '&:last-child':{ pb:'16px' } }}>
                <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', mb:1.25 }}>
                  <Typography sx={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.6px', color:T.textFaint }}>Location</Typography>
                  <Box sx={{ width:28, height:28, borderRadius:'6px', backgroundColor:T.blueDim, display:'flex', alignItems:'center', justifyContent:'center' }}><LocationOnIcon sx={{ fontSize:15, color:T.blue }} /></Box>
                </Box>
                <Typography sx={{ fontSize:14, fontWeight:700, color:T.textHead, lineHeight:1.3 }}>{cityLabel||'—'}</Typography>
                <Typography sx={{ fontSize:12, color:T.textMuted, mt:0.25 }}>{selectedBarangay===ALL_BARANGAYS?'All Barangays':(selectedBarangay||'—')}</Typography>
                <Typography sx={{ fontSize:10.5, color:T.textFaint, mt:0.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{uploadedInfo?.fileName||'No dataset loaded'}</Typography>
              </CardContent>
            </SCard>
            <SCard sx={{ borderTop:`3px solid ${T.blue}` }}>
              <CardContent sx={{ p:'16px', '&:last-child':{ pb:'16px' } }}>
                <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', mb:1.25 }}>
                  <Typography sx={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.6px', color:T.textFaint }}>Total Patients</Typography>
                  <Box sx={{ width:28, height:28, borderRadius:'6px', backgroundColor:T.blueDim, display:'flex', alignItems:'center', justifyContent:'center' }}><GroupIcon sx={{ fontSize:15, color:T.blue }} /></Box>
                </Box>
                <Typography sx={{ fontSize:26, fontWeight:700, color:T.textHead, lineHeight:1, letterSpacing:'-0.5px' }}>{stats ? stats.currentVal.toLocaleString() : hasData ? totalThisMonth.toLocaleString() : '—'}</Typography>
                {stats && <Typography sx={{ fontSize:11.5, color:trendColor(stats.trend), fontWeight:600, mt:0.5 }}>{stats.pct} vs next month</Typography>}
                <Typography sx={{ fontSize:10.5, color:T.textFaint, mt:0.25 }}>{currentMonth}</Typography>
              </CardContent>
            </SCard>
            <SCard sx={{ borderTop:`3px solid ${trendColor(stats?.trend||'stable')}` }}>
              <CardContent sx={{ p:'16px', '&:last-child':{ pb:'16px' } }}>
                <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', mb:1.25 }}>
                  <Typography sx={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.6px', color:T.textFaint }}>Next Month</Typography>
                  <Box sx={{ width:28, height:28, borderRadius:'6px', backgroundColor:trendBg(stats?.trend||'stable'), display:'flex', alignItems:'center', justifyContent:'center' }}><TrendIcon sx={{ fontSize:15, color:trendColor(stats?.trend||'stable') }} /></Box>
                </Box>
                <Typography sx={{ fontSize:26, fontWeight:700, color:T.textHead, lineHeight:1, letterSpacing:'-0.5px' }}>{stats?stats.nextVal.toLocaleString():hasData?totalForecasted.toLocaleString():'—'}</Typography>
                {stats && <Typography sx={{ fontSize:11.5, color:trendColor(stats.trend), fontWeight:600, mt:0.5 }}>{stats.pct} vs current month</Typography>}
                <Typography sx={{ fontSize:10.5, color:T.textFaint, mt:0.25 }}>{stats?.nextMonth ? new Date(stats.nextMonth + '-01').toLocaleDateString('en-PH', { month:'long', year:'numeric' }) : nextMonthLabel}</Typography>

              </CardContent>
            </SCard>
            <SCard sx={{ borderTop:`3px solid ${T.ok}` }}>
              <CardContent sx={{ p:'16px', '&:last-child':{ pb:'16px' } }}>
                <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', mb:1.25 }}>
                  <Typography sx={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.6px', color:T.textFaint }}>Forecast Period</Typography>
                  <Box sx={{ width:28, height:28, borderRadius:'6px', backgroundColor:T.okBg, display:'flex', alignItems:'center', justifyContent:'center' }}><CalendarIcon sx={{ fontSize:15, color:T.ok }} /></Box>
                </Box>
                <Typography sx={{ fontSize:26, fontWeight:700, color:T.textHead, lineHeight:1, letterSpacing:'-0.5px' }}>
                  {forecastHorizon}{' '}<Typography component="span" sx={{ fontSize:14, fontWeight:600, color:T.textMuted }}>{parseInt(forecastHorizon)===1?'Month':'Months'}</Typography>
                </Typography>
                <Typography sx={{ fontSize:10.5, color:T.textFaint, mt:0.5 }}>{stats?.periodLabel||(hasData?`Last: ${latestForecastMonth}`:'No forecasts yet')}</Typography>
              </CardContent>
            </SCard>
          </Box>

          {/* Chart */}
          <SCard sx={{ mb:'14px' }}>
            <CardContent sx={{ p:'18px 20px 14px', '&:last-child':{ pb:'14px' } }}>
              <Typography sx={{ fontSize:13, fontWeight:600, color:T.textHead, mb:2 }}>Predicted Patient Volume</Typography>
              {(hasData||forecastData) && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top:8, right:12, left:-14, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize:10.5, fill:T.textFaint }} />
                    <YAxis axisLine={false} tickLine={false} style={{ fontSize:10.5, fill:T.textFaint }} />
                    <RechartsTooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="actual" name="Actual" stroke={T.ok} strokeWidth={2} dot={{ fill:T.ok, r:3, strokeWidth:0 }} activeDot={{ r:4, fill:T.ok, stroke:'#fff', strokeWidth:2 }} connectNulls={false} />
                    <Line type="monotone" dataKey="predicted" name="Predicted" stroke={T.blue} strokeWidth={2} strokeDasharray="5 3" dot={{ fill:T.blue, r:3, strokeWidth:0 }} activeDot={{ r:4, fill:T.blue, stroke:'#fff', strokeWidth:2 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:220 }}>
                  <Typography sx={{ fontSize:13, color:T.textMuted }}>No chart data yet — generate a forecast to see the trend</Typography>
                </Box>
              )}
              <Box sx={{ display:'flex', justifyContent:'center', gap:2, mt:1.5 }}>
                <Box sx={{ display:'flex', alignItems:'center', gap:0.5 }}><Box sx={{ width:8, height:2, borderRadius:1, backgroundColor:T.ok }} /><Typography sx={{ fontSize:11, color:T.textMuted }}>Actual</Typography></Box>
                <Box sx={{ display:'flex', alignItems:'center', gap:0.5 }}><Box sx={{ width:8, height:2, borderRadius:1, backgroundColor:T.blue }} /><Typography sx={{ fontSize:11, color:T.textMuted }}>Predicted</Typography></Box>
              </Box>
            </CardContent>
          </SCard>

          {/* Results */}
          <SCard>
            <CardContent sx={{ p:'18px 20px', '&:last-child':{ pb:'20px' } }}>
              <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1.75 }}>
                <Typography sx={{ fontSize:13, fontWeight:600, color:T.textHead }}>Results</Typography>
                <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                  <Typography sx={{ fontSize:11.5, color:T.textMuted }}>{selectedDisease==='all'?'All Categories':getDiseaseInfo(selectedDisease).label}</Typography>
                  <Box sx={{ width:3, height:3, borderRadius:'50%', backgroundColor:T.textFaint }} />
                  <Typography sx={{ fontSize:11.5, color:T.textMuted }}>{selectedBarangay===ALL_BARANGAYS?'All Barangays':selectedBarangay}</Typography>
                  <Box sx={{ width:3, height:3, borderRadius:'50%', backgroundColor:T.textFaint }} />
                  <Typography sx={{ fontSize:11.5, color:T.textMuted }}>{forecastHorizon} month{parseInt(forecastHorizon)>1?'s':''}</Typography>
                </Box>
              </Box>
              {trendItems.length === 0 ? (
                <Box sx={{ py:3, textAlign:'center' }}>
                  <Typography sx={{ fontSize:13, color:T.textMuted }}>Generate a forecast to see results</Typography>
                </Box>
              ) : (
                <Box sx={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {trendItems.map((item, i) => (
                    <Box key={i} sx={{ display:'flex', alignItems:'center', gap:1.5, p:'10px 14px', borderRadius:'8px', backgroundColor:trendBg(item.type==='warning'?'increasing':item.type), border:`1px solid ${trendBorder(item.type==='warning'?'increasing':item.type)}` }}>
                      <TrendRowIcon type={item.type} />
                      <Typography sx={{ fontSize:12.5, color:T.textBody, lineHeight:1.5 }}>{item.text}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
              <Box sx={{ mt:2, display:'flex', gap:2 }}>
                <Button size="small" onClick={() => onNavigate?.('prediction')} sx={{ textTransform:'none', color:T.blue, fontSize:12, fontWeight:500, px:0, '&:hover':{ backgroundColor:'transparent', opacity:0.7 } }}>View detailed predictions →</Button>
                <Button size="small" onClick={() => onNavigate?.('history')} sx={{ textTransform:'none', color:T.textMuted, fontSize:12, fontWeight:500, px:0, '&:hover':{ backgroundColor:'transparent', opacity:0.7 } }}>View history</Button>
              </Box>
            </CardContent>
          </SCard>

          {/* ── Disease Breakdown — appears after forecast is generated ── */}
          {forecastData && activeDiseases.length > 0 && (
            <DiseaseBreakdownSection
              selectedBarangay={selectedBarangay}
              forecastData={forecastData}
              activeDiseases={activeDiseases}
            />
          )}

        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;