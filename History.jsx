import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Button,
  Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Select, MenuItem,
  Switch, FormControlLabel, Alert, CircularProgress,
  Tooltip, IconButton,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  LocalHospital as MedicalIcon,
  InfoOutlined as InfoOutlinedIcon,
  Thermostat as ThermostatIcon,
  WaterDrop as WaterDropIcon,
  Air as AirIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  GridOn as GridOnIcon,
  BarChart as BarChartIcon,
  ShowChart as ShowChartIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart,
} from 'recharts';
import Sidebar, { T } from './Sidebar';

// ── Disease config ─────────────────────────────────────────────────────────────
const DISEASE_COLORS = {
  dengue_cases:                T.blue,
  diarrhea_cases:              '#0EA5E9',
  respiratory_cases:           T.danger,
  malnutrition_cases:          T.warnAccent,
  malnutrition_prevalence_pct: '#F59E0B',
  hypertension_cases:          '#8B5CF6',
  diabetes_cases:              '#EC4899',
};

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const getDiseaseInfo = (col) => {
  const map = {
    dengue_cases:                { label: 'Dengue',         icon: '🦟' },
    diarrhea_cases:              { label: 'Diarrhea',       icon: '💧' },
    respiratory_cases:           { label: 'Respiratory',    icon: '🫁' },
    malnutrition_cases:          { label: 'Malnutrition',   icon: '⚕️' },
    malnutrition_prevalence_pct: { label: 'Malnutrition %', icon: '⚕️' },
    hypertension_cases:          { label: 'Hypertension',   icon: '❤️' },
    diabetes_cases:              { label: 'Diabetes',       icon: '🩸' },
  };
  if (map[col]) return map[col];
  const label = col
    .replace(/_cases$/, '')
    .replace(/_prevalence_pct$/, ' %')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
  return { label, icon: '🏥' };
};

const getDiseaseColor = (col) => DISEASE_COLORS[col] || T.neutralBar;

// ── Trend helpers ──────────────────────────────────────────────────────────────
const trendColor  = (t) => t === 'increasing' ? T.danger    : t === 'decreasing' ? T.ok      : T.textMuted;
const trendBg     = (t) => t === 'increasing' ? T.dangerBg  : t === 'decreasing' ? T.okBg    : '#F9FAFB';
const trendBorder = (t) => t === 'increasing' ? T.dangerBorder : t === 'decreasing' ? T.okBorder : T.borderSoft;

const TrendTag = ({ trend }) => {
  const labels = { increasing: '↑ Increasing', decreasing: '↓ Decreasing', stable: '— Stable' };
  return (
    <Chip label={labels[trend] || '— Stable'} size="small" sx={{
      backgroundColor: trendBg(trend), color: trendColor(trend),
      border: `1px solid ${trendBorder(trend)}`,
      fontWeight: 500, fontSize: 10.5, borderRadius: '4px', height: 20,
    }} />
  );
};

// ── Shared sub-components ──────────────────────────────────────────────────────
const SCard = ({ children, sx = {} }) => (
  <Card sx={{ borderRadius: '10px', backgroundColor: T.cardBg, border: `1px solid ${T.border}`, boxShadow: 'none', ...sx }}>
    {children}
  </Card>
);

const CardHead = ({ title, icon, right }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1.5, mb: 1.5, borderBottom: `1px solid ${T.borderSoft}` }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {icon && <Box sx={{ color: T.blue, display: 'flex', alignItems: 'center' }}>{icon}</Box>}
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>{title}</Typography>
    </Box>
    {right}
  </Box>
);

const Tag = ({ label, bg, color, border }) => (
  <Chip label={label} size="small" sx={{
    backgroundColor: bg, color, border: `1px solid ${border}`,
    fontWeight: 500, fontSize: 10.5, borderRadius: '4px', height: 20,
  }} />
);

const tooltipStyle = {
  borderRadius: '8px', border: `1px solid ${T.border}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12, color: T.textBody, background: T.cardBg,
};

const LabelSx = { fontSize: 11, fontWeight: 600, color: T.textMuted, mb: 0.5 };
const SelectSx = {
  minWidth: 150, backgroundColor: T.cardBg, borderRadius: '8px', fontSize: 13,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.blue },
};

// ── Heatmap cell color ─────────────────────────────────────────────────────────
const getHeatColor = (value, max) => {
  if (!value || max === 0) return { bg: T.rowBg, color: T.textFaint };
  const intensity = value / max;
  if (intensity >= 0.8) return { bg: '#FEE2E2', color: '#991B1B' };
  if (intensity >= 0.6) return { bg: '#FEF3C7', color: '#92400E' };
  if (intensity >= 0.4) return { bg: '#DBEAFE', color: '#1E40AF' };
  if (intensity >= 0.2) return { bg: '#DCFCE7', color: '#166534' };
  return { bg: '#F9FAFB', color: T.textMuted };
};

// ── CLIMATE: Fetch directly from Open-Meteo (bypasses backend) ─────────────────
// Step 1: geocode city name → lat/lng via Open-Meteo Geocoding API
// Step 2: fetch daily historical data → aggregate to monthly averages
const geocodeCity = async (cityName) => {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error('Geocoding request failed');
  const data = await res.json();
  if (!data.results?.length) throw new Error(`Could not find coordinates for "${cityName}". Try a city name like "Dagupan" or "Manila".`);
  const { latitude, longitude, name, admin1 } = data.results[0];
  return { latitude, longitude, displayName: `${name}${admin1 ? ', ' + admin1 : ''}` };
};

const fetchOpenMeteoClimate = async (lat, lng, startDate, endDate) => {
  // Daily variables — aggregated to monthly below
  const vars = 'temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean';
  const url  = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDate}&end_date=${endDate}&daily=${vars}&timezone=Asia%2FManila`;
  const res  = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.reason || `Open-Meteo returned ${res.status}`);
  }
  const data = await res.json();
  const daily = data.daily;
  if (!daily?.time?.length) throw new Error('No climate data returned from Open-Meteo.');

  // Aggregate daily → monthly averages
  const monthly = {};
  daily.time.forEach((dateStr, i) => {
    const monthKey = dateStr.slice(0, 7); // "YYYY-MM"
    if (!monthly[monthKey]) monthly[monthKey] = { tempSum: 0, rainSum: 0, humidSum: 0, count: 0 };
    const m = monthly[monthKey];
    m.tempSum  += daily.temperature_2m_mean?.[i]        ?? 0;
    m.rainSum  += daily.precipitation_sum?.[i]          ?? 0;
    m.humidSum += daily.relative_humidity_2m_mean?.[i]  ?? 0;
    m.count    += 1;
  });

  return Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => ({
      month,
      temperature: parseFloat((m.tempSum  / m.count).toFixed(1)),
      rainfall:    parseFloat((m.rainSum).toFixed(1)),   // monthly total mm
      humidity:    parseFloat((m.humidSum / m.count).toFixed(1)),
    }));
};

// ── History ────────────────────────────────────────────────────────────────────
const History = ({ onNavigate, onLogout }) => {
  const [selectedDisease,   setSelectedDisease]   = useState('all');
  const [selectedYear,      setSelectedYear]      = useState('all');
  const [selectedBarangay,  setSelectedBarangay]  = useState('all');
  const [climateOverlay,    setClimateOverlay]    = useState(false);
  const [climateType,       setClimateType]       = useState('temperature');

  const [forecastHistory,    setForecastHistory]    = useState([]);
  const [availableDiseases,  setAvailableDiseases]  = useState([]);
  const [availableBarangays, setAvailableBarangays] = useState([]);
  const [hasData,            setHasData]            = useState(false);

  // ── Climate state ──────────────────────────────────────────────────────────
  const [climateData,      setClimateData]      = useState([]);
  const [climateLoading,   setClimateLoading]   = useState(false);
  const [climateError,     setClimateError]     = useState('');
  const [resolvedCityName, setResolvedCityName] = useState('');

  // ── Load from localStorage ─────────────────────────────────────────────────
  useEffect(() => {
    try {
      const h = localStorage.getItem('forecastHistory');
      if (h) {
        const parsed = JSON.parse(h);
        setForecastHistory(parsed);
        setHasData(parsed.length > 0);
      }
      const d = localStorage.getItem('diseaseColumns');
      if (d) setAvailableDiseases(JSON.parse(d));
      const b = localStorage.getItem('availableBarangays');
      if (b) setAvailableBarangays(JSON.parse(b));
    } catch (e) { console.error(e); }
  }, []);

  // ── Fetch climate data directly from Open-Meteo ───────────────────────────
  const fetchClimateData = useCallback(async () => {
    const city      = localStorage.getItem('datasetCity');
    const startDate = localStorage.getItem('datasetStartDate');
    const endDate   = localStorage.getItem('datasetEndDate');

    // Derive date range from forecast history if localStorage keys are missing
    let start = startDate;
    let end   = endDate;
    if ((!start || !end) && forecastHistory.length > 0) {
      const periods = forecastHistory.map(i => i.period).filter(Boolean).sort();
      start = start || (periods[0] + '-01');
      end   = end   || (periods[periods.length - 1] + '-28');
    }

    if (!city || !start || !end) {
      setClimateError(
        'Missing city or date range. Make sure your dataset has city info, or re-upload.'
      );
      return;
    }

    setClimateLoading(true);
    setClimateError('');

    try {
      // Step 1 — geocode city name to coordinates
      const { latitude, longitude, displayName } = await geocodeCity(city);
      setResolvedCityName(displayName);

      // Step 2 — fetch monthly climate data from Open-Meteo archive
      const records = await fetchOpenMeteoClimate(latitude, longitude, start, end);
      setClimateData(records);
    } catch (err) {
      setClimateError(err.message || 'Could not load climate data from Open-Meteo.');
    } finally {
      setClimateLoading(false);
    }
  }, [forecastHistory]);

  useEffect(() => {
    if (climateOverlay && climateData.length === 0 && !climateLoading) fetchClimateData();
  }, [climateOverlay]);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const getFiltered = () => {
    let f = forecastHistory;
    if (selectedDisease  !== 'all') f = f.filter(i => i.disease   === selectedDisease);
    if (selectedYear     !== 'all') f = f.filter(i => i.period?.startsWith(selectedYear));
    if (selectedBarangay !== 'all') f = f.filter(i => i.barangay  === selectedBarangay);
    return f;
  };

  const getAvailableYears = () => {
    const years = new Set(forecastHistory.map(i => i.period?.substring(0, 4)).filter(Boolean));
    return [{ value: 'all', label: 'All Years' }, ...Array.from(years).sort().map(y => ({ value: y, label: y }))];
  };

  // ── 1. Forecast Log ────────────────────────────────────────────────────────
  const buildForecastLog = () => {
    const filtered = getFiltered();
    const seen = new Set();
    return filtered.filter(item => {
      const key = `${item.disease}-${item.period}-${item.barangay}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 20);
  };

  // ── 2. Seasonal Pattern Heatmap ────────────────────────────────────────────
  const buildHeatmapData = () => {
    const filtered = forecastHistory.filter(i =>
      (selectedBarangay === 'all' || i.barangay === selectedBarangay)
    );
    const diseasesToShow = selectedDisease === 'all' ? availableDiseases : [selectedDisease];
    const heatmap = {};
    diseasesToShow.forEach(d => {
      heatmap[d] = Array(12).fill(null).map(() => ({ sum: 0, count: 0 }));
    });
    filtered.forEach(item => {
      if (!heatmap[item.disease]) return;
      const monthIdx = parseInt(item.period?.slice(5, 7)) - 1;
      if (monthIdx < 0 || monthIdx > 11) return;
      heatmap[item.disease][monthIdx].sum   += item.predictedValue || 0;
      heatmap[item.disease][monthIdx].count += 1;
    });
    const result = {};
    diseasesToShow.forEach(d => {
      result[d] = heatmap[d].map(cell =>
        cell.count > 0 ? Math.round(cell.sum / cell.count) : null
      );
    });
    return result;
  };

  // ── 3. Year-over-Year Comparison ──────────────────────────────────────────
  const buildYearOverYearData = () => {
    const filtered = forecastHistory.filter(i =>
      (selectedBarangay === 'all' || i.barangay === selectedBarangay) &&
      (selectedDisease  === 'all' || i.disease  === selectedDisease)
    );
    const years  = Array.from(new Set(filtered.map(i => i.period?.substring(0, 4)).filter(Boolean))).sort();
    const months = Array.from(new Set(filtered.map(i => i.period?.slice(5, 7)).filter(Boolean))).sort();
    return months.map(m => {
      const row = { month: MONTH_LABELS[parseInt(m) - 1] };
      years.forEach(y => {
        const items = filtered.filter(i => i.period === `${y}-${m}`);
        row[y] = items.length ? Math.round(items.reduce((s, i) => s + (i.predictedValue || 0), 0)) : null;
      });
      return row;
    });
  };

  // ── 4. Climate-Disease Correlation ────────────────────────────────────────
  const buildCorrelationData = () => {
    if (!climateData.length) return [];
    const filtered = forecastHistory.filter(i =>
      (selectedBarangay === 'all' || i.barangay === selectedBarangay) &&
      (selectedDisease  === 'all' || i.disease  === selectedDisease)
    );
    return climateData.map(c => {
      const row = {
        month:       c.month,
        temperature: c.temperature,
        rainfall:    c.rainfall,
        humidity:    c.humidity,
      };
      const monthItems = filtered.filter(i => i.period === c.month);
      row.cases = monthItems.length
        ? Math.round(monthItems.reduce((s, i) => s + (i.predictedValue || 0), 0))
        : null;
      return row;
    });
  };

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const filtered = getFiltered();
    if (!filtered.length) return;
    const headers = ['Date Generated', 'Barangay', 'Disease', 'Period', 'Predicted Cases', 'Trend', 'Confidence', 'Forecast Horizon'];
    const rows = filtered.map(i => [
      i.createdAt || '', i.barangay || '', getDiseaseInfo(i.disease).label,
      i.period || '', i.predictedValue || 0, i.trend || '', `${i.confidence || 78}%`, i.forecastHorizon || '',
    ]);
    const csv  = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `predicthealth_history_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Computed data ──────────────────────────────────────────────────────────
  const forecastLog    = buildForecastLog();
  const heatmapData    = buildHeatmapData();
  const yoyData        = buildYearOverYearData();
  const correlData     = buildCorrelationData();
  const years          = Array.from(new Set(forecastHistory.map(i => i.period?.substring(0, 4)).filter(Boolean))).sort();
  const diseasesToShow = selectedDisease === 'all' ? availableDiseases : [selectedDisease];
  const heatmapMax     = Math.max(...Object.values(heatmapData).flatMap(row => row.filter(Boolean)), 0);

  const climateLineColor = climateType === 'temperature' ? T.danger : climateType === 'rainfall' ? '#0EA5E9' : '#06B6D4';
  const climateLabel     = climateType === 'temperature' ? 'Temperature (°C)' : climateType === 'rainfall' ? 'Rainfall (mm)' : 'Humidity (%)';

  const YEAR_COLORS = ['#1B4F8A', '#0EA5E9', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: T.pageBg }}>
      <Sidebar currentPage="history" onNavigate={onNavigate} onLogout={onLogout} />

      <Box sx={{ flex: 1, overflow: 'auto', p: '28px 24px', minWidth: 0 }}>

        {/* Page header */}
        <Box sx={{ mb: 2.75 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: T.textHead, letterSpacing: '-0.3px' }}>
            History & Analytics
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.4 }}>
            Past forecast records, seasonal patterns, and climate-disease correlation
          </Typography>
        </Box>

        {/* No data alert */}
        {!hasData && (
          <Alert severity="info" icon={<InfoOutlinedIcon fontSize="small" />}
            sx={{ mb: 2.5, borderRadius: '10px', backgroundColor: T.blueDim, color: T.textHead, border: `1px solid rgba(27,79,138,0.18)`, fontSize: 13, '& .MuiAlert-icon': { color: T.blue } }}>
            <strong>No forecast history yet.</strong>{' '}
            Generate predictions from the{' '}
            <Typography component="span" onClick={() => onNavigate?.('prediction')}
              sx={{ fontWeight: 600, cursor: 'pointer', color: T.blue, '&:hover': { opacity: 0.75 } }}>
              Prediction →
            </Typography>{' '}
            page to populate this page.
          </Alert>
        )}

        {/* ── Filters ── */}
        <SCard sx={{ mb: '16px' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Box>
                <Typography sx={LabelSx}>Barangay</Typography>
                <Select value={selectedBarangay} size="small" sx={SelectSx} onChange={e => setSelectedBarangay(e.target.value)}>
                  <MenuItem value="all" sx={{ fontSize: 13 }}>All Barangays</MenuItem>
                  {availableBarangays.map(b => <MenuItem key={b} value={b} sx={{ fontSize: 13 }}>{b}</MenuItem>)}
                </Select>
              </Box>
              <Box>
                <Typography sx={LabelSx}>Disease</Typography>
                <Select value={selectedDisease} size="small" sx={SelectSx} onChange={e => setSelectedDisease(e.target.value)}>
                  <MenuItem value="all" sx={{ fontSize: 13 }}>All Diseases</MenuItem>
                  {availableDiseases.map(d => {
                    const info = getDiseaseInfo(d);
                    return <MenuItem key={d} value={d} sx={{ fontSize: 13 }}>{info.icon} {info.label}</MenuItem>;
                  })}
                </Select>
              </Box>
              <Box>
                <Typography sx={LabelSx}>Year</Typography>
                <Select value={selectedYear} size="small" sx={{ ...SelectSx, minWidth: 120 }} onChange={e => setSelectedYear(e.target.value)}>
                  {getAvailableYears().map(y => <MenuItem key={y.value} value={y.value} sx={{ fontSize: 13 }}>{y.label}</MenuItem>)}
                </Select>
              </Box>
              <Box sx={{ ml: 'auto' }}>
                <Button
                  variant="outlined" size="small"
                  startIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
                  onClick={handleExportCSV}
                  disabled={!hasData}
                  sx={{
                    textTransform: 'none', fontSize: 12.5, fontWeight: 600,
                    borderRadius: '8px', borderColor: T.border, color: T.textBody,
                    px: 2, py: 0.75,
                    '&:hover': { borderColor: T.blue, color: T.blue, backgroundColor: T.blueDim },
                    '&:disabled': { opacity: 0.45 },
                  }}>
                  Export CSV
                </Button>
              </Box>
            </Box>
          </CardContent>
        </SCard>

        {/* ══ SECTION 1: Forecast Log ══ */}
        <SCard sx={{ mb: '16px' }}>
          <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2 } }}>
            <CardHead
              title="Forecast Log"
              icon={<HistoryIcon sx={{ fontSize: 15 }} />}
              right={hasData
                ? <Tag label={`${forecastLog.length} records`} bg={T.blueDim} color={T.blue} border="rgba(27,79,138,0.18)" />
                : null}
            />
            {!hasData || forecastLog.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <MedicalIcon sx={{ fontSize: 40, color: T.borderSoft, mb: 1 }} />
                <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>No forecast records yet</Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Date Generated', 'Barangay', 'Disease', 'Period', 'Predicted Cases', 'Horizon', 'Trend', 'Confidence'].map(col => (
                        <TableCell key={col} sx={{ fontSize: 11, fontWeight: 600, color: T.textMuted, borderBottom: `1px solid ${T.borderSoft}`, py: 1.25, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                          {col}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {forecastLog.map((item, idx) => {
                      const info = getDiseaseInfo(item.disease);
                      return (
                        <TableRow key={idx} sx={{ '&:hover': { backgroundColor: T.rowBg }, '& td': { borderBottom: `1px solid ${T.borderSoft}` } }}>
                          <TableCell sx={{ fontSize: 12, color: T.textMuted, py: 1.25, whiteSpace: 'nowrap' }}>{item.createdAt || '—'}</TableCell>
                          <TableCell sx={{ fontSize: 12.5, fontWeight: 500, color: T.textBody, py: 1.25 }}>{item.barangay || '—'}</TableCell>
                          <TableCell sx={{ py: 1.25 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: getDiseaseColor(item.disease), flexShrink: 0 }} />
                              <Typography sx={{ fontSize: 12.5, color: T.textBody }}>{info.label}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontSize: 12.5, fontWeight: 600, color: T.textHead, py: 1.25 }}>{item.period || '—'}</TableCell>
                          <TableCell sx={{ fontSize: 12.5, fontWeight: 700, color: T.blue, py: 1.25 }}>{(item.predictedValue || 0).toLocaleString()}</TableCell>
                          <TableCell sx={{ fontSize: 12, color: T.textMuted, py: 1.25 }}>{item.forecastHorizon || '—'}</TableCell>
                          <TableCell sx={{ py: 1.25 }}><TrendTag trend={item.trend} /></TableCell>
                          <TableCell sx={{ py: 1.25 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Box sx={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: T.borderSoft, overflow: 'hidden', minWidth: 40 }}>
                                <Box sx={{ height: '100%', width: `${item.confidence || 78}%`, backgroundColor: item.confidence >= 85 ? T.ok : item.confidence >= 75 ? T.warnAccent : T.danger, borderRadius: 2 }} />
                              </Box>
                              <Typography sx={{ fontSize: 11, fontWeight: 600, color: T.textHead, minWidth: 28 }}>{item.confidence || 78}%</Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </SCard>

        {/* ══ SECTION 2: Seasonal Pattern Heatmap ══ */}
        {hasData && (
          <SCard sx={{ mb: '16px' }}>
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2 } }}>
              <CardHead
                title="Seasonal Pattern Heatmap"
                icon={<GridOnIcon sx={{ fontSize: 15 }} />}
                right={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {[
                        { bg: '#F9FAFB', label: 'Low' },
                        { bg: '#DCFCE7', label: '' },
                        { bg: '#DBEAFE', label: '' },
                        { bg: '#FEF3C7', label: '' },
                        { bg: '#FEE2E2', label: 'High' },
                      ].map((c, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                          <Box sx={{ width: 14, height: 14, borderRadius: '3px', backgroundColor: c.bg, border: `1px solid ${T.borderSoft}` }} />
                          {c.label && <Typography sx={{ fontSize: 10, color: T.textFaint }}>{c.label}</Typography>}
                        </Box>
                      ))}
                    </Box>
                    <Tag label="Avg cases per month" bg={T.blueDim} color={T.blue} border="rgba(27,79,138,0.18)" />
                  </Box>
                }
              />
              <Typography sx={{ fontSize: 11.5, color: T.textFaint, mb: 1.75, mt: '-6px' }}>
                Color intensity shows average forecasted cases per month — darker red = higher surge risk
              </Typography>
              {diseasesToShow.length === 0 || Object.keys(heatmapData).length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>Not enough data for heatmap</Typography>
                </Box>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 600 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontSize: 11, fontWeight: 600, color: T.textMuted, borderBottom: `1px solid ${T.borderSoft}`, py: 1, width: 130 }}>Disease</TableCell>
                        {MONTH_LABELS.map(m => (
                          <TableCell key={m} align="center" sx={{ fontSize: 11, fontWeight: 600, color: T.textMuted, borderBottom: `1px solid ${T.borderSoft}`, py: 1, px: 0.5 }}>{m}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {diseasesToShow.map(d => {
                        const info   = getDiseaseInfo(d);
                        const values = heatmapData[d] || Array(12).fill(null);
                        return (
                          <TableRow key={d} sx={{ '& td': { borderBottom: `1px solid ${T.borderSoft}` } }}>
                            <TableCell sx={{ py: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: getDiseaseColor(d), flexShrink: 0 }} />
                                <Typography sx={{ fontSize: 12, fontWeight: 500, color: T.textBody }}>{info.label}</Typography>
                              </Box>
                            </TableCell>
                            {values.map((val, i) => {
                              const { bg, color } = getHeatColor(val, heatmapMax);
                              return (
                                <Tooltip key={i} title={val != null ? `${MONTH_LABELS[i]}: ${val.toLocaleString()} avg cases` : 'No data'} placement="top">
                                  <TableCell align="center" sx={{ py: 0.75, px: 0.5, backgroundColor: bg, cursor: 'default' }}>
                                    <Typography sx={{ fontSize: 10.5, fontWeight: val ? 600 : 400, color }}>
                                      {val != null ? val.toLocaleString() : '—'}
                                    </Typography>
                                  </TableCell>
                                </Tooltip>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </CardContent>
          </SCard>
        )}

        {/* ══ SECTION 3: Year-over-Year Comparison ══ */}
        {hasData && yoyData.length > 0 && years.length > 0 && (
          <SCard sx={{ mb: '16px' }}>
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2 } }}>
              <CardHead
                title="Year-over-Year Comparison"
                icon={<BarChartIcon sx={{ fontSize: 15 }} />}
                right={<Tag label={`${years.length} year${years.length > 1 ? 's' : ''}`} bg={T.blueDim} color={T.blue} border="rgba(27,79,138,0.18)" />}
              />
              <Typography sx={{ fontSize: 11.5, color: T.textFaint, mb: 1.75, mt: '-6px' }}>
                Forecasted cases by month across different years — compare if surges are worsening or improving
              </Typography>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={yoyData} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                  <YAxis axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ paddingTop: 12, fontSize: 11 }} />
                  {years.map((y, i) => (
                    <Bar key={y} dataKey={y} name={y} fill={YEAR_COLORS[i % YEAR_COLORS.length]} radius={[3, 3, 0, 0]} maxBarSize={32} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </SCard>
        )}

        {/* ══ SECTION 4: Climate-Disease Correlation ══ */}
        <SCard>
          <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2 } }}>
            <CardHead
              title="Climate–Disease Correlation"
              icon={<ShowChartIcon sx={{ fontSize: 15 }} />}
              right={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <FormControlLabel
                    control={
                      <Switch checked={climateOverlay} onChange={e => setClimateOverlay(e.target.checked)} size="small"
                        sx={{ '& .MuiSwitch-thumb': { width: 14, height: 14 }, '& .MuiSwitch-track': { borderRadius: 7 } }} />
                    }
                    label={<Typography sx={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>Show Climate</Typography>}
                    sx={{ m: 0 }}
                  />
                  {climateOverlay && (
                    <Select value={climateType} size="small" sx={{ ...SelectSx, minWidth: 155 }} onChange={e => setClimateType(e.target.value)}>
                      <MenuItem value="temperature" sx={{ fontSize: 13 }}><ThermostatIcon sx={{ fontSize: 13, mr: 0.5 }} /> Temperature</MenuItem>
                      <MenuItem value="rainfall"    sx={{ fontSize: 13 }}><WaterDropIcon   sx={{ fontSize: 13, mr: 0.5 }} /> Rainfall</MenuItem>
                      <MenuItem value="humidity"    sx={{ fontSize: 13 }}><AirIcon         sx={{ fontSize: 13, mr: 0.5 }} /> Humidity</MenuItem>
                    </Select>
                  )}
                  {climateOverlay && climateLoading && <CircularProgress size={13} sx={{ color: T.blue }} />}
                  {climateOverlay && !climateLoading && climateData.length > 0 && (
                    <Tooltip title="Refresh climate data">
                      <RefreshIcon onClick={fetchClimateData} sx={{ fontSize: 16, color: T.textMuted, cursor: 'pointer', '&:hover': { color: T.blue } }} />
                    </Tooltip>
                  )}
                </Box>
              }
            />
            <Typography sx={{ fontSize: 11.5, color: T.textFaint, mb: 1.75, mt: '-6px' }}>
              Compare disease case trends against climate variables to identify environmental surge triggers
            </Typography>

            {/* Climate error */}
            {climateOverlay && climateError && (
              <Box sx={{ mb: 1.5, p: '8px 12px', borderRadius: '7px', backgroundColor: T.dangerBg, border: `1px solid ${T.dangerBorder}` }}>
                <Typography sx={{ fontSize: 12, color: T.danger, mb: 0.5 }}>{climateError}</Typography>
                <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
                  Make sure <strong>datasetCity</strong> is saved in localStorage when uploading your dataset (e.g. "Dagupan City").
                </Typography>
              </Box>
            )}

            {/* Climate loaded badge */}
            {climateOverlay && !climateLoading && !climateError && climateData.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: T.ok }} />
                <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
                  Live climate data via Open-Meteo · {climateData.length} months
                  {resolvedCityName ? ` · ${resolvedCityName}` : ''}
                </Typography>
              </Box>
            )}

            {!hasData ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>No forecast data to correlate</Typography>
              </Box>
            ) : !climateOverlay ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 5, gap: 1 }}>
                <ShowChartIcon sx={{ fontSize: 36, color: T.borderSoft }} />
                <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>Toggle "Show Climate" to load real climate data and view correlation</Typography>
              </Box>
            ) : climateLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 5 }}>
                <CircularProgress size={16} sx={{ color: T.blue }} />
                <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>
                  Loading climate data from Open-Meteo…
                </Typography>
              </Box>
            ) : correlData.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>No overlapping data between climate and forecast records</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={correlData} margin={{ top: 8, right: 50, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                  <YAxis yAxisId="cases"   axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                  <YAxis yAxisId="climate" orientation="right" axisLine={false} tickLine={false}
                    style={{ fontSize: 10.5, fill: climateLineColor }}
                    tickFormatter={v => climateType === 'temperature' ? `${v}°` : climateType === 'rainfall' ? `${v}mm` : `${v}%`}
                  />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ paddingTop: 12, fontSize: 11 }} />
                  <Bar yAxisId="cases" dataKey="cases" name="Forecasted Cases" fill={T.blue} radius={[3, 3, 0, 0]} maxBarSize={40} />
                  <Line
                    yAxisId="climate" type="monotone" dataKey={climateType}
                    name={climateLabel} stroke={climateLineColor}
                    strokeWidth={2} strokeDasharray="5 3"
                    dot={{ fill: climateLineColor, r: 3, strokeWidth: 0 }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </SCard>

      </Box>
    </Box>
  );
};

export default History;