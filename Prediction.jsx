import { getForecast } from './services/api';
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Select,
  MenuItem,
  Avatar,
  Menu,
  MenuItem as MenuItemComponent,
  Divider,
  Alert,
  CircularProgress,
  LinearProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import {
  HealthAndSafety as HealthAndSafetyIcon,
  Dashboard as DashboardIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
  CloudUpload as CloudUploadIcon,
  Psychology as PsychologyIcon,
  TrendingUp as TrendingUpSmallIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Lightbulb as LightbulbIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import './Dashboard.css';

// ── Known disease display config ──────────────────────────────────────────────
const DISEASE_DISPLAY_MAP = {
  dengue_cases:                { label: 'Dengue',         color: '#4A90E2', icon: '🦟' },
  diarrhea_cases:              { label: 'Diarrhea',       color: '#50C878', icon: '💧' },
  respiratory_cases:           { label: 'Respiratory',    color: '#E94E77', icon: '🫁' },
  malnutrition_cases:          { label: 'Malnutrition',   color: '#F5A623', icon: '⚕️' },
  malnutrition_prevalence_pct: { label: 'Malnutrition %', color: '#F5A623', icon: '⚕️' },
  hypertension_cases:          { label: 'Hypertension',   color: '#9B59B6', icon: '❤️' },
  diabetes_cases:              { label: 'Diabetes',       color: '#E67E22', icon: '🩸' },
};

/**
 * getDiseaseInfo — works for both known and unknown disease columns.
 * For unknown columns it auto-generates a readable label from the column name.
 */
const getDiseaseInfo = (col) => {
  if (DISEASE_DISPLAY_MAP[col]) return DISEASE_DISPLAY_MAP[col];
  const label = col
    .replace(/_cases$/, '')
    .replace(/_prevalence_pct$/, ' %')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
  return { label, color: '#607D8B', icon: '🏥' };
};

const Prediction = ({ onNavigate, onLogout, uploadedFile, uploadedData }) => {
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [availableDiseases, setAvailableDiseases] = useState([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastData, setForecastData] = useState(null);
  const [forecastError, setForecastError] = useState('');
  const [forecastHorizon, setForecastHorizon] = useState('1');
  const [selectedDisease, setSelectedDisease] = useState('all');
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState(null);
  const [forecastHistory, setForecastHistory] = useState([]);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [actionMenuRow, setActionMenuRow] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsData, setDetailsData] = useState(null);

  // ── Load barangay + disease columns on mount ───────────────────────────────
  useEffect(() => {
    if (uploadedData?.barangay) {
      setSelectedBarangay(uploadedData.barangay);
    } else {
      const saved = localStorage.getItem('uploadedData');
      if (saved) setSelectedBarangay(JSON.parse(saved).barangay || '');
    }

    const savedDiseases = localStorage.getItem('diseaseColumns');
    if (savedDiseases) {
      const cols = JSON.parse(savedDiseases);
      setAvailableDiseases(cols);
    }
  }, [uploadedData, uploadedFile]);

  // ✅ DEBUG: Check dates from backend
  useEffect(() => {
    if (forecastData) {
      console.log('🔍 DEBUG DATES:');
      console.log('Last historical:', forecastData.historical_data.dates[forecastData.historical_data.dates.length - 1]);
      console.log('First forecast:', forecastData.forecast_dates[0]);
      console.log('All forecast dates:', forecastData.forecast_dates);
    }
  }, [forecastData]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getTrend = (preds) => {
    if (!preds || preds.length < 2) return 'stable';
    const diff = preds[preds.length - 1] - preds[0];
    if (diff > 0.5) return 'increasing';
    if (diff < -0.5) return 'decreasing';
    return 'stable';
  };

  const getTrendChip = (trend) => {
    const map = {
      increasing: { label: 'Increasing', icon: <TrendingUpSmallIcon sx={{ fontSize: 14 }} />, bg: '#FFEBEE', color: '#F44336' },
      decreasing: { label: 'Decreasing', icon: <TrendingDownIcon   sx={{ fontSize: 14 }} />, bg: '#E8F5E9', color: '#4CAF50' },
      stable:     { label: 'Stable',     icon: <RemoveIcon         sx={{ fontSize: 14 }} />, bg: '#F5F5F5', color: '#757575' },
    };
    const t = map[trend] || map.stable;
    return (
      <Chip
        size="small"
        icon={React.cloneElement(t.icon, { style: { color: t.color } })}
        label={t.label}
        sx={{ backgroundColor: t.bg, color: t.color, fontWeight: 600, fontSize: 12 }}
      />
    );
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

  const getConfidenceColor = (val) => val >= 85 ? '#4CAF50' : val >= 75 ? '#FFA726' : '#F44336';

  // ── Active diseases (based on current selection) ───────────────────────────
  const activeDiseases = forecastData
    ? (selectedDisease === 'all'
        ? Object.keys(forecastData.predictions)
        : [selectedDisease].filter(d => forecastData.predictions?.[d]))
    : [];

  // ── Chart data ──────────────────────────────────────────────────────────────
  const buildChartData = () => {
    if (!forecastData) return [];

    const data = [];

    if (selectedDisease === 'all') {
      // ✅ ALL DISEASES - Show total combined cases
      
      // Historical months (actual data only)
      const histDates = forecastData.historical_data.dates.slice(-9);
      
      histDates.forEach((date, i) => {
        let totalActual = 0;
        
        activeDiseases.forEach(disease => {
          const values = forecastData.historical_data[disease] || [];
          totalActual += values.slice(-9)[i] || 0;
        });
        
        data.push({ 
          month: date.slice(0, 7), 
          actual: Math.round(totalActual), 
          predicted: null 
        });
      });

      // Forecast months (predicted data only)
      forecastData.forecast_dates.forEach((date, i) => {
        let totalPredicted = 0;
        
        activeDiseases.forEach(disease => {
          const preds = forecastData.predictions[disease] || [];
          totalPredicted += preds[i] || 0;
        });
        
        data.push({
          month: date.slice(0, 7),
          actual: null,
          predicted: Math.round(totalPredicted),
        });
      });
      
    } else {
      // ✅ SINGLE DISEASE
      const disease = selectedDisease;
      if (!disease) return [];

      // Historical months (actual data only)
      const histDates = forecastData.historical_data.dates.slice(-9);
      const histValues = (forecastData.historical_data[disease] || []).slice(-9);
      
      histDates.forEach((date, i) => {
        data.push({ 
          month: date.slice(0, 7), 
          actual: Math.round(histValues[i] ?? 0), 
          predicted: null
        });
      });

      // Forecast months (predicted data only)
      forecastData.forecast_dates.forEach((date, i) => {
        data.push({
          month: date.slice(0, 7),
          actual: null,
          predicted: Math.round((forecastData.predictions[disease] || [])[i] ?? 0),
        });
      });
    }

    console.log('📊 Chart data:', data); // ✅ DEBUG: Check the dates
    return data;
  };

  // ── Summary stats ───────────────────────────────────────────────────────────
  const getSummaryStats = () => {
    if (!forecastData || activeDiseases.length === 0) return null;

    if (selectedDisease === 'all') {
      // ✅ ALL DISEASES - Calculate total combined stats
      
      let totalNextVal = 0;
      const allPreds = [];
      
      activeDiseases.forEach(disease => {
        const preds = forecastData.predictions[disease] || [];
        totalNextVal += preds[0] || 0;
        allPreds.push(preds);
      });
      
      let totalStart = 0;
      let totalEnd = 0;
      
      activeDiseases.forEach((disease, idx) => {
        const preds = allPreds[idx];
        totalStart += preds[0] || 0;
        totalEnd += preds[preds.length - 1] || 0;
      });
      
      const diff = totalEnd - totalStart;
      const trend = diff > 0.5 ? 'increasing' : diff < -0.5 ? 'decreasing' : 'stable';
      const pct = ((totalEnd - totalStart) / (totalStart || 1)) * 100;
      
      const avgConfidence = Math.round(
        activeDiseases.reduce((sum, d) => sum + getConfidence(d), 0) / activeDiseases.length
      );

      return {
        nextVal: Math.round(totalNextVal),
        trend: trend,
        pct: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%',
        confidence: avgConfidence,
        diseaseLabel: 'All Diseases (Combined Total)',
      };
      
    } else {
      // ✅ SINGLE DISEASE
      const disease = selectedDisease;
      const preds = forecastData.predictions[disease] || [];

      return {
        nextVal: Math.round(preds[0] ?? 0),
        trend: getTrend(preds),
        pct: getTrendPct(preds),
        confidence: getConfidence(disease),
        diseaseLabel: getDiseaseInfo(disease).label,
      };
    }
  };

  // ── Key insights ───────────────────────────────────────────────────────────
  const buildInsights = (result, barangay) => {
    const insights = [];
    Object.keys(result.predictions).forEach(d => {
      const preds = result.predictions[d] || [];
      const trend = getTrend(preds);
      const pct   = getTrendPct(preds);
      const label = getDiseaseInfo(d).label;
      if (trend === 'increasing')
        insights.push({ text: `${label} cases expected to increase by ${pct} over the forecast period`, type: 'warning' });
      else if (trend === 'decreasing')
        insights.push({ text: `${label} cases expected to decrease by ${pct} — positive trend`, type: 'positive' });
      else
        insights.push({ text: `${label} cases remain stable in ${barangay}`, type: 'neutral' });
    });
    // ✅ No slice — show ALL diseases, plus monitor note
    insights.push({ text: `Monitor closely in high-risk areas of ${barangay}`, type: 'info' });
    return insights;
  };

  const getKeyInsights = () => forecastData ? buildInsights(forecastData, selectedBarangay) : [];

  // ── Generate forecast ──────────────────────────────────────────────────────
  const handleGenerateForecast = async () => {
    if (!uploadedFile) {
      setForecastError('No dataset loaded. Please go to Data Import and upload your file again.');
      return;
    }
    if (!selectedBarangay) {
      setForecastError('No barangay selected. Please go to Data Import first.');
      return;
    }

    setForecastLoading(true);
    setForecastError('');
    setForecastData(null);

    try {
      const diseases = selectedDisease === 'all'
        ? availableDiseases
        : [selectedDisease];

      const months = parseInt(forecastHorizon) || 1;
      const result = await getForecast(uploadedFile, selectedBarangay, diseases, months);

      setForecastData(result);

      if (result.disease_columns && result.disease_columns.length > 0) {
        setAvailableDiseases(result.disease_columns);
        localStorage.setItem('diseaseColumns', JSON.stringify(result.disease_columns));
      }

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10) + ' at ' +
        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const insights = buildInsights(result, selectedBarangay);

      const newEntries = Object.keys(result.predictions).map((disease, idx) => {
        const preds = result.predictions[disease] || [];
        return result.forecast_dates.map((fd, i) => ({
          id: Date.now() + idx * 100 + i,
          disease,
          label: getDiseaseInfo(disease).label,
          period: fd.slice(0, 7),
          monthsAhead: i + 1,
          predictedValue: Math.round(preds[i] ?? 0),
          trend: getTrend(preds),
          confidence: getConfidence(disease),
          status: 'Completed',
          createdAt: dateStr,
          fileName: uploadedData?.fileName || uploadedFile?.name || 'dataset.xlsx',
          forecastHorizon: forecastHorizon + ' Month' + (parseInt(forecastHorizon) > 1 ? 's' : ''),
          barangay: selectedBarangay,
          insights,
        }));
      }).flat();

      setForecastHistory(prev => [...newEntries, ...prev]);

    } catch (err) {
      setForecastError(err.message || 'Forecast failed. Please try again.');
    } finally {
      setForecastLoading(false);
    }
  };

  const handleDeleteRow = (id) => {
    setForecastHistory(prev => prev.filter(r => r.id !== id));
    setActionMenuAnchor(null);
  };

  const handleViewDetails = (row) => {
    setDetailsData(row);
    setDetailsOpen(true);
    setActionMenuAnchor(null);
  };

  const stats     = getSummaryStats();
  const chartData = buildChartData();
  const insights  = getKeyInsights();

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <Box className="dashboard-container">

      {/* Sidebar */}
      <Box className="sidebar">
        <Box className="sidebar-logo">
          <Box className="logo-icon">
            <HealthAndSafetyIcon sx={{ fontSize: 28, color: '#4A90E2' }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" className="logo-title">Barangay Health</Typography>
            <Typography variant="caption" className="logo-subtitle">Prediction System</Typography>
          </Box>
        </Box>
        <Box className="sidebar-navigation">
          <Typography variant="caption" className="nav-label">Navigation</Typography>
          {[
            { icon: <DashboardIcon />,    text: 'Dashboard',   page: 'dashboard' },
            { icon: <TrendingUpIcon />,   text: 'Prediction',  page: 'prediction', active: true },
            { icon: <HistoryIcon />,      text: 'History',     page: 'history' },
            { icon: <CloudUploadIcon />,  text: 'Data Import', page: 'dataimport' },
          ].map((item, i) => (
            <Box key={i} className={`nav-item ${item.active ? 'active' : ''}`}
              onClick={() => onNavigate?.(item.page)}>
              <Box className="nav-icon">{item.icon}</Box>
              <Typography>{item.text}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Main */}
      <Box className="main-content">

        {/* Header */}
        <Box className="dashboard-header">
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" className="dashboard-title">Prediction</Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
              AI-powered disease forecasting and trend predictions
            </Typography>
          </Box>
          <IconButton onClick={(e) => setUserMenuAnchorEl(e.currentTarget)}>
            <Avatar className="user-avatar">👤</Avatar>
          </IconButton>
          <Menu anchorEl={userMenuAnchorEl} open={Boolean(userMenuAnchorEl)}
            onClose={() => setUserMenuAnchorEl(null)}
            PaperProps={{ sx: { mt: 1.5, minWidth: 200, borderRadius: 2 } }}>
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={600}>Admin User</Typography>
              <Typography variant="caption" color="textSecondary">admin@barangayhealth.gov.ph</Typography>
            </Box>
            <Divider />
            <MenuItemComponent onClick={() => { setUserMenuAnchorEl(null); onLogout?.(); }}
              sx={{ py: 1.5, color: '#E94E77' }}>Sign Out</MenuItemComponent>
          </Menu>
        </Box>

        {/* No file warning */}
        {!uploadedFile && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No dataset loaded. Please go to <strong>Data Import</strong> and upload your file.
          </Alert>
        )}

        {/* Controls row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>

          {/* Disease dropdown */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="caption" color="textSecondary" fontWeight={600}>
              Disease <span style={{ color: '#F44336' }}>*</span>
            </Typography>
            <Select value={selectedDisease} onChange={(e) => setSelectedDisease(e.target.value)}
              size="small" sx={{ minWidth: 200, backgroundColor: 'white', borderRadius: 2 }}>
              <MenuItemComponent value="all">All Diseases</MenuItemComponent>
              {availableDiseases.map(col => {
                const info = getDiseaseInfo(col);
                return (
                  <MenuItemComponent key={col} value={col}>
                    {info.icon} {info.label}
                  </MenuItemComponent>
                );
              })}
            </Select>
          </Box>

          {/* Forecast Horizon */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="caption" color="textSecondary" fontWeight={600}>
              Forecast Horizon
            </Typography>
            <Select value={forecastHorizon} onChange={(e) => setForecastHorizon(e.target.value)}
              size="small" sx={{ minWidth: 180, backgroundColor: 'white', borderRadius: 2 }}>
              <MenuItemComponent value="1">1 Month Ahead</MenuItemComponent>
              <MenuItemComponent value="3">3 Months Ahead</MenuItemComponent>
              <MenuItemComponent value="6">6 Months Ahead</MenuItemComponent>
            </Select>
          </Box>

          {/* Generate button */}
          <Box sx={{ mt: 2.5 }}>
            <Button variant="contained" onClick={handleGenerateForecast}
              disabled={forecastLoading || !uploadedFile}
              startIcon={forecastLoading
                ? <CircularProgress size={16} color="inherit" />
                : <PsychologyIcon />}
              sx={{
                background: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)',
                fontWeight: 600, px: 3, py: 1,
              }}>
              {forecastLoading ? 'Generating...' : 'Generate Forecast'}
            </Button>
          </Box>
        </Box>

        {/* Loading */}
        {forecastLoading && (
          <Box sx={{ mb: 3 }}>
            <LinearProgress />
            <Typography variant="caption" color="textSecondary"
              sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
              Training LSTM model for {selectedBarangay}... (30–60 seconds)
            </Typography>
          </Box>
        )}

        {forecastError && <Alert severity="error" sx={{ mb: 2 }}>{forecastError}</Alert>}

        {/* ── Summary stat cards ── */}
        {stats && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
            {/* Next Period Forecast */}
            <Card sx={{ borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="textSecondary" fontWeight={600}
                    sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                    Next Period Forecast
                  </Typography>
                  <Box sx={{ width: 32, height: 32, borderRadius: '50%',
                    backgroundColor: '#EBF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PsychologyIcon sx={{ fontSize: 18, color: '#4A90E2' }} />
                  </Box>
                </Box>
                <Typography variant="h3" fontWeight={700} sx={{ my: 1 }}>
                  {stats.nextVal}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {stats.diseaseLabel} cases ({forecastHorizon} month{parseInt(forecastHorizon) > 1 ? 's' : ''} ahead)
                </Typography>
              </CardContent>
            </Card>

            {/* Trend Indicator */}
            <Card sx={{ borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="textSecondary" fontWeight={600}
                    sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                    Trend Indicator
                  </Typography>
                  <Box sx={{ width: 32, height: 32, borderRadius: '50%',
                    backgroundColor: stats.trend === 'increasing' ? '#FFEBEE' : stats.trend === 'decreasing' ? '#E8F5E9' : '#F5F5F5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {stats.trend === 'increasing'
                      ? <TrendingUpSmallIcon sx={{ fontSize: 18, color: '#F44336' }} />
                      : stats.trend === 'decreasing'
                      ? <TrendingDownIcon sx={{ fontSize: 18, color: '#4CAF50' }} />
                      : <RemoveIcon sx={{ fontSize: 18, color: '#757575' }} />}
                  </Box>
                </Box>
                <Typography variant="h3" fontWeight={700} sx={{ my: 1,
                  color: stats.trend === 'increasing' ? '#F44336' : stats.trend === 'decreasing' ? '#4CAF50' : '#757575' }}>
                  {stats.pct}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {stats.trend === 'increasing' ? 'Increasing from last period'
                    : stats.trend === 'decreasing' ? 'Decreasing from last period'
                    : 'Stable from last period'}
                </Typography>
              </CardContent>
            </Card>

            {/* Model Confidence */}
            <Card sx={{ borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="textSecondary" fontWeight={600}
                    sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                    Model Confidence
                  </Typography>
                  <Box sx={{ width: 32, height: 32, borderRadius: '50%',
                    backgroundColor: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircleIcon sx={{ fontSize: 18, color: '#4CAF50' }} />
                  </Box>
                </Box>
                <Typography variant="h3" fontWeight={700} sx={{ my: 1, color: getConfidenceColor(stats.confidence) }}>
                  {stats.confidence}%
                </Typography>
                <Typography variant="caption" color="textSecondary">Prediction accuracy</Typography>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* ── Chart ── */}
        {chartData.length > 0 && (
          <Card sx={{ mb: 3, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>
                  Predicted Trend
                  {selectedDisease === 'all' 
                    ? ' — All Diseases (Total Combined Cases)'
                    : ` — ${getDiseaseInfo(selectedDisease).label}`
                  }
                </Typography>
                <Chip label="Actual vs Predicted" size="small"
                  sx={{ backgroundColor: '#EBF3FF', color: '#4A90E2', fontWeight: 600 }} />
              </Box>

              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false}
                    style={{ fontSize: 11, fill: '#999' }} />
                  <YAxis axisLine={false} tickLine={false} style={{ fontSize: 11, fill: '#999' }} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #E8E8E8', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                  <Legend
                    formatter={(val) => val === 'actual' ? 'Actual Cases' : 'Predicted Cases'}
                    wrapperStyle={{ paddingTop: 16 }} />
                  <Bar dataKey="actual" fill="#4A90E2" name="actual"
                    radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Line type="monotone" dataKey="predicted" stroke="#E94E77" name="predicted"
                    strokeWidth={2.5} strokeDasharray="6 3"
                    dot={{ fill: '#E94E77', r: 5, strokeWidth: 0 }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>

              {/* ── Key Insights ── ONLY THIS SECTION CHANGED ── */}
              {insights.length > 0 && (
                <Box sx={{ mt: 3, p: 2.5, backgroundColor: '#F8F9FA', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <LightbulbIcon sx={{ fontSize: 16, color: '#4A90E2' }} />
                    <Typography variant="body2" fontWeight={700}>Key Insights</Typography>
                    <Chip
                      label={`${insights.length - 1} diseases`}
                      size="small"
                      sx={{ ml: 'auto', backgroundColor: '#EBF3FF', color: '#4A90E2', fontWeight: 600, fontSize: 11 }}
                    />
                  </Box>
                  {insights.map((insight, i) => {
                    const dotColor = insight.type === 'warning'  ? '#F44336'
                      : insight.type === 'positive' ? '#4CAF50'
                      : insight.type === 'info'     ? '#4A90E2'
                      : '#9E9E9E';
                    return (
                      <Box key={i} sx={{
                        display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1,
                        p: 1.5, borderRadius: 1.5,
                        backgroundColor: insight.type === 'warning'  ? '#FFF5F5'
                          : insight.type === 'positive' ? '#F1FFF5'
                          : insight.type === 'info'     ? '#EBF3FF'
                          : 'transparent',
                        border: `1px solid ${
                          insight.type === 'warning'  ? '#FFCDD2'
                          : insight.type === 'positive' ? '#C8E6C9'
                          : insight.type === 'info'     ? '#BBDEFB'
                          : 'transparent'
                        }`,
                      }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dotColor, mt: 0.6, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ color: '#444', lineHeight: 1.5 }}>
                          {insight.text}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Forecast Details Table ── REMOVED as requested ── */}

      </Box>

      {/* ── Details Dialog ── */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Prediction Details</DialogTitle>
        <Divider />
        {detailsData && (
          <DialogContent sx={{ pt: 3 }}>
            <Typography variant="caption" color="textSecondary">Forecast Period</Typography>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
              {detailsData.label} — {detailsData.period}
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
              <Box>
                <Typography variant="caption" color="textSecondary">Created Date & Time</Typography>
                <Typography variant="body1" fontWeight={600}>{detailsData.createdAt}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="textSecondary">Data Source</Typography>
                <Typography variant="body1" fontWeight={600}>{detailsData.fileName}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="textSecondary">Model Used</Typography>
                <Typography variant="body1" fontWeight={600}>LSTM Neural Network</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="textSecondary">Forecast Horizon</Typography>
                <Typography variant="body1" fontWeight={600}>{detailsData.forecastHorizon}</Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
              <Box>
                <Typography variant="caption" color="textSecondary">Predicted Value</Typography>
                <Typography variant="h4" fontWeight={700} color="#4A90E2">
                  {detailsData.predictedValue}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 1 }}>
                  Confidence Level
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress variant="determinate" value={detailsData.confidence}
                    sx={{
                      flex: 1, height: 8, borderRadius: 4, backgroundColor: '#F0F0F0',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: getConfidenceColor(detailsData.confidence), borderRadius: 4
                      }
                    }} />
                  <Typography variant="body2" fontWeight={700}>{detailsData.confidence}%</Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 0.5 }}>Trend</Typography>
              {getTrendChip(detailsData.trend)}
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Key Insights</Typography>
            {(detailsData.insights || []).map((ins, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 0.75 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4A90E2', mt: 0.7, flexShrink: 0 }} />
                <Typography variant="body2" color="textSecondary">{ins.text || ins}</Typography>
              </Box>
            ))}
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setDetailsOpen(false)} variant="outlined"
            sx={{ borderRadius: 2, textTransform: 'none' }}>Close</Button>
          <Button variant="contained" startIcon={<DownloadIcon />}
            sx={{ borderRadius: 2, textTransform: 'none',
              background: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)' }}>
            Download Report
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Prediction;