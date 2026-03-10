import { getForecast } from './services/api';
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  Box, Typography, Card, CardContent, Button,
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
  OpenInNew as OpenInNewIcon,
  LocationOn as LocationOnIcon,
  FileDownload as FileDownloadIcon,
  InsertDriveFile as FileIcon,
  TableChart as TableChartIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Close as CloseIcon,
  CalendarMonth as CalendarMonthIcon,
} from '@mui/icons-material';
import { useRef } from 'react';
import Sidebar, { T } from './Sidebar';

const DISEASE_DISPLAY_MAP = {
  dengue_cases:                { label: 'Dengue',         color: T.blue        },
  diarrhea_cases:              { label: 'Diarrhea',       color: T.neutralBar  },
  respiratory_cases:           { label: 'Respiratory',    color: T.danger      },
  malnutrition_cases:          { label: 'Malnutrition',   color: T.neutralLight},
  malnutrition_prevalence_pct: { label: 'Malnutrition %', color: T.neutralLight},
  hypertension_cases:          { label: 'Hypertension',   color: T.neutralLight},
  diabetes_cases:              { label: 'Diabetes',       color: T.warnAccent  },
};

const getDiseaseInfo = (col) => {
  if (DISEASE_DISPLAY_MAP[col]) return DISEASE_DISPLAY_MAP[col];
  const label = col.replace(/_cases$/, '').replace(/_prevalence_pct$/, ' %').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return { label, color: T.neutralBar };
};

const SCard = ({ children, sx = {} }) => (
  <Card sx={{ borderRadius: '10px', backgroundColor: '#FFFFFF', border: `1px solid ${T.border}`, boxShadow: 'none', ...sx }}>
    {children}
  </Card>
);

const Tag = ({ label, bg, color, border }) => (
  <Chip label={label} size="small" sx={{ backgroundColor: bg, color, border: `1px solid ${border}`, fontWeight: 500, fontSize: 10.5, borderRadius: '4px', height: 20 }} />
);

const trendColor  = (t) => t === 'increasing' ? T.danger   : t === 'decreasing' ? T.ok   : T.textMuted;
const trendBg     = (t) => t === 'increasing' ? T.dangerBg : t === 'decreasing' ? T.okBg : '#F9FAFB';
const trendBorder = (t) => t === 'increasing' ? T.dangerBorder : t === 'decreasing' ? T.okBorder : T.borderSoft;

const TrendTag = ({ trend }) => {
  const labels = { increasing: '↑ Increasing', decreasing: '↓ Decreasing', stable: '— Stable' };
  return <Tag label={labels[trend] || '— Stable'} bg={trendBg(trend)} color={trendColor(trend)} border={trendBorder(trend)} />;
};

const ALL_BARANGAYS = '__ALL__';

// e.g. "2022-01" → "January" | "2022-01-15" → "January"
const formatMonthLabel = (period) => {
  if (!period) return period;
  const m = period.match(/^(\d{4})-(\d{2})/);
  if (m) {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const idx = parseInt(m[2], 10) - 1;
    return monthNames[idx] ?? period;
  }
  return period;
};

const getPeriodYear = (period) => {
  const m = period?.match(/^(\d{4})/);
  return m ? m[1] : null;
};

// ── Year Picker ────────────────────────────────────────────────────────────────
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

  const allYears = availableYears.length > 0 ? availableYears : [];

  return (
    <Box>
      <Button
        ref={btnRef}
        size="small"
        onClick={() => setPopupOpen(o => !o)}
        startIcon={<CalendarMonthIcon sx={{ fontSize: 13 }} />}
        sx={{
          textTransform: 'none', fontSize: 12, fontWeight: 600,
          color: popupOpen ? T.blue : T.textBody,
          border: `1.5px solid ${popupOpen ? T.blue : T.border}`,
          borderRadius: '8px', px: 1.75, py: '5px',
          backgroundColor: popupOpen ? T.blueDim : '#FFFFFF',
          '&:hover': { borderColor: T.blue, color: T.blue, backgroundColor: T.blueDim },
        }}>
        {selectedYear ? selectedYear : 'All Years'}
      </Button>

      {popupOpen && ReactDOM.createPortal(
        <>
          <Box onClick={() => setPopupOpen(false)} sx={{ position: 'fixed', inset: 0, zIndex: 1399, backgroundColor: 'rgba(0,0,0,0.28)' }} />
          <Box ref={el => { popupRef.current = el; }} sx={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1400, backgroundColor: '#FFFFFF',
            border: `1px solid ${T.border}`, borderRadius: '14px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
            width: 340,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.75, borderBottom: `1px solid ${T.borderSoft}`, backgroundColor: T.pageBg, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarMonthIcon sx={{ fontSize: 13, color: T.blue }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textHead }}>Select Year</Typography>
                {selectedYear && (
                  <Box sx={{ px: 1, py: 0.2, borderRadius: '4px', backgroundColor: T.blueDim, border: `1px solid rgba(27,79,138,0.2)` }}>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: T.blue }}>{selectedYear}</Typography>
                  </Box>
                )}
              </Box>
              <IconButton size="small" onClick={() => setPopupOpen(false)}
                sx={{ p: 0.4, color: T.textMuted, '&:hover': { color: T.textHead, backgroundColor: T.borderSoft } }}>
                <CloseIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Box>

            {/* Year grid */}
            <Box sx={{ p: 2.5 }}>
              {allYears.length === 0 ? (
                <Typography sx={{ fontSize: 12, color: T.textMuted, textAlign: 'center', py: 1 }}>
                  No years available. Generate forecasts first.
                </Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {/* All Years tile */}
                  <Box
                    onClick={() => { onSelect(null); setPopupOpen(false); }}
                    sx={{
                      py: '10px', px: 1, borderRadius: '8px',
                      border: `1.5px solid ${!selectedYear ? T.blue : T.border}`,
                      backgroundColor: !selectedYear ? T.blueDim : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      transition: 'all 0.13s', userSelect: 'none',
                      '&:hover': { borderColor: T.blue, backgroundColor: !selectedYear ? T.blueDim : 'rgba(27,79,138,0.04)' },
                    }}>
                    {!selectedYear
                      ? <CheckCircleIcon sx={{ fontSize: 11, color: T.blue, flexShrink: 0 }} />
                      : <CalendarMonthIcon sx={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }} />
                    }
                    <Typography sx={{ fontSize: 11.5, fontWeight: !selectedYear ? 600 : 400, color: !selectedYear ? T.blue : T.textBody }}>
                      All Years
                    </Typography>
                  </Box>
                  {/* Individual year tiles */}
                  {allYears.map(yr => {
                    const isSelected = selectedYear === yr;
                    return (
                      <Box key={yr}
                        onClick={() => { onSelect(yr); setPopupOpen(false); }}
                        sx={{
                          py: '10px', px: 1, borderRadius: '8px',
                          border: `1.5px solid ${isSelected ? T.blue : T.border}`,
                          backgroundColor: isSelected ? T.blueDim : '#FFFFFF',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                          transition: 'all 0.13s', userSelect: 'none',
                          '&:hover': { borderColor: T.blue, backgroundColor: isSelected ? T.blueDim : 'rgba(27,79,138,0.04)' },
                        }}>
                        {isSelected
                          ? <CheckCircleIcon sx={{ fontSize: 11, color: T.blue, flexShrink: 0 }} />
                          : <CalendarMonthIcon sx={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }} />
                        }
                        <Typography sx={{ fontSize: 11.5, fontWeight: isSelected ? 600 : 400, color: isSelected ? T.blue : T.textBody }}>
                          {yr}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>

            {/* Footer */}
            <Box sx={{ px: 2.5, py: 1.75, borderTop: `1px solid ${T.borderSoft}`, display: 'flex', justifyContent: 'flex-end', backgroundColor: T.pageBg, flexShrink: 0 }}>
              <Button size="small" onClick={() => setPopupOpen(false)}
                sx={{ textTransform: 'none', fontSize: 12, color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: '7px', px: 1.75, py: 0.5, backgroundColor: '#FFF', '&:hover': { backgroundColor: T.borderSoft } }}>
                Close
              </Button>
            </Box>
          </Box>
        </>
      , document.body)}
    </Box>
  );
};

// ── Exports ────────────────────────────────────────────────────────────────────
const exportDiseaseReport = (detailsData, forecastData, barangayLabel, cityLabel = '') => {
  if (!detailsData || !forecastData) return;
  const lines = []; const d = detailsData.disease; const preds = forecastData.predictions[d] || []; const info = getDiseaseInfo(d);
  lines.push('PREDICTHEALTH — DISEASE FORECAST REPORT'); lines.push('='.repeat(48));
  lines.push(`Generated  : ${new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}`);
  if (cityLabel) lines.push(`City       : ${cityLabel}`);
  lines.push(`Barangay   : ${barangayLabel}`); lines.push(`Disease    : ${info.label}`);
  lines.push(`Confidence : ${detailsData.confidence}%`); lines.push('');
  forecastData.forecast_dates.forEach((date, i) => {
    lines.push(`  ${date}  →  ${Math.round(preds[i] ?? 0).toLocaleString()} cases${i === 0 ? ' ← next period' : ''}`);
  });
  lines.push(''); (detailsData.insights || []).forEach(ins => lines.push(`  • ${ins.text}`));
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `forecast_${info.label.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click(); URL.revokeObjectURL(url);
};

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
    const periods = Object.keys(lookup[barangay] || {}).sort();
    periods.forEach(period => {
      const diseaseMap = lookup[barangay][period] || {};
      const diseaseVals = Object.fromEntries(diseases.map(d => [getDiseaseInfo(d).label, diseaseMap[d]?.predictedValue ?? 0]));
      const total = diseases.reduce((s, d) => s + (diseaseVals[getDiseaseInfo(d).label] || 0), 0);
      const trendCount = { increasing: 0, decreasing: 0, stable: 0 };
      diseases.forEach(d => { const t = diseaseMap[d]?.trend || 'stable'; trendCount[t] = (trendCount[t] || 0) + 1; });
      const rowTrend = Object.entries(trendCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'stable';
      rows.push({ barangay, period, ...diseaseVals, total, trend: rowTrend });
    });
  });

  if (format === 'csv') {
    const headers = ['Barangay', 'Month', ...diseases.map(d => getDiseaseInfo(d).label), 'Total Predicted', 'Overall Trend'];
    const csvRows = [headers.join(','), ...rows.map(r => [r.barangay, r.period, ...diseases.map(d => r[getDiseaseInfo(d).label] || 0), r.total, r.trend].join(','))];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `forecast_table_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  } else {
    const lines = ['PREDICTHEALTH — BARANGAY FORECAST TABLE', '='.repeat(60)];
    if (cityLabel) lines.push(`City      : ${cityLabel}`);
    lines.push(`Generated : ${new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}`, '');
    const headers = ['Barangay', 'Month', ...diseases.map(d => getDiseaseInfo(d).label), 'Total', 'Trend'];
    lines.push(headers.join(' | ')); lines.push('-'.repeat(60));
    rows.forEach(r => lines.push([r.barangay, r.period, ...diseases.map(d => (r[getDiseaseInfo(d).label] || 0).toLocaleString()), r.total.toLocaleString(), r.trend].join(' | ')));
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `forecast_table_${new Date().toISOString().slice(0, 10)}.txt`; a.click(); URL.revokeObjectURL(url);
  }
};

// ── Export dropdown ────────────────────────────────────────────────────────────
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
          <Button
            onClick={() => !disabled && setOpen(o => !o)}
            disabled={disabled}
            startIcon={<FileDownloadIcon sx={{ fontSize: 14 }} />}
            endIcon={<ArrowDownIcon sx={{ fontSize: 13, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />}
            sx={{
              textTransform: 'none', fontSize: 12, fontWeight: 500,
              color: T.textMuted, backgroundColor: '#FFFFFF',
              border: `1px solid ${T.border}`, borderRadius: '8px', px: 1.5, py: '6px',
              '&:hover': { backgroundColor: T.borderSoft, borderColor: T.blue, color: T.blue },
              '&:disabled': { opacity: 0.4 },
            }}>
            Export
          </Button>
        </span>
      </Tooltip>
      {open && (
        <Box sx={{ position: 'fixed', zIndex: 1400, backgroundColor: '#FFFFFF', border: `1px solid ${T.border}`, borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 170, overflow: 'hidden' }}
          ref={el => {
            if (el && ref.current) {
              const btn = ref.current.getBoundingClientRect();
              el.style.top = (btn.bottom + 6) + 'px';
              el.style.right = (window.innerWidth - btn.right) + 'px';
            }
          }}>
          {[{ format: 'csv', label: 'Export as CSV' }, { format: 'txt', label: 'Export as TXT' }].map(opt => (
            <Box key={opt.format}
              onClick={() => { exportTableData(opt.format, forecastHistory, confirmedBarangays, availableDiseases, cityLabel); setOpen(false); }}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.125, cursor: 'pointer', '&:hover': { backgroundColor: T.borderSoft } }}>
              <FileIcon sx={{ fontSize: 14, color: T.textMuted }} />
              <Typography sx={{ fontSize: 12.5, color: T.textBody }}>{opt.label}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

// ── Barangay Picker ────────────────────────────────────────────────────────────
const BarangayPicker = ({ availableBarangays, generatedBarangays, pending, onPendingChange, onConfirm, confirmed }) => {
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

  const selectableBarangays = availableBarangays.filter(b => generatedBarangays.has(b));
  const allSelected = selectableBarangays.length > 0 && selectableBarangays.every(b => pending.has(b));

  const toggle = (b) => {
    if (!generatedBarangays.has(b)) return;
    const next = new Set(pending);
    next.has(b) ? next.delete(b) : next.add(b);
    onPendingChange(next);
  };

  const handleConfirm = () => {
    onConfirm(pending);
    setPopupOpen(false);
  };

  return (
    <Box>
      <Button
        ref={btnRef}
        size="small"
        onClick={() => setPopupOpen(o => !o)}
        startIcon={<LocationOnIcon sx={{ fontSize: 13 }} />}
        sx={{
          textTransform: 'none', fontSize: 12, fontWeight: 600,
          color: popupOpen ? T.blue : T.textBody,
          border: `1.5px solid ${popupOpen ? T.blue : T.border}`,
          borderRadius: '8px', px: 1.75, py: '5px',
          backgroundColor: popupOpen ? T.blueDim : '#FFFFFF',
          '&:hover': { borderColor: T.blue, color: T.blue, backgroundColor: T.blueDim },
        }}>
        {confirmed.size > 0
          ? `${confirmed.size} Barangay${confirmed.size > 1 ? 's' : ''} Selected`
          : 'Select Barangay'}
      </Button>

      {popupOpen && ReactDOM.createPortal(
        <>
          <Box onClick={() => setPopupOpen(false)} sx={{ position: 'fixed', inset: 0, zIndex: 1399, backgroundColor: 'rgba(0,0,0,0.28)' }} />
          <Box ref={el => { popupRef.current = el; }} sx={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1400, backgroundColor: '#FFFFFF',
            border: `1px solid ${T.border}`, borderRadius: '14px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
            width: 780,
            display: 'flex', flexDirection: 'column', overflow: 'visible',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.75, borderBottom: `1px solid ${T.borderSoft}`, backgroundColor: T.pageBg, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocationOnIcon sx={{ fontSize: 13, color: T.blue }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textHead }}>Select Barangay</Typography>
                {pending.size > 0 && (
                  <Box sx={{ px: 1, py: 0.2, borderRadius: '4px', backgroundColor: T.blueDim, border: `1px solid rgba(27,79,138,0.2)` }}>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: T.blue }}>{pending.size} selected</Typography>
                  </Box>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {selectableBarangays.length > 0 && (
                  <Typography onClick={() => onPendingChange(allSelected ? new Set() : new Set(selectableBarangays))}
                    sx={{ fontSize: 11.5, color: T.blue, cursor: 'pointer', userSelect: 'none', '&:hover': { opacity: 0.7 } }}>
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </Typography>
                )}
                <IconButton size="small" onClick={() => setPopupOpen(false)}
                  sx={{ p: 0.4, color: T.textMuted, '&:hover': { color: T.textHead, backgroundColor: T.borderSoft } }}>
                  <CloseIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Box>
            </Box>

            {/* UPDATED: left-aligned barangay boxes, grid centered via wrapper */}
            <Box sx={{ p: 2.5, flex: 1 }}>
              {availableBarangays.length === 0 ? (
                <Typography sx={{ fontSize: 12, color: T.textMuted, py: 1, textAlign: 'center' }}>No barangays available.</Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                  {availableBarangays.map(b => {
                    const isGenerated = generatedBarangays.has(b);
                    const isSelected  = pending.has(b);
                    return (
                      <Tooltip key={b} title={!isGenerated ? 'Generate a forecast for this barangay first' : ''} placement="top">
                        <Box onClick={() => toggle(b)} sx={{
                          py: '8px', px: 1.25, borderRadius: '8px',
                          border: `1.5px solid ${isSelected ? T.blue : isGenerated ? T.border : T.borderSoft}`,
                          backgroundColor: isSelected ? T.blueDim : isGenerated ? '#FFFFFF' : '#F7F8FA',
                          cursor: isGenerated ? 'pointer' : 'not-allowed',
                          opacity: isGenerated ? 1 : 0.5,
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '5px',
                          transition: 'all 0.13s', userSelect: 'none',
                          '&:hover': isGenerated ? { borderColor: T.blue, backgroundColor: isSelected ? T.blueDim : 'rgba(27,79,138,0.04)' } : {},
                        }}>
                          {isSelected
                            ? <CheckCircleIcon sx={{ fontSize: 11, color: T.blue, flexShrink: 0 }} />
                            : <LocationOnIcon   sx={{ fontSize: 11, color: isGenerated ? T.textMuted : T.textFaint, flexShrink: 0 }} />
                          }
                          <Typography sx={{ fontSize: 11.5, fontWeight: isSelected ? 600 : 400, color: isSelected ? T.blue : isGenerated ? T.textBody : T.textFaint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {b}
                          </Typography>
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              )}
              {selectableBarangays.length === 0 && availableBarangays.length > 0 && (
                <Typography sx={{ fontSize: 11, color: T.textFaint, mt: 1.5 }}>
                  No barangays have forecasts yet. Go to <strong>Dashboard</strong> to generate forecasts first.
                </Typography>
              )}
              {pending.size === 0 && selectableBarangays.length > 0 && (
                <Typography sx={{ fontSize: 11, color: T.textFaint, mt: 1.5 }}>
                  Select one or more barangays, then click <strong>Confirm</strong>.
                </Typography>
              )}
            </Box>

            <Box sx={{ px: 2.5, py: 1.75, borderTop: `1px solid ${T.borderSoft}`, display: 'flex', justifyContent: 'flex-end', gap: 1, backgroundColor: T.pageBg, flexShrink: 0 }}>
              <Button size="small" onClick={() => setPopupOpen(false)}
                sx={{ textTransform: 'none', fontSize: 12, color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: '7px', px: 1.75, py: 0.5, backgroundColor: '#FFF', '&:hover': { backgroundColor: T.borderSoft } }}>
                Cancel
              </Button>
              <Button size="small" disabled={pending.size === 0} onClick={handleConfirm}
                startIcon={<TableChartIcon sx={{ fontSize: 12 }} />}
                sx={{ textTransform: 'none', fontSize: 12, fontWeight: 600, backgroundColor: T.blue, color: '#fff', borderRadius: '7px', px: 1.75, py: 0.5, '&:hover': { backgroundColor: T.blueMid }, '&:disabled': { backgroundColor: T.borderSoft, color: T.textFaint } }}>
                Confirm
              </Button>
            </Box>
          </Box>
        </>
      , document.body)}
    </Box>
  );
};

// ── Forecast Table ─────────────────────────────────────────────────────────────
const ForecastTable = ({ forecastHistory, confirmedBarangays, availableDiseases, selectedYear }) => {
  const diseases = availableDiseases.length > 0
    ? availableDiseases
    : [...new Set(forecastHistory.map(h => h.disease))];

  // Filter by year if selected
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

  const thSx = { fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 16px', textAlign: 'left', whiteSpace: 'nowrap', backgroundColor: T.pageBg, borderBottom: `1px solid ${T.border}` };
  const tdSx = { fontSize: 12.5, color: T.textBody, padding: '10px 16px', borderBottom: `1px solid ${T.borderSoft}`, verticalAlign: 'middle' };

  const rows = [];
  [...confirmedBarangays].forEach(barangay => {
    const periods = Object.keys(lookup[barangay] || {}).sort();
    periods.forEach((period, rowIdx) => {
      const diseaseMap = lookup[barangay][period] || {};
      const vals = diseases.map(d => diseaseMap[d]?.predictedValue ?? 0);
      const total = vals.reduce((s, v) => s + v, 0);
      const trendCount = { increasing: 0, decreasing: 0, stable: 0 };
      diseases.forEach(d => { const t = diseaseMap[d]?.trend || 'stable'; trendCount[t] = (trendCount[t] || 0) + 1; });
      const rowTrend = Object.entries(trendCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'stable';
      rows.push({ barangay, period, vals, total, rowTrend });
    });
  });

  if (rows.length === 0) return (
    <Box sx={{ py: 5, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>No forecast data found for the selected barangay(s).</Typography>
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
            {diseases.map(d => <th key={d} style={{ ...thSx, textAlign: 'right' }}>{getDiseaseInfo(d).label}</th>)}
            <th style={{ ...thSx, textAlign: 'right' }}>Total Predicted</th>
            <th style={{ ...thSx, textAlign: 'center' }}>Overall Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ barangay, period, vals, total, rowTrend }, i) => (
            <tr key={`${barangay}-${period}`} style={{ backgroundColor: '#FFFFFF' }}>
              <td style={{ ...tdSx, fontWeight: 600, color: T.textHead }}>{barangay}</td>
              <td style={{ ...tdSx, color: T.textMuted, fontWeight: 500 }}>{getPeriodYear(period)}</td>
              <td style={tdSx}>{formatMonthLabel(period)}</td>
              {vals.map((v, j) => <td key={diseases[j]} style={{ ...tdSx, textAlign: 'right' }}>{v.toLocaleString()}</td>)}
              <td style={{ ...tdSx, textAlign: 'right', fontWeight: 700, color: T.textHead }}>{total.toLocaleString()}</td>
              <td style={{ ...tdSx, textAlign: 'center' }}><TrendTag trend={rowTrend} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
};

// ── Main ───────────────────────────────────────────────────────────────────────
const Prediction = ({ onNavigate, onLogout, uploadedFile, uploadedData }) => {
  const [forecastData]                              = useState(() => {
    try { const s = localStorage.getItem('cachedForecastData'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [cachedBarangay]                            = useState(() => localStorage.getItem('cachedForecastBarangay') || ALL_BARANGAYS);
  const [availableBarangays, setAvailableBarangays] = useState([]);
  const [availableDiseases,  setAvailableDiseases]  = useState([]);
  const [forecastHistory,    setForecastHistory]    = useState([]);
  const [pendingBarangays,   setPendingBarangays]   = useState(new Set());
  const [confirmedBarangays, setConfirmedBarangays] = useState(new Set());
  const [selectedYear,       setSelectedYear]       = useState(null);
  const [detailsOpen,        setDetailsOpen]        = useState(false);
  const [detailsData,        setDetailsData]        = useState(null);

  useEffect(() => {
    const dis  = localStorage.getItem('diseaseColumns');     if (dis)  setAvailableDiseases(JSON.parse(dis));
    const bar  = localStorage.getItem('availableBarangays'); if (bar)  setAvailableBarangays(JSON.parse(bar));
    const hist = localStorage.getItem('forecastHistory');    if (hist) setForecastHistory(JSON.parse(hist));
  }, []);

  const generatedBarangays = new Set(
    forecastHistory.map(h => h.barangay).filter(b => b && b !== ALL_BARANGAYS)
  );

  // Sorted unique years from all forecast history entries
  const availableYears = [...new Set(
    forecastHistory.map(h => getPeriodYear(h.period)).filter(Boolean)
  )].sort();

  const getConfidence = (d) => ({ dengue_cases:87, diarrhea_cases:82, respiratory_cases:79, malnutrition_prevalence_pct:74, malnutrition_cases:76, hypertension_cases:83, diabetes_cases:80 })[d] ?? 78;
  const getConfidenceColor = (v) => v >= 85 ? T.ok : v >= 75 ? T.warnAccent : T.danger;

  const cityLabel     = localStorage.getItem('datasetCity') || '';
  const barangayLabel = cachedBarangay === ALL_BARANGAYS ? 'All Barangays' : cachedBarangay;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: T.pageBg }}>
      <Sidebar currentPage="prediction" onNavigate={onNavigate} onLogout={onLogout} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Sticky header — border removed */}
        <Box sx={{ px: '24px', minHeight: 64, display: 'flex', alignItems: 'center', backgroundColor: '#FFFFFF', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: T.textHead, letterSpacing: '-0.2px' }}>Prediction</Typography>
        </Box>

        <Box sx={{ px: '24px', pt: '20px', pb: '28px', overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* ── Barangay Picker + Export ── */}
          <SCard sx={{ mb: '14px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                  <BarangayPicker
                    availableBarangays={availableBarangays}
                    generatedBarangays={generatedBarangays}
                    pending={pendingBarangays}
                    onPendingChange={setPendingBarangays}
                    onConfirm={(sel) => setConfirmedBarangays(new Set(sel))}
                    confirmed={confirmedBarangays}
                  />
                  <YearPicker
                    availableYears={availableYears}
                    selectedYear={selectedYear}
                    onSelect={setSelectedYear}
                  />
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

          {/* ── Forecast Table ── */}
          <SCard sx={{ flex: confirmedBarangays.size === 0 ? 1 : 'none', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
              {generatedBarangays.size === 0 && (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', py: 4 }}>
                  <PsychologyIcon sx={{ fontSize: 38, color: T.textFaint, mb: 1.5 }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead, mb: 0.5 }}>No forecast generated yet</Typography>
                  <Typography sx={{ fontSize: 12, color: T.textMuted, mb: 2 }}>Go to the <strong>Dashboard</strong> to generate a forecast first.</Typography>
                  <Button size="small" onClick={() => onNavigate?.('dashboard')}
                    startIcon={<PsychologyIcon sx={{ fontSize: 13 }} />}
                    sx={{ textTransform: 'none', fontSize: 12, fontWeight: 600, color: T.blue, backgroundColor: T.blueDim, border: `1px solid rgba(37,99,235,0.25)`, borderRadius: '7px', px: 2, py: 0.75, '&:hover': { backgroundColor: 'rgba(37,99,235,0.12)' } }}>
                    Go to Dashboard
                  </Button>
                </Box>
              )}
              {generatedBarangays.size > 0 && confirmedBarangays.size === 0 && (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', py: 4 }}>
                  <LocationOnIcon sx={{ fontSize: 38, color: T.textFaint, mb: 1.5 }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead, mb: 0.5 }}>No barangay selected yet</Typography>
                  <Typography sx={{ fontSize: 12, color: T.textMuted }}>Click <strong>Select Barangay</strong> above then click <strong>Confirm</strong>.</Typography>
                </Box>
              )}
              {confirmedBarangays.size > 0 && (
                <ForecastTable
                  forecastHistory={forecastHistory}
                  confirmedBarangays={confirmedBarangays}
                  availableDiseases={availableDiseases}
                  selectedYear={selectedYear}
                />
              )}
            </CardContent>
          </SCard>

        </Box>
      </Box>

      {/* Details dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '12px', border: `1px solid ${T.border}` } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: T.textHead, pb: 1 }}>Prediction Details</DialogTitle>
        <Box sx={{ borderBottom: `1px solid ${T.borderSoft}`, mx: 3 }} />
        {detailsData && (
          <DialogContent sx={{ pt: 2.5 }}>
            <Typography sx={{ fontSize: 11, color: T.textMuted }}>Disease</Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: T.textHead, mb: 2 }}>{detailsData.label} — {detailsData.period}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
              {[{ k: 'Created Date & Time', v: detailsData.createdAt }, { k: 'Data Source', v: detailsData.fileName }, { k: 'Model Used', v: 'LSTM Neural Network' }, { k: 'Forecast Horizon', v: detailsData.forecastHorizon }].map(row => (
                <Box key={row.k}><Typography sx={{ fontSize: 11, color: T.textMuted }}>{row.k}</Typography><Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>{row.v}</Typography></Box>
              ))}
            </Box>
            <Box sx={{ borderTop: `1px solid ${T.borderSoft}`, my: 2 }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
              <Box><Typography sx={{ fontSize: 11, color: T.textMuted }}>Next Period Predicted Value</Typography><Typography sx={{ fontSize: 28, fontWeight: 700, color: T.blue }}>{detailsData.predictedValue.toLocaleString()}</Typography></Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: T.textMuted, mb: 0.75 }}>Confidence Level</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress variant="determinate" value={detailsData.confidence} sx={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: T.borderSoft, '& .MuiLinearProgress-bar': { backgroundColor: getConfidenceColor(detailsData.confidence), borderRadius: 3 } }} />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.textHead }}>{detailsData.confidence}%</Typography>
                </Box>
              </Box>
            </Box>
            <Box sx={{ mb: 2 }}><Typography sx={{ fontSize: 11, color: T.textMuted, mb: 0.75 }}>Trend</Typography><TrendTag trend={detailsData.trend} /></Box>
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
          <Button onClick={() => setDetailsOpen(false)} sx={{ borderRadius: '8px', textTransform: 'none', fontSize: 13, color: T.textMuted, border: `1px solid ${T.border}`, px: 2 }}>Close</Button>
          <Button variant="contained" startIcon={<DownloadIcon sx={{ fontSize: 15 }} />} onClick={() => exportDiseaseReport(detailsData, forecastData, barangayLabel, cityLabel)}
            sx={{ borderRadius: '8px', textTransform: 'none', fontSize: 13, fontWeight: 600, backgroundColor: T.blue, '&:hover': { backgroundColor: T.blueMid }, px: 2 }}>
            Download Report
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Prediction;
