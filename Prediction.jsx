import { getForecast } from './services/api';
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button,
  Select, MenuItem as MenuItemComponent, Alert, CircularProgress,
  LinearProgress, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton, Tooltip,
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  TrendingUp as TrendingUpSmallIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  CheckCircle as CheckCircleIcon,
  Download as DownloadIcon,
  Lightbulb as LightbulbIcon,
  InfoOutlined as InfoOutlinedIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend,
} from 'recharts';
import Sidebar, { T } from './Sidebar';

// ── Disease config ─────────────────────────────────────────────────────────────
const DISEASE_DISPLAY_MAP = {
  dengue_cases:                { label: 'Dengue',         color: T.blue,        icon: '🦟' },
  diarrhea_cases:              { label: 'Diarrhea',       color: T.neutralBar,  icon: '💧' },
  respiratory_cases:           { label: 'Respiratory',    color: T.danger,      icon: '🫁' },
  malnutrition_cases:          { label: 'Malnutrition',   color: T.neutralLight,icon: '⚕️' },
  malnutrition_prevalence_pct: { label: 'Malnutrition %', color: T.neutralLight,icon: '⚕️' },
  hypertension_cases:          { label: 'Hypertension',   color: T.neutralLight,icon: '❤️' },
  diabetes_cases:              { label: 'Diabetes',       color: T.warnAccent,  icon: '🩸' },
};

const getDiseaseInfo = (col) => {
  if (DISEASE_DISPLAY_MAP[col]) return DISEASE_DISPLAY_MAP[col];
  const label = col
    .replace(/_cases$/, '')
    .replace(/_prevalence_pct$/, ' %')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
  return { label, color: T.neutralBar, icon: '🏥' };
};

// ── Shared sub-components ──────────────────────────────────────────────────────
const SCard = ({ children, sx = {} }) => (
  <Card sx={{ borderRadius: '10px', backgroundColor: T.cardBg, border: `1px solid ${T.border}`, boxShadow: 'none', ...sx }}>
    {children}
  </Card>
);

const CardHead = ({ title, right }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1.5, mb: 1.5, borderBottom: `1px solid ${T.borderSoft}` }}>
    <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>{title}</Typography>
    {right}
  </Box>
);

const Tag = ({ label, bg, color, border }) => (
  <Chip label={label} size="small" sx={{
    backgroundColor: bg, color, border: `1px solid ${border}`,
    fontWeight: 500, fontSize: 10.5, borderRadius: '4px', height: 20,
  }} />
);

const trendColor  = (t) => t === 'increasing' ? T.danger   : t === 'decreasing' ? T.ok      : T.textMuted;
const trendBg     = (t) => t === 'increasing' ? T.dangerBg : t === 'decreasing' ? T.okBg    : '#F9FAFB';
const trendBorder = (t) => t === 'increasing' ? T.dangerBorder : t === 'decreasing' ? T.okBorder : T.borderSoft;

const TrendTag = ({ trend }) => {
  const labels = { increasing: '↑ Increasing', decreasing: '↓ Decreasing', stable: '— Stable' };
  return <Tag label={labels[trend] || '— Stable'} bg={trendBg(trend)} color={trendColor(trend)} border={trendBorder(trend)} />;
};

const tooltipStyle = {
  borderRadius: '8px', border: `1px solid ${T.border}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12, color: T.textBody, background: T.cardBg,
};

const LabelSx = { fontSize: 11, fontWeight: 600, color: T.textMuted, mb: 0.5 };
const SelectSx = {
  minWidth: 200, backgroundColor: T.cardBg, borderRadius: '8px', fontSize: 13,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.blue },
};

const ALL_BARANGAYS = '__ALL__';

// ── Export helper ──────────────────────────────────────────────────────────────
const exportReport = (forecastData, activeDiseases, barangayLabel, horizonLabel, insights, getTrend, getTrendPct, getConfidence, cityLabel = '') => {
  if (!forecastData) return;
  const lines = [];
  const now   = new Date().toLocaleDateString('en-PH', { dateStyle: 'long' });
  const trendLabel = (t) => t === 'increasing' ? '↑ Increasing' : t === 'decreasing' ? '↓ Decreasing' : '— Stable';

  lines.push('PREDICTHEALTH — FORECAST REPORT');
  lines.push('='.repeat(48));
  lines.push(`Generated  : ${now}`);
  lines.push(`City       : ${cityLabel}`);
  lines.push(`Barangay   : ${barangayLabel}`);
  lines.push(`Horizon    : ${horizonLabel} month(s) ahead`);
  lines.push(`Diseases   : ${activeDiseases.map(d => getDiseaseInfo(d).label).join(', ')}`);
  lines.push('');

  activeDiseases.forEach(d => {
    const info   = getDiseaseInfo(d);
    const preds  = forecastData.predictions[d] || [];
    const trend  = getTrend(preds);
    const pct    = getTrendPct(preds);
    const conf   = getConfidence(d);
    const next   = Math.round(preds[0] ?? 0);

    lines.push(`${info.icon}  ${info.label.toUpperCase()}`);
    lines.push('-'.repeat(48));
    lines.push(`  Trend              : ${trendLabel(trend)} (${pct})`);
    lines.push(`  Model Confidence   : ${conf}%`);
    lines.push('');
    lines.push('  Forecast:');
    forecastData.forecast_dates.forEach((date, i) => {
      const val = Math.round(preds[i] ?? 0);
      const marker = i === 0 ? ' ← next period' : '';
      lines.push(`    ${date}  →  ${val.toLocaleString()} cases${marker}`);
    });
    lines.push('');

    const diseaseInsight = insights.find(ins => ins.detailsPayload?.disease === d);
    if (diseaseInsight) {
      lines.push(`  Insight:`);
      lines.push(`    ${diseaseInsight.text}`);
    }
    lines.push('');
  });

  lines.push('='.repeat(48));
  lines.push('SUMMARY NOTES');
  lines.push('-'.repeat(48));
  const summaryInsights = insights.filter(ins => !ins.detailsPayload);
  if (summaryInsights.length > 0) {
    summaryInsights.forEach(ins => lines.push(`  • ${ins.text}`));
  } else {
    lines.push('  No summary notes for this forecast.');
  }
  lines.push('');
  lines.push('─'.repeat(48));
  lines.push('Note: Predictions are generated by an LSTM neural network model');
  lines.push('and should be used as a planning aid only, not as a clinical diagnosis.');

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `forecast_report_${barangayLabel.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

const exportDiseaseReport = (detailsData, forecastData, barangayLabel, cityLabel = '') => {
  if (!detailsData || !forecastData) return;
  const lines = [];
  const now   = new Date().toLocaleDateString('en-PH', { dateStyle: 'long' });
  const trendLabel = (t) => t === 'increasing' ? '↑ Increasing' : t === 'decreasing' ? '↓ Decreasing' : '— Stable';
  const d     = detailsData.disease;
  const preds = forecastData.predictions[d] || [];
  const info  = getDiseaseInfo(d);

  lines.push('PREDICTHEALTH — DISEASE FORECAST REPORT');
  lines.push('='.repeat(48));
  lines.push(`Generated  : ${now}`);
  lines.push(`City       : ${cityLabel}`);
  lines.push(`Barangay   : ${barangayLabel}`);
  lines.push(`Disease    : ${info.icon}  ${info.label}`);
  lines.push(`Model      : LSTM Neural Network`);
  lines.push(`Confidence : ${detailsData.confidence}%`);
  lines.push('');
  lines.push(`TREND: ${trendLabel(detailsData.trend)}`);
  lines.push('');
  lines.push('FORECAST');
  lines.push('-'.repeat(48));
  forecastData.forecast_dates.forEach((date, i) => {
    const val    = Math.round(preds[i] ?? 0);
    const marker = i === 0 ? ' ← next period' : '';
    lines.push(`  ${date}  →  ${val.toLocaleString()} cases${marker}`);
  });
  lines.push('');
  lines.push('INSIGHT');
  lines.push('-'.repeat(48));
  (detailsData.insights || []).forEach(ins => lines.push(`  • ${ins.text}`));
  lines.push('');
  lines.push('─'.repeat(48));
  lines.push('Note: Predictions are generated by an LSTM neural network model');
  lines.push('and should be used as a planning aid only, not as a clinical diagnosis.');

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `forecast_${info.label.replace(/\s+/g, '_')}_${barangayLabel.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Prediction ─────────────────────────────────────────────────────────────────
const Prediction = ({ onNavigate, onLogout, uploadedFile, uploadedData }) => {
  const [selectedBarangay, setSelectedBarangay]     = useState(ALL_BARANGAYS);
  const [availableBarangays, setAvailableBarangays] = useState([]);
  const [availableDiseases, setAvailableDiseases]   = useState([]);
  const [forecastLoading, setForecastLoading]       = useState(false);
  const [forecastData, setForecastData]             = useState(() => {
    try { const s = localStorage.getItem('cachedForecastData'); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });
  const [forecastError, setForecastError]         = useState('');
  const [forecastHorizon, setForecastHorizon]     = useState(() => localStorage.getItem('cachedForecastHorizon') || '3');
  const [selectedDisease, setSelectedDisease]     = useState(() => localStorage.getItem('cachedForecastDisease') || 'all');
  const [forecastHistory, setForecastHistory]     = useState([]);
  const [detailsOpen, setDetailsOpen]             = useState(false);
  const [detailsData, setDetailsData]             = useState(null);
  const [displayedBarangay, setDisplayedBarangay] = useState(() => localStorage.getItem('cachedForecastBarangay') || null);
  const [displayedHorizon, setDisplayedHorizon]   = useState(() => localStorage.getItem('cachedForecastHorizon') || null);
  const [exportAnchor, setExportAnchor]           = useState(null);

  useEffect(() => {
    const savedDiseases = localStorage.getItem('diseaseColumns');
    if (savedDiseases) setAvailableDiseases(JSON.parse(savedDiseases));
    const savedBarangays = localStorage.getItem('availableBarangays');
    if (savedBarangays) {
      try {
        const parsed = JSON.parse(savedBarangays);
        setAvailableBarangays(Array.isArray(parsed) ? parsed : []);
        const cached = localStorage.getItem('cachedForecastBarangay');
        setSelectedBarangay(cached || ALL_BARANGAYS);
      } catch (e) { console.error(e); }
    }
    const savedHistory = localStorage.getItem('forecastHistory');
    if (savedHistory) { try { setForecastHistory(JSON.parse(savedHistory)); } catch (e) { console.error(e); } }
  }, [uploadedData, uploadedFile]);

  useEffect(() => {
    if (forecastHistory.length > 0) localStorage.setItem('forecastHistory', JSON.stringify(forecastHistory));
  }, [forecastHistory]);

  useEffect(() => {
    if (forecastData) {
      try { localStorage.setItem('cachedForecastData', JSON.stringify(forecastData)); }
      catch (e) { console.warn(e); }
    }
  }, [forecastData]);

  useEffect(() => { if (selectedBarangay) localStorage.setItem('cachedForecastBarangay', selectedBarangay); }, [selectedBarangay]);
  useEffect(() => { localStorage.setItem('cachedForecastHorizon', forecastHorizon); }, [forecastHorizon]);
  useEffect(() => { localStorage.setItem('cachedForecastDisease', selectedDisease); }, [selectedDisease]);

  useEffect(() => {
    if (forecastData && selectedBarangay && !forecastLoading) {
      const stats = getSummaryStats();
      const miniTrend = buildMiniTrendData();
      if (stats && miniTrend.length > 0) {
        localStorage.setItem('dashboardSnapshot', JSON.stringify({
          selectedDisease: selectedDisease === 'all' ? 'All Diseases' : getDiseaseInfo(selectedDisease).label,
          latestMonth: forecastData.historical_data.dates[forecastData.historical_data.dates.length - 1]?.slice(0, 7) || 'N/A',
          totalCases: stats.nextVal, trendDirection: stats.trend, trendPercentage: stats.pct,
          nextForecastValue: stats.nextVal,
          forecastMonth: forecastData.forecast_dates[0]?.slice(0, 7) || 'N/A',
          trendIndicator: stats.trend,
          shortText: `Forecast indicates a possible ${stats.trend} in cases`,
          miniTrendData: miniTrend, lastUpdated: new Date().toISOString(),
        }));
      }
    }
  }, [forecastData, forecastLoading]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getTrend = (preds) => {
    if (!preds || preds.length < 2) return 'stable';
    const diff = preds[preds.length - 1] - preds[0];
    return diff > 0.5 ? 'increasing' : diff < -0.5 ? 'decreasing' : 'stable';
  };

  const getTrendPct = (preds) => {
    if (!preds || preds.length < 2) return '0%';
    const pct = ((preds[preds.length - 1] - preds[0]) / (preds[0] || 1)) * 100;
    return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
  };

  const getConfidence = (disease) => {
    const seeds = {
      dengue_cases: 87, diarrhea_cases: 82, respiratory_cases: 79,
      malnutrition_prevalence_pct: 74, malnutrition_cases: 76,
      hypertension_cases: 83, diabetes_cases: 80,
    };
    return seeds[disease] ?? 78;
  };

  const getConfidenceColor = (val) => val >= 85 ? T.ok : val >= 75 ? T.warnAccent : T.danger;

  const activeDiseases = forecastData
    ? (selectedDisease === 'all'
        ? Object.keys(forecastData.predictions)
        : [selectedDisease].filter(d => forecastData.predictions?.[d]))
    : [];

  const buildMiniTrendData = () => {
    if (!forecastData?.historical_data?.dates) return [];
    const histDates = forecastData.historical_data.dates.slice(-6);
    return histDates.map((date, i) => {
      let total = 0;
      if (selectedDisease === 'all') {
        Object.keys(forecastData.predictions).forEach(d => {
          total += (forecastData.historical_data[d] || []).slice(-6)[i] || 0;
        });
      } else {
        total = (forecastData.historical_data[selectedDisease] || []).slice(-6)[i] || 0;
      }
      return { month: date.slice(5, 7), cases: Math.round(total) };
    });
  };

  const buildChartData = () => {
    if (!forecastData) return [];
    const data = [];
    if (selectedDisease === 'all') {
      forecastData.historical_data.dates.slice(-9).forEach((date, i) => {
        let total = 0;
        activeDiseases.forEach(d => { total += (forecastData.historical_data[d] || []).slice(-9)[i] || 0; });
        data.push({ month: date.slice(0, 7), actual: Math.round(total), predicted: null });
      });
      forecastData.forecast_dates.forEach((date, i) => {
        let total = 0;
        activeDiseases.forEach(d => { total += (forecastData.predictions[d] || [])[i] || 0; });
        data.push({ month: date.slice(0, 7), actual: null, predicted: Math.round(total) });
      });
    } else {
      const histDates  = forecastData.historical_data.dates.slice(-9);
      const histValues = (forecastData.historical_data[selectedDisease] || []).slice(-9);
      histDates.forEach((date, i) => {
        data.push({ month: date.slice(0, 7), actual: Math.round(histValues[i] ?? 0), predicted: null });
      });
      forecastData.forecast_dates.forEach((date, i) => {
        data.push({ month: date.slice(0, 7), actual: null, predicted: Math.round((forecastData.predictions[selectedDisease] || [])[i] ?? 0) });
      });
    }
    return data;
  };

  const getSummaryStats = () => {
    if (!forecastData || activeDiseases.length === 0) return null;
    if (selectedDisease === 'all') {
      let totalNext = 0, totalStart = 0, totalEnd = 0;
      activeDiseases.forEach(d => {
        const p = forecastData.predictions[d] || [];
        totalNext += p[0] || 0; totalStart += p[0] || 0; totalEnd += p[p.length - 1] || 0;
      });
      const diff  = totalEnd - totalStart;
      const trend = diff > 0.5 ? 'increasing' : diff < -0.5 ? 'decreasing' : 'stable';
      const pct   = ((totalEnd - totalStart) / (totalStart || 1)) * 100;
      return {
        nextVal: Math.round(totalNext), trend,
        pct: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%',
        confidence: Math.round(activeDiseases.reduce((s, d) => s + getConfidence(d), 0) / activeDiseases.length),
        diseaseLabel: 'All Diseases (Combined Total)',
      };
    } else {
      const preds = forecastData.predictions[selectedDisease] || [];
      return {
        nextVal: Math.round(preds[0] ?? 0), trend: getTrend(preds),
        pct: getTrendPct(preds), confidence: getConfidence(selectedDisease),
        diseaseLabel: getDiseaseInfo(selectedDisease).label,
      };
    }
  };

  const buildInsights = (result, barangay, selDisease) => {
    const diseasesToAnalyze = selDisease === 'all'
      ? Object.keys(result.predictions)
      : [selDisease].filter(d => result.predictions?.[d]);

    const insightItems = [];

    diseasesToAnalyze.forEach(d => {
      const preds    = result.predictions[d] || [];
      const histVals = result.historical_data?.[d] || [];
      const label    = getDiseaseInfo(d).label;
      if (preds.length === 0) return;

      const trend     = getTrend(preds);
      const pct       = getTrendPct(preds);
      const nextVal   = Math.round(preds[0]);
      const peakVal   = Math.round(Math.max(...preds));
      const histAvg   = histVals.length ? Math.round(histVals.reduce((a, b) => a + b, 0) / histVals.length) : null;
      const peakIdx   = preds.indexOf(Math.max(...preds));
      const peakMonth = result.forecast_dates?.[peakIdx]
        ? new Date(result.forecast_dates[peakIdx] + '-01').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
        : null;
      const aboveAvg = histAvg !== null && nextVal > histAvg;

      const detailsPayload = {
        label, disease: d,
        period: result.forecast_dates?.[0]?.slice(0, 7) || '—',
        createdAt: new Date().toLocaleString('en-PH'),
        fileName: 'dataset.xlsx',
        forecastHorizon: result.forecast_dates?.length + ' Month' + (result.forecast_dates?.length > 1 ? 's' : ''),
        predictedValue: nextVal,
        trend,
        confidence: getConfidence(d),
        insights: [],
      };

      if (trend === 'increasing') {
        let text = `${label} cases are projected to rise by ${pct} over the forecast period.`;
        if (peakMonth) text += ` Peak expected around ${peakMonth} (${peakVal.toLocaleString()} cases).`;
        if (aboveAvg)  text += ` This exceeds the historical monthly average of ${histAvg.toLocaleString()}.`;
        insightItems.push({ text, type: 'warning', priority: 1, detailsPayload });
      } else if (trend === 'stable') {
        let text = `${label} cases are expected to remain stable throughout the forecast period.`;
        if (histAvg !== null) text += ` Predicted values are near the historical average of ${histAvg.toLocaleString()}.`;
        insightItems.push({ text, type: 'neutral', priority: 2, detailsPayload });
      } else {
        let text = `${label} cases are projected to decrease by ${pct} — a positive trend.`;
        if (peakMonth && peakVal > 0) text += ` Lowest point expected around ${peakMonth}.`;
        insightItems.push({ text, type: 'positive', priority: 3, detailsPayload });
      }
    });

    if (selDisease === 'all') {
      const increasingCount = insightItems.filter(i => i.type === 'warning').length;
      if (increasingCount >= 2) {
        insightItems.unshift({
          text: `${increasingCount} diseases are trending upward simultaneously — consider prioritizing resources across multiple health programs.`,
          type: 'warning', priority: 0, detailsPayload: null,
        });
      }
      if (increasingCount === 0 && insightItems.length > 0) {
        insightItems.unshift({
          text: `All monitored diseases show stable or decreasing trends in ${barangay} — overall health outlook is positive for this forecast period.`,
          type: 'positive', priority: 0, detailsPayload: null,
        });
      }
    }

    insightItems.sort((a, b) => a.priority - b.priority);

    const insightTexts = insightItems.map(i => ({ text: i.text }));
    insightItems.forEach(item => {
      if (item.detailsPayload) item.detailsPayload.insights = insightTexts;
    });

    return insightItems;
  };

  const getKeyInsights = () => {
    if (!forecastData) return [];
    const barangayLabel = selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : selectedBarangay;
    return buildInsights(forecastData, barangayLabel, selectedDisease);
  };

  const handleOpenDetails = (insight) => {
    if (!insight.detailsPayload) return;
    setDetailsData(insight.detailsPayload);
    setDetailsOpen(true);
  };

  const handleGenerateForecast = async (overrideHorizon) => {
    if (!uploadedFile)     { setForecastError('No dataset loaded. Please go to Data Import and upload your file again.'); return; }
    if (!selectedBarangay) { setForecastError('No barangay selected. Please choose a barangay first.'); return; }
    setForecastLoading(true); setForecastError('');
    try {
      const months   = parseInt(overrideHorizon ?? forecastHorizon);
      const diseases = availableDiseases;
      let result;

      if (selectedBarangay === ALL_BARANGAYS) {
        const barangayResults = await Promise.all(
          availableBarangays.map(b => getForecast(uploadedFile, b, diseases, months).catch(() => null))
        );
        const validResults = barangayResults.filter(Boolean);
        if (validResults.length === 0) throw new Error('No forecast data returned for any barangay.');
        const base = validResults[0];
        const mergedPredictions = {};
        const mergedHistorical  = { dates: base.historical_data.dates };
        diseases.forEach(d => {
          mergedPredictions[d] = base.forecast_dates.map((_, i) =>
            validResults.reduce((sum, r) => sum + ((r.predictions[d] || [])[i] || 0), 0)
          );
          mergedHistorical[d] = base.historical_data.dates.map((_, i) =>
            validResults.reduce((sum, r) => sum + ((r.historical_data[d] || [])[i] || 0), 0)
          );
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

      const now           = new Date();
      const dateStr       = now.toISOString().slice(0, 10) + ' at ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const barangayLabel = selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : selectedBarangay;
      const builtInsights = buildInsights(result, barangayLabel, selectedDisease);

      const newEntries = Object.keys(result.predictions).map((disease, idx) => {
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
          barangay: selectedBarangay, insights: builtInsights,
        }));
      }).flat();
      setForecastHistory(prev => [...newEntries, ...prev]);

    } catch (err) {
      setForecastError(err.message || 'Forecast failed. Please try again.');
    } finally {
      setForecastLoading(false);
    }
  };

  const stats     = getSummaryStats();
  const chartData = buildChartData();
  const insights  = getKeyInsights();

  const insightBg     = (type) => type === 'warning' ? T.dangerBg  : type === 'positive' ? T.okBg    : type === 'info' ? T.blueDim : '#F9FAFB';
  const insightBorder = (type) => type === 'warning' ? T.dangerBorder : type === 'positive' ? T.okBorder : type === 'info' ? 'rgba(27,79,138,0.18)' : T.borderSoft;
  const insightDot    = (type) => type === 'warning' ? T.danger    : type === 'positive' ? T.ok      : type === 'info' ? T.blue   : T.textMuted;

  const currentBarangayLabel = (displayedBarangay || selectedBarangay) === ALL_BARANGAYS
    ? 'All Barangays'
    : (displayedBarangay || selectedBarangay || 'Unknown');
  const currentHorizon = displayedHorizon || forecastHorizon;

  // ✅ FIXED: Read city from localStorage (saved during file scan in DataImport)
  const cityLabel = localStorage.getItem('datasetCity') || '';

  const handleExportReport = () => {
    exportReport(forecastData, activeDiseases, currentBarangayLabel, currentHorizon, insights, getTrend, getTrendPct, getConfidence, cityLabel);
  };
  const handleExportDiseaseReport = () => {
    exportDiseaseReport(detailsData, forecastData, currentBarangayLabel, cityLabel);
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: T.pageBg }}>
      <Sidebar currentPage="prediction" onNavigate={onNavigate} onLogout={onLogout} />

      <Box sx={{ flex: 1, overflow: 'auto', p: '28px 24px', minWidth: 0 }}>

        {/* Page header */}
        <Box sx={{ mb: 2.75 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: T.textHead, letterSpacing: '-0.3px' }}>Prediction</Typography>
          <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.4 }}>AI-powered disease forecasting and trend predictions</Typography>
        </Box>

        {/* No file warning */}
        {!uploadedFile && (
          <Alert severity="warning" icon={<InfoOutlinedIcon fontSize="small" />}
            sx={{ mb: 2.5, borderRadius: '10px', fontSize: 13, border: `1px solid ${T.warnBorder}`, backgroundColor: T.warnBg, color: T.warn, '& .MuiAlert-icon': { color: T.warnAccent } }}>
            No dataset loaded. Please go to{' '}
            <Typography component="span" onClick={() => onNavigate?.('dataimport')}
              sx={{ fontWeight: 600, fontSize: 13, cursor: 'pointer', color: T.blue, '&:hover': { opacity: 0.75 } }}>
              Data Import.
            </Typography>
          </Alert>
        )}

        {/* Controls row */}
        <SCard sx={{ mb: '16px' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>

              <Box>
                <Typography sx={LabelSx}>Barangay <span style={{ color: T.danger }}>*</span></Typography>
                <Select value={selectedBarangay} size="small" sx={SelectSx} onChange={(e) => setSelectedBarangay(e.target.value)} displayEmpty>
                  <MenuItemComponent value={ALL_BARANGAYS} sx={{ fontSize: 13 }}>All Barangays</MenuItemComponent>
                  {availableBarangays.length > 0
                    ? availableBarangays.map(b => <MenuItemComponent key={b} value={b} sx={{ fontSize: 13 }}>{b}</MenuItemComponent>)
                    : <MenuItemComponent value={selectedBarangay} disabled={!selectedBarangay} sx={{ fontSize: 13 }}>{selectedBarangay || 'No barangay loaded'}</MenuItemComponent>
                  }
                </Select>
              </Box>

              <Box>
                <Typography sx={LabelSx}>Disease <span style={{ color: T.danger }}>*</span></Typography>
                <Select value={selectedDisease} size="small" sx={SelectSx} onChange={(e) => setSelectedDisease(e.target.value)}>
                  <MenuItemComponent value="all" sx={{ fontSize: 13 }}>All Diseases</MenuItemComponent>
                  {availableDiseases.map(col => {
                    const info = getDiseaseInfo(col);
                    return <MenuItemComponent key={col} value={col} sx={{ fontSize: 13 }}>{info.icon} {info.label}</MenuItemComponent>;
                  })}
                </Select>
              </Box>

              <Box>
                <Typography sx={LabelSx}>Forecast Horizon</Typography>
                <Select value={forecastHorizon} size="small" sx={{ ...SelectSx, minWidth: 170 }} onChange={(e) => setForecastHorizon(e.target.value)}>
                  <MenuItemComponent value="1" sx={{ fontSize: 13 }}>1 Month Ahead</MenuItemComponent>
                  <MenuItemComponent value="3" sx={{ fontSize: 13 }}>3 Months Ahead</MenuItemComponent>
                  <MenuItemComponent value="6" sx={{ fontSize: 13 }}>6 Months Ahead</MenuItemComponent>
                </Select>
              </Box>

              <Button variant="contained" onClick={() => handleGenerateForecast(forecastHorizon)}
                disabled={forecastLoading || !uploadedFile}
                startIcon={forecastLoading ? <CircularProgress size={14} color="inherit" /> : <PsychologyIcon sx={{ fontSize: 16 }} />}
                sx={{
                  backgroundColor: T.blue, color: '#fff', textTransform: 'none',
                  fontWeight: 600, fontSize: 13, borderRadius: '8px', px: 2.5, py: 1,
                  boxShadow: '0 2px 10px rgba(27,79,138,0.25)',
                  '&:hover': { backgroundColor: T.blueMid }, '&:disabled': { opacity: 0.55 },
                }}>
                {forecastLoading ? 'Generating…' : 'Generate Forecast'}
              </Button>
            </Box>
          </CardContent>
        </SCard>

        {/* Loading */}
        {forecastLoading && (
          <Box sx={{ mb: 2.5 }}>
            <LinearProgress sx={{ borderRadius: 2, height: 3, backgroundColor: T.borderSoft, '& .MuiLinearProgress-bar': { backgroundColor: T.blue } }} />
            <Typography sx={{ fontSize: 11, color: T.textMuted, mt: 0.75, textAlign: 'center' }}>
              Training LSTM model for {selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : selectedBarangay}… (30–60 seconds)
            </Typography>
          </Box>
        )}

        {forecastError && <Alert severity="error" sx={{ mb: 2.5, borderRadius: '10px', fontSize: 13 }}>{forecastError}</Alert>}

        {/* Empty state */}
        {!forecastData && !forecastLoading && uploadedFile && (
          <SCard sx={{ mb: '16px' }}>
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textHead, mb: 0.5, mt: 1, letterSpacing: '-0.2px' }}>
                  Configure your forecast settings above
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: T.textMuted, mb: 3, maxWidth: 400, lineHeight: 1.7 }}>
                  Set your preferred barangay, disease, and forecast horizon, then click{' '}
                  <strong style={{ color: T.textHead }}>Generate Forecast</strong> to begin.
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, width: '100%', maxWidth: 500, justifyContent: 'center' }}>
                  {[
                    { num: '1', label: 'Select Barangay',   sub: 'Required',           active: true  },
                    { num: '2', label: 'Choose Disease',    sub: 'Optional',           active: false },
                    { num: '3', label: 'Set Horizon',       sub: 'Optional',           active: false },
                    { num: '4', label: 'Generate Forecast', sub: 'Click button above', active: false },
                  ].map((s, i, arr) => (
                    <Box key={s.num} sx={{ display: 'flex', alignItems: 'center', flex: i < arr.length - 1 ? 1 : 'unset' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90 }}>
                        <Box sx={{
                          width: 28, height: 28, borderRadius: '50%', mb: 0.75,
                          backgroundColor: s.active ? T.blue : T.borderSoft,
                          color: s.active ? '#fff' : T.textMuted,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700,
                        }}>{s.num}</Box>
                        <Typography sx={{ fontSize: 11, fontWeight: 600, color: s.active ? T.blue : T.textBody, lineHeight: 1.3 }}>{s.label}</Typography>
                        <Typography sx={{ fontSize: 10, color: s.active ? T.blue : T.textFaint, opacity: s.active ? 1 : 0.8 }}>{s.sub}</Typography>
                      </Box>
                      {i < arr.length - 1 && <Box sx={{ flex: 1, height: '1px', backgroundColor: T.borderSoft, mb: '22px', mx: 0.5 }} />}
                    </Box>
                  ))}
                </Box>
                <Typography sx={{ fontSize: 11.5, color: T.textFaint }}>Selecting a barangay is required — disease and horizon have defaults.</Typography>
              </Box>
            </CardContent>
          </SCard>
        )}

        {/* Stale warning */}
        {forecastData && displayedBarangay && (displayedBarangay !== selectedBarangay || displayedHorizon !== forecastHorizon) && (
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.25, mb: '12px', borderRadius: '8px', backgroundColor: T.warnBg, border: `1px solid ${T.warnBorder}` }}>
            <InfoOutlinedIcon sx={{ fontSize: 14, color: T.warnAccent, flexShrink: 0, mr: 1 }} />
            <Typography sx={{ fontSize: 12.5, color: T.textBody }}>
              Showing forecast for <strong>{displayedBarangay === ALL_BARANGAYS ? 'All Barangays' : displayedBarangay}</strong>
              {displayedHorizon !== forecastHorizon ? ` (${displayedHorizon}-month)` : ''}
              {' '}— click <strong>Generate Forecast</strong> to update to <strong>{selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : selectedBarangay}</strong>
              {displayedHorizon !== forecastHorizon ? ` (${forecastHorizon}-month)` : ''}.
            </Typography>
          </Box>
        )}

        {/* Up to date */}
        {forecastData && displayedBarangay && displayedBarangay === selectedBarangay && displayedHorizon === forecastHorizon && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, mb: '12px', borderRadius: '8px', backgroundColor: T.okBg, border: `1px solid ${T.okBorder}` }}>
            <CheckCircleIcon sx={{ fontSize: 14, color: T.ok }} />
            <Typography sx={{ fontSize: 12.5, color: T.textBody }}>
              Showing forecast for <strong>{displayedBarangay === ALL_BARANGAYS ? 'All Barangays' : displayedBarangay}</strong> · {displayedHorizon}-month horizon
            </Typography>
          </Box>
        )}

        {/* Stat cards */}
        {stats && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', mb: '16px' }}>
            <SCard sx={{ borderTop: `3px solid ${T.blue}` }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: T.textMuted }}>Next Period Forecast</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: T.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PsychologyIcon sx={{ fontSize: 15, color: T.blue }} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, color: T.textHead, lineHeight: 1, mb: 0.5, letterSpacing: '-0.5px' }}>{stats.nextVal.toLocaleString()}</Typography>
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>{stats.diseaseLabel} ({forecastHorizon}mo ahead)</Typography>
              </CardContent>
            </SCard>

            <SCard sx={{ borderTop: `3px solid ${trendColor(stats.trend)}` }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: T.textMuted }}>Trend Indicator</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: trendBg(stats.trend), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {stats.trend === 'increasing' ? <TrendingUpSmallIcon sx={{ fontSize: 15, color: T.danger }} />
                      : stats.trend === 'decreasing' ? <TrendingDownIcon sx={{ fontSize: 15, color: T.ok }} />
                      : <RemoveIcon sx={{ fontSize: 15, color: T.textMuted }} />}
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1, mb: 0.5, letterSpacing: '-0.5px', color: trendColor(stats.trend) }}>{stats.pct}</Typography>
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>
                  {stats.trend === 'increasing' ? 'Increasing from last period' : stats.trend === 'decreasing' ? 'Decreasing from last period' : 'Stable from last period'}
                </Typography>
              </CardContent>
            </SCard>

            <SCard sx={{ borderTop: `3px solid ${getConfidenceColor(stats.confidence)}` }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: T.textMuted }}>Model Confidence</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: T.okBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircleIcon sx={{ fontSize: 15, color: T.ok }} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1, mb: 0.5, letterSpacing: '-0.5px', color: getConfidenceColor(stats.confidence) }}>{stats.confidence}%</Typography>
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>Prediction accuracy</Typography>
              </CardContent>
            </SCard>
          </Box>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <SCard sx={{ mb: '16px' }}>
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2 } }}>
              <CardHead
                title={`Predicted Trend — ${selectedDisease === 'all' ? 'All Diseases (Combined)' : getDiseaseInfo(selectedDisease).label}`}
                right={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Tag label="Actual vs Predicted" bg={T.blueDim} color={T.blue} border="rgba(27,79,138,0.18)" />
                    {forecastData && !forecastLoading && (
                      <Tooltip title="Download Report" placement="top">
                        <IconButton
                          size="small"
                          onClick={handleExportReport}
                          sx={{
                            width: 20, height: 20, borderRadius: '4px',
                            border: `1px solid ${T.borderSoft}`,
                            color: T.textMuted,
                            '&:hover': { borderColor: T.border, color: T.textBody, backgroundColor: T.rowBg },
                          }}
                        >
                          <DownloadIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                }
              />
              <ResponsiveContainer width="100%" height={265}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                  <YAxis axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                  <Legend formatter={(v) => v === 'actual' ? 'Actual Cases' : 'Predicted Cases'} wrapperStyle={{ paddingTop: 12, fontSize: 11 }} />
                  <Bar dataKey="actual" fill={T.blue} name="actual" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Line type="monotone" dataKey="predicted" stroke={T.danger} name="predicted"
                    strokeWidth={2.5} strokeDasharray="6 3" dot={{ fill: T.danger, r: 4, strokeWidth: 0 }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>

              {/* Key Insights */}
              {insights.length > 0 && (
                <Box sx={{ mt: 2.5, p: 2, backgroundColor: T.rowBg, borderRadius: '8px', border: `1px solid ${T.borderSoft}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <LightbulbIcon sx={{ fontSize: 14, color: T.blue }} />
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.textHead }}>Key Insights</Typography>
                    <Tag
                      label={selectedDisease === 'all' ? `${activeDiseases.length} diseases` : getDiseaseInfo(selectedDisease).label}
                      bg={T.blueDim} color={T.blue} border="rgba(27,79,138,0.18)"
                    />
                  </Box>

                  {insights.map((insight, i) => (
                    <Box key={i} sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 0.75,
                      p: 1.25, borderRadius: '7px',
                      backgroundColor: insightBg(insight.type),
                      border: `1px solid ${insightBorder(insight.type)}`,
                    }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: insightDot(insight.type), mt: 0.6, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 12, color: T.textBody, lineHeight: 1.5, flex: 1 }}>{insight.text}</Typography>

                      {insight.detailsPayload && (
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDetails(insight)}
                          sx={{
                            ml: 0.5, flexShrink: 0, p: 0.4,
                            color: T.textFaint,
                            '&:hover': { color: T.blue, backgroundColor: T.blueDim },
                          }}
                        >
                          <OpenInNewIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </SCard>
        )}

      </Box>

      {/* ── Details Dialog ── */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '12px', border: `1px solid ${T.border}` } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: T.textHead, pb: 1 }}>Prediction Details</DialogTitle>
        <Box sx={{ borderBottom: `1px solid ${T.borderSoft}`, mx: 3 }} />
        {detailsData && (
          <DialogContent sx={{ pt: 2.5 }}>
            <Typography sx={{ fontSize: 11, color: T.textMuted }}>Disease</Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: T.textHead, mb: 2 }}>
              {detailsData.label} — {detailsData.period}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
              {[
                { k: 'Created Date & Time', v: detailsData.createdAt },
                { k: 'Data Source',         v: detailsData.fileName  },
                { k: 'Model Used',          v: 'LSTM Neural Network' },
                { k: 'Forecast Horizon',    v: detailsData.forecastHorizon },
              ].map(row => (
                <Box key={row.k}>
                  <Typography sx={{ fontSize: 11, color: T.textMuted }}>{row.k}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>{row.v}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ borderTop: `1px solid ${T.borderSoft}`, my: 2 }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
              <Box>
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>Next Period Predicted Value</Typography>
                <Typography sx={{ fontSize: 28, fontWeight: 700, color: T.blue }}>{detailsData.predictedValue.toLocaleString()}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: T.textMuted, mb: 0.75 }}>Confidence Level</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress variant="determinate" value={detailsData.confidence}
                    sx={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: T.borderSoft, '& .MuiLinearProgress-bar': { backgroundColor: getConfidenceColor(detailsData.confidence), borderRadius: 3 } }} />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.textHead }}>{detailsData.confidence}%</Typography>
                </Box>
              </Box>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 11, color: T.textMuted, mb: 0.75 }}>Trend</Typography>
              <TrendTag trend={detailsData.trend} />
            </Box>
            <Box sx={{ borderTop: `1px solid ${T.borderSoft}`, my: 2 }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.textHead, mb: 1.25 }}>All Key Insights</Typography>
            {(detailsData.insights || []).map((ins, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 0.75 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: T.blue, mt: 0.7, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12, color: T.textMuted }}>{ins.text || ins}</Typography>
              </Box>
            ))}
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDetailsOpen(false)}
            sx={{ borderRadius: '8px', textTransform: 'none', fontSize: 13, color: T.textMuted, border: `1px solid ${T.border}`, px: 2 }}>
            Close
          </Button>
          <Button variant="contained" startIcon={<DownloadIcon sx={{ fontSize: 15 }} />}
            onClick={handleExportDiseaseReport}
            sx={{ borderRadius: '8px', textTransform: 'none', fontSize: 13, fontWeight: 600, backgroundColor: T.blue, '&:hover': { backgroundColor: T.blueMid }, px: 2 }}>
            Download Report
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Prediction;
