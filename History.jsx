import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  Box, Typography, Card, CardContent, Button,
  Chip, IconButton,
} from '@mui/material';
import {
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon,
  CalendarMonth as CalendarMonthIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Close as CloseIcon,
  FileDownload as FileDownloadIcon,
  InsertDriveFile as FileIcon,
  Psychology as PsychologyIcon,
} from '@mui/icons-material';
import { useRef } from 'react';
import Sidebar, { T } from './Sidebar';

// ── Helpers ───────────────────────────────────────────────────────────────────
const DISEASE_DISPLAY_MAP = {
  dengue_cases:                'Dengue',
  diarrhea_cases:              'Diarrhea',
  respiratory_cases:           'Respiratory',
  malnutrition_cases:          'Malnutrition',
  malnutrition_prevalence_pct: 'Malnutrition %',
  hypertension_cases:          'Hypertension',
  diabetes_cases:              'Diabetes',
};

const getDiseaseLabel = (col) => {
  if (DISEASE_DISPLAY_MAP[col]) return DISEASE_DISPLAY_MAP[col];
  return col
    .replace(/_cases$/, '')
    .replace(/_prevalence_pct$/, ' %')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const formatMonthLabel = (period) => {
  if (!period) return period;
  const m = period.match(/^(\d{4})-(\d{2})/);
  if (m) return MONTH_NAMES[parseInt(m[2], 10) - 1] ?? period;
  return period;
};

const getPeriodYear = (period) => {
  const m = period?.match(/^(\d{4})/);
  return m ? m[1] : null;
};

// ── Sub-components ────────────────────────────────────────────────────────────
const SCard = ({ children, sx = {} }) => (
  <Card sx={{ borderRadius: '10px', backgroundColor: '#FFFFFF', border: `1px solid ${T.border}`, boxShadow: 'none', ...sx }}>
    {children}
  </Card>
);

// ── Year Picker (portal popup, same style as Prediction) ──────────────────────
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
        {selectedYear || 'All Years'}
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
              {availableYears.length === 0 ? (
                <Typography sx={{ fontSize: 12, color: T.textMuted, textAlign: 'center', py: 1 }}>
                  No years available. Import data first.
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
                  {availableYears.map(yr => {
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

// ── Export dropdown ────────────────────────────────────────────────────────────
const ExportMenu = ({ rows, availableDiseases }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const disabled = rows.length === 0;

  const doExport = (format) => {
    setOpen(false);
    if (format === 'csv') {
      const headers = ['Barangay', 'Year', 'Month', 'Illness', 'Total Patients'];
      const csvRows = rows.map(r => [r.barangay, r.year, r.month, r.illness, r.total].map(v => `"${v}"`).join(','));
      const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `history_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const lines = ['PREDICTHEALTH — HISTORY REPORT', '='.repeat(52)];
      lines.push(`Generated : ${new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}`, '');
      lines.push(['Barangay', 'Year', 'Month', 'Illness', 'Total Patients'].join(' | '));
      lines.push('-'.repeat(52));
      rows.forEach(r => lines.push([r.barangay, r.year, r.month, r.illness, r.total].join(' | ')));
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `history_${new Date().toISOString().slice(0, 10)}.txt`; a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Box ref={ref} sx={{ position: 'relative', flexShrink: 0 }}>
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
      {open && (
        <Box sx={{ position: 'fixed', zIndex: 1400, backgroundColor: '#FFFFFF', border: `1px solid ${T.border}`, borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 170, overflow: 'hidden' }}
          ref={el => {
            if (el && ref.current) {
              const btn = ref.current.getBoundingClientRect();
              el.style.top  = (btn.bottom + 6) + 'px';
              el.style.right = (window.innerWidth - btn.right) + 'px';
            }
          }}>
          {[{ format: 'csv', label: 'Export as CSV' }, { format: 'txt', label: 'Export as TXT' }].map(opt => (
            <Box key={opt.format}
              onClick={() => doExport(opt.format)}
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

// ── Main ───────────────────────────────────────────────────────────────────────
const History = ({ onNavigate, onLogout }) => {
  const [forecastHistory,    setForecastHistory]    = useState([]);
  const [availableDiseases,  setAvailableDiseases]  = useState([]);
  const [selectedYear,       setSelectedYear]       = useState(null);

  useEffect(() => {
    try {
      const h = localStorage.getItem('forecastHistory');
      if (h) setForecastHistory(JSON.parse(h));
      const d = localStorage.getItem('diseaseColumns');
      if (d) setAvailableDiseases(JSON.parse(d));
    } catch (e) { console.error(e); }
  }, []);

  // Sorted unique years from history
  const availableYears = [...new Set(
    forecastHistory.map(h => getPeriodYear(h.period)).filter(Boolean)
  )].sort();

  // Build flat rows: one row per barangay + period + disease
  const allRows = forecastHistory
    .filter(h => !selectedYear || getPeriodYear(h.period) === selectedYear)
    .map(h => ({
      barangay: h.barangay || '—',
      year:     getPeriodYear(h.period) || '—',
      month:    formatMonthLabel(h.period) || '—',
      illness:  getDiseaseLabel(h.disease),
      total:    (h.predictedValue ?? 0).toLocaleString(),
      _period:  h.period || '',
    }))
    .sort((a, b) => a.barangay.localeCompare(b.barangay) || a._period.localeCompare(b._period) || a.illness.localeCompare(b.illness));

  const thSx = {
    fontSize: 11, fontWeight: 600, color: T.textMuted,
    textTransform: 'uppercase', letterSpacing: '0.5px',
    padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap',
    backgroundColor: T.pageBg, borderBottom: `1px solid ${T.border}`,
  };
  const tdSx = {
    fontSize: 12.5, color: T.textBody,
    padding: '10px 12px', borderBottom: `1px solid ${T.borderSoft}`,
    verticalAlign: 'middle', backgroundColor: '#FFFFFF',
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: T.pageBg }}>
      <Sidebar currentPage="history" onNavigate={onNavigate} onLogout={onLogout} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Sticky header — border removed */}
        <Box sx={{
          px: '24px', minHeight: 64,
          display: 'flex', alignItems: 'center',
          backgroundColor: '#FFFFFF', position: 'sticky', top: 0, zIndex: 10,
          flexShrink: 0,
        }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: T.textHead, letterSpacing: '-0.2px' }}>
            History
          </Typography>
        </Box>

        <Box sx={{ px: '24px', pt: '20px', pb: '28px', overflow: 'auto', flex: 1 }}>

          {/* ── Filter + Export bar ── */}
          <SCard sx={{ mb: '14px' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <YearPicker
                  availableYears={availableYears}
                  selectedYear={selectedYear}
                  onSelect={setSelectedYear}
                />
                <ExportMenu rows={allRows} availableDiseases={availableDiseases} />
              </Box>
            </CardContent>
          </SCard>

          {/* ── History Table ── */}
          <SCard>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              {forecastHistory.length === 0 ? (
                <Box sx={{ py: 7, textAlign: 'center' }}>
                  <PsychologyIcon sx={{ fontSize: 38, color: T.textFaint, mb: 1.5 }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead, mb: 0.5 }}>No history yet</Typography>
                  <Typography sx={{ fontSize: 12, color: T.textMuted, mb: 2 }}>
                    Go to the <strong>Dashboard</strong> to generate forecasts first.
                  </Typography>
                  <Button size="small" onClick={() => onNavigate?.('dashboard')}
                    startIcon={<PsychologyIcon sx={{ fontSize: 13 }} />}
                    sx={{
                      textTransform: 'none', fontSize: 12, fontWeight: 600,
                      color: T.blue, backgroundColor: T.blueDim,
                      border: `1px solid rgba(37,99,235,0.25)`, borderRadius: '7px',
                      px: 2, py: 0.75, '&:hover': { backgroundColor: 'rgba(37,99,235,0.12)' },
                    }}>
                    Go to Dashboard
                  </Button>
                </Box>
              ) : allRows.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>No records found for the selected year.</Typography>
                </Box>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '25%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ ...thSx, paddingLeft: 24 }}>Barangay</th>
                        <th style={thSx}>Year</th>
                        <th style={thSx}>Month</th>
                        <th style={thSx}>Illness</th>
                        <th style={{ ...thSx, textAlign: 'center', paddingRight: 24 }}>Total Patients</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allRows.map((row, i) => (
                        <tr key={i}>
                          <td style={{ ...tdSx, fontWeight: 600, color: T.textHead, paddingLeft: 24 }}>{row.barangay}</td>
                          <td style={{ ...tdSx, color: T.textMuted, fontWeight: 500 }}>{row.year}</td>
                          <td style={tdSx}>{row.month}</td>
                          <td style={tdSx}>{row.illness}</td>
                          <td style={{ ...tdSx, textAlign: 'center', fontWeight: 700, color: T.textHead, paddingRight: 24 }}>{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              )}
            </CardContent>
          </SCard>

        </Box>
      </Box>
    </Box>
  );
};

export default History;
