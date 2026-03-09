import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Chip,
  Alert, LinearProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  CloudUpload as CloudUploadIcon,
  Warning as WarningIcon,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import Sidebar, { T } from './Sidebar';

// ── Disease config ────────────────────────────────────────────────────────────
const DISEASE_MAP = {
  dengue_cases:                { label: 'Dengue',         color: T.danger,       icon: '🦟' },
  diarrhea_cases:              { label: 'Diarrhea',       color: T.neutralBar,   icon: '💧' },
  respiratory_cases:           { label: 'Respiratory',    color: T.danger,       icon: '🫁' },
  malnutrition_cases:          { label: 'Malnutrition',   color: T.neutralLight, icon: '⚕️' },
  malnutrition_prevalence_pct: { label: 'Malnutrition %', color: T.neutralLight, icon: '⚕️' },
  hypertension_cases:          { label: 'Hypertension',   color: T.neutralLight, icon: '❤️' },
  diabetes_cases:              { label: 'Diabetes',       color: T.warnAccent,   icon: '🩸' },
};

const getDiseaseInfo = (col) => {
  if (DISEASE_MAP[col]) return DISEASE_MAP[col];
  const label = col
    .replace(/_cases$/, '')
    .replace(/_prevalence_pct$/, ' %')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
  return { label, color: T.neutralBar, icon: '🏥' };
};

const trendColor  = (t) => t === 'increasing' ? T.danger  : t === 'decreasing' ? T.ok      : T.textMuted;
const trendBg     = (t) => t === 'increasing' ? T.dangerBg : t === 'decreasing' ? T.okBg    : '#F9FAFB';
const trendBorder = (t) => t === 'increasing' ? T.dangerBorder : t === 'decreasing' ? T.okBorder : T.borderSoft;

const TrendIcon = ({ trend, size = 15 }) => {
  const sx = { fontSize: size, color: trendColor(trend) };
  if (trend === 'increasing') return <TrendingUpIcon sx={sx} />;
  if (trend === 'decreasing') return <TrendingDownIcon sx={sx} />;
  return <RemoveIcon sx={sx} />;
};

const Tag = ({ label, bg, color, border }) => (
  <Chip label={label} size="small" sx={{
    backgroundColor: bg, color, border: `1px solid ${border}`,
    fontWeight: 500, fontSize: 10.5, borderRadius: '4px', height: 20,
  }} />
);

const TrendTag = ({ trend }) => {
  const labels = { increasing: '↑ increasing', decreasing: '↓ decreasing', stable: '— stable' };
  return <Tag label={labels[trend] || '— stable'} bg={trendBg(trend)} color={trendColor(trend)} border={trendBorder(trend)} />;
};

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

const tooltipStyle = {
  borderRadius: '8px', border: `1px solid ${T.border}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12, color: T.textBody, background: T.cardBg,
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = ({ onNavigate, onLogout }) => {
  const [hasData, setHasData]                         = useState(false);
  const [uploadedInfo, setUploadedInfo]               = useState(null);
  const [forecastHistory, setForecastHistory]         = useState([]);
  const [availableBarangays, setAvailableBarangays]   = useState([]);
  const [diseaseSummary, setDiseaseSummary]           = useState([]);
  const [barangaySummary, setBarangaySummary]         = useState([]);
  const [alertDiseases, setAlertDiseases]             = useState([]);
  const [miniTrendData, setMiniTrendData]             = useState([]);
  const [totalForecasted, setTotalForecasted]         = useState(0);
  const [latestForecastMonth, setLatestForecastMonth] = useState('N/A');
  const [overallTrend, setOverallTrend]               = useState('stable');

  useEffect(() => { loadAll(); }, []);

  const loadAll = () => {
    try {
      const up  = localStorage.getItem('uploadedData');       if (up)  setUploadedInfo(JSON.parse(up));
      const bar = localStorage.getItem('availableBarangays'); if (bar) setAvailableBarangays(JSON.parse(bar));
      const raw = localStorage.getItem('forecastHistory');
      if (raw) {
        const h = JSON.parse(raw);
        setForecastHistory(h);
        setHasData(h.length > 0);
        computeInsights(h);
      }
    } catch (e) { console.error(e); }
  };

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
    setAlertDiseases(sumArr.filter(d => d.trend === 'increasing'));
    const inc = sumArr.filter(d => d.trend === 'increasing').length;
    const dec = sumArr.filter(d => d.trend === 'decreasing').length;
    setOverallTrend(inc > dec ? 'increasing' : dec > inc ? 'decreasing' : 'stable');

    const bMap = {};
    history.forEach(item => {
      const b = item.barangay || 'Unknown';
      if (!bMap[b]) bMap[b] = { barangay: b, total: 0, diseases: new Set() };
      bMap[b].total += item.predictedValue || 0;
      bMap[b].diseases.add(item.disease);
    });
    setBarangaySummary(Object.values(bMap).map(b => ({ ...b, diseases: b.diseases.size })).sort((a, b) => b.total - a.total).slice(0, 5));

    const pMap = {};
    history.forEach(item => { pMap[item.period] = (pMap[item.period] || 0) + (item.predictedValue || 0); });
    setMiniTrendData(Object.entries(pMap).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([p, c]) => ({ month: p.slice(0, 7), cases: Math.round(c) })));
  };

  const maxBTotal = barangaySummary.length ? Math.max(...barangaySummary.map(b => b.total)) : 1;
  const barColor  = (d) => d.trend === 'increasing' ? T.danger : d.trend === 'decreasing' ? T.neutralBar : T.neutralLight;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: T.pageBg }}>
      <Sidebar currentPage="dashboard" onNavigate={onNavigate} onLogout={onLogout} />

      <Box sx={{ flex: 1, overflow: 'auto', p: '28px 24px', minWidth: 0 }}>

        {/* Page header */}
        <Box sx={{ mb: 2.75 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: T.textHead, letterSpacing: '-0.3px' }}>
            Dashboard
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.4 }}>
            Health forecast overview and disease alerts
          </Typography>
        </Box>

        {/* Empty state */}
        {!hasData && (
          <Alert severity="info" icon={<InfoOutlinedIcon fontSize="small" />}
            sx={{ mb: 2.5, borderRadius: '10px', backgroundColor: T.blueDim, color: T.textHead, border: `1px solid rgba(27,79,138,0.18)`, fontSize: 13, '& .MuiAlert-icon': { color: T.blue } }}>
            <strong>No prediction data yet.</strong>{' '}
            Upload a dataset and run predictions to populate this dashboard.{' '}
            <Typography component="span" onClick={() => onNavigate?.('dataimport')}
              sx={{ fontWeight: 600, cursor: 'pointer', color: T.blue, '&:hover': { opacity: 0.75 } }}>
              Go to Data Import →
            </Typography>
          </Alert>
        )}

        {/* Alert banner */}
        {alertDiseases.length > 0 && (
          <Box sx={{ mb: 2.5, p: '11px 14px', borderRadius: '10px', backgroundColor: T.warnBg, border: `1px solid ${T.warnBorder}`, borderLeft: `3px solid ${T.warnAccent}`, display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
            <WarningIcon sx={{ color: T.warnAccent, fontSize: 17, flexShrink: 0, mt: '2px' }} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.warn, mb: 0.6 }}>
                {alertDiseases.length} Disease{alertDiseases.length > 1 ? 's' : ''} Trending Upward
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                {alertDiseases.map(d => (
                  <Tag key={d.disease} label={`${d.info.icon} ${d.label} — ${d.latestValue.toLocaleString()} cases`} bg={T.warnBg} color={T.warn} border={T.warnBorder} />
                ))}
              </Box>
            </Box>
            <Button size="small" onClick={() => onNavigate?.('prediction')}
              sx={{ flexShrink: 0, color: T.warn, textTransform: 'none', fontSize: 11, fontWeight: 600, border: `1px solid ${T.warnBorder}`, borderRadius: '5px', px: 1.25, py: 0.4, minWidth: 0, '&:hover': { backgroundColor: 'rgba(180,83,9,0.06)' } }}>
              View →
            </Button>
          </Box>
        )}

        {/* ── Stat cards ── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', mb: '16px' }}>
          <SCard sx={{ borderTop: `3px solid ${T.blue}` }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: T.textMuted, mb: 1 }}>Forecasted Cases</Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 700, color: T.textHead, lineHeight: 1, mb: 0.5, letterSpacing: '-0.5px' }}>{hasData ? totalForecasted.toLocaleString() : '—'}</Typography>
              <Typography sx={{ fontSize: 11, color: T.textMuted }}>{latestForecastMonth !== 'N/A' ? `Period: ${latestForecastMonth}` : 'No forecasts yet'}</Typography>
            </CardContent>
          </SCard>

          <SCard sx={{ borderTop: `3px solid ${T.textMuted}` }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: T.textMuted, mb: 1 }}>Diseases Monitored</Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 700, color: T.textHead, lineHeight: 1, mb: 0.5, letterSpacing: '-0.5px' }}>{hasData ? diseaseSummary.length : '—'}</Typography>
              <Typography sx={{ fontSize: 11, color: alertDiseases.length > 0 ? T.danger : T.textMuted, fontWeight: alertDiseases.length > 0 ? 500 : 400 }}>
                {alertDiseases.length > 0 ? `${alertDiseases.length} trending upward` : 'All stable or improving'}
              </Typography>
            </CardContent>
          </SCard>

          <SCard sx={{ borderTop: `3px solid ${T.textMuted}` }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: T.textMuted, mb: 1 }}>Barangays Covered</Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 700, color: T.textHead, lineHeight: 1, mb: 0.5, letterSpacing: '-0.5px' }}>
                {availableBarangays.length > 0 ? availableBarangays.length : hasData ? barangaySummary.length : '—'}
              </Typography>
              <Typography sx={{ fontSize: 11, color: T.textMuted }}>{uploadedInfo?.fileName ? uploadedInfo.fileName : 'No dataset loaded'}</Typography>
            </CardContent>
          </SCard>

          <SCard sx={{ borderTop: `3px solid ${trendColor(overallTrend)}` }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: T.textMuted, mb: 1 }}>Overall Trend</Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 700, textTransform: 'capitalize', lineHeight: 1, mb: 0.5, color: hasData ? trendColor(overallTrend) : T.textMuted }}>
                {hasData ? overallTrend : '—'}
              </Typography>
              <Typography sx={{ fontSize: 11, color: T.textMuted }}>Across all diseases</Typography>
            </CardContent>
          </SCard>
        </Box>

        {/* ── Disease forecast + Trend chart ── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', mb: '14px' }}>
          <SCard>
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2 } }}>
              <CardHead title="Disease Forecast" right={<Tag label={`${diseaseSummary.length} tracked`} bg={T.blueDim} color={T.blue} border="rgba(27,79,138,0.18)" />} />
              {!hasData ? (
                <Box sx={{ textAlign: 'center', py: 5 }}><Typography sx={{ fontSize: 12.5, color: T.textMuted }}>No data yet</Typography></Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {diseaseSummary.map(d => (
                    <Box key={d.disease} sx={{ p: '9px 11px', borderRadius: '7px', backgroundColor: '#FAFBFC', border: `1px solid ${trendBorder(d.trend)}` }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: T.textHead, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <span style={{ fontSize: 14 }}>{d.info.icon}</span>{d.label}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: trendColor(d.trend) }}>{d.latestValue.toLocaleString()}</Typography>
                          <TrendTag trend={d.trend} />
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress variant="determinate" value={d.confidence || 78}
                          sx={{ flex: 1, height: 2.5, borderRadius: 2, backgroundColor: T.borderSoft, '& .MuiLinearProgress-bar': { backgroundColor: d.trend === 'increasing' ? T.danger : d.trend === 'decreasing' ? T.ok : T.neutralLight, borderRadius: 2 } }} />
                        <Typography sx={{ fontSize: 10, color: T.textFaint, minWidth: 44, textAlign: 'right' }}>{d.confidence || 78}% conf</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
              <Button size="small" onClick={() => onNavigate?.('prediction')}
                sx={{ mt: 1.25, textTransform: 'none', color: T.blue, fontSize: 11.5, fontWeight: 500, px: 0, '&:hover': { backgroundColor: 'transparent', opacity: 0.7 } }}>
                Open Prediction →
              </Button>
            </CardContent>
          </SCard>

          <SCard>
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2 } }}>
              <CardHead title="Combined Cases Trend" right={<Typography sx={{ fontSize: 11, color: T.textMuted }}>Last 6 periods</Typography>} />
              <Typography sx={{ fontSize: 11, color: T.textFaint, mb: 1.75, mt: '-8px' }}>Forecasted cases across all diseases and barangays</Typography>
              {hasData && miniTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={miniTrendData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: 10, fill: T.textFaint }} />
                    <YAxis axisLine={false} tickLine={false} style={{ fontSize: 10, fill: T.textFaint }} />
                    <RechartsTooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="cases" stroke={T.blue} strokeWidth={2}
                      dot={{ fill: '#fff', r: 3.5, strokeWidth: 2, stroke: T.blue }}
                      activeDot={{ r: 5, fill: T.blue, stroke: '#fff', strokeWidth: 2 }} name="Total Cases" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 210 }}>
                  <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>No trend data yet</Typography>
                </Box>
              )}
            </CardContent>
          </SCard>
        </Box>

        {/* ── Barangay load + Data status ── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', mb: '14px' }}>
          <SCard>
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2 } }}>
              <CardHead title="Barangay Case Load" right={<Typography sx={{ fontSize: 11, color: T.textMuted }}>Top 5 ranked</Typography>} />
              {!hasData || barangaySummary.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 5 }}><Typography sx={{ fontSize: 12.5, color: T.textMuted }}>No barangay data yet</Typography></Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {barangaySummary.map((b, idx) => (
                    <Box key={b.barangay}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 19, height: 19, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: idx === 0 ? T.dangerBg : T.borderSoft, color: idx === 0 ? T.danger : T.textMuted, fontSize: 9.5, fontWeight: 700 }}>{idx + 1}</Box>
                          <Typography sx={{ fontSize: 12, fontWeight: 500, color: T.textBody }}>{b.barangay}</Typography>
                          <Tag label={`${b.diseases}d`} bg="#F9FAFB" color={T.textMuted} border={T.borderSoft} />
                        </Box>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: idx === 0 ? T.danger : T.textBody }}>{b.total.toLocaleString()}</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={Math.round((b.total / maxBTotal) * 100)}
                        sx={{ height: 4, borderRadius: 2, backgroundColor: T.borderSoft, '& .MuiLinearProgress-bar': { backgroundColor: idx === 0 ? T.danger : T.neutralBar, borderRadius: 2 } }} />
                    </Box>
                  ))}
                </Box>
              )}
              <Button size="small" onClick={() => onNavigate?.('history')}
                sx={{ mt: 1.25, textTransform: 'none', color: T.blue, fontSize: 11.5, fontWeight: 500, px: 0, '&:hover': { backgroundColor: 'transparent', opacity: 0.7 } }}>
                View Full History →
              </Button>
            </CardContent>
          </SCard>

          <SCard>
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2 } }}>
              <CardHead title="Data Status"
                right={uploadedInfo?.fileName
                  ? <Tag label="✓ Dataset Loaded" bg={T.okBg} color={T.ok} border={T.okBorder} />
                  : <Tag label="No Dataset" bg={T.warnBg} color={T.warn} border={T.warnBorder} />
                }
              />
              <Box>
                {[
                  { k: 'Dataset File',     v: uploadedInfo?.fileName || 'None uploaded', muted: !uploadedInfo?.fileName },
                  { k: 'Upload Date',      v: uploadedInfo?.uploadDate ? new Date(uploadedInfo.uploadDate).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : 'N/A' },
                  { k: 'Barangays',        v: availableBarangays.length > 0 ? `${availableBarangays.length} barangays` : 'N/A' },
                  { k: 'Diseases',         v: diseaseSummary.length > 0 ? `${diseaseSummary.length} types` : 'N/A' },
                  { k: 'Forecast Records', v: forecastHistory.length > 0 ? `${forecastHistory.length} entries` : '0 entries' },
                  { k: 'Latest Period',    v: latestForecastMonth !== 'N/A' ? latestForecastMonth : 'N/A', highlight: latestForecastMonth !== 'N/A' },
                ].map(row => (
                  <Box key={row.k} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.875, borderBottom: `1px solid ${T.borderSoft}`, '&:last-child': { borderBottom: 'none' } }}>
                    <Typography sx={{ fontSize: 12, color: T.textMuted }}>{row.k}</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: row.muted ? T.textMuted : row.highlight ? T.blue : T.textHead }}>{row.v}</Typography>
                  </Box>
                ))}
              </Box>
              <Button variant="contained" startIcon={<CloudUploadIcon sx={{ fontSize: 15 }} />} onClick={() => onNavigate?.('dataimport')} fullWidth
                sx={{ mt: 2, textTransform: 'none', borderRadius: '7px', py: 0.9, backgroundColor: T.blue, color: '#fff', fontWeight: 600, fontSize: 12.5, boxShadow: '0 2px 10px rgba(27,79,138,0.25)', '&:hover': { backgroundColor: T.blueMid, boxShadow: '0 3px 14px rgba(27,79,138,0.32)' } }}>
                {uploadedInfo?.fileName ? 'Upload New Dataset' : 'Go to Data Import'}
              </Button>
            </CardContent>
          </SCard>
        </Box>

        {/* ── Disease bar chart ── */}
        {hasData && diseaseSummary.length > 0 && (
          <SCard>
            <CardContent sx={{ p: 2.25 }}>
              <CardHead title="Forecasted Cases by Disease" right={<Typography sx={{ fontSize: 11, color: T.textMuted }}>Next period</Typography>} />
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={diseaseSummary.map(d => ({ name: d.label, cases: d.latestValue, color: barColor(d) }))} margin={{ top: 4, right: 6, left: -18, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textMuted }} />
                  <YAxis axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textMuted }} />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="cases" radius={[4, 4, 0, 0]} maxBarSize={50} name="Forecasted Cases">
                    {diseaseSummary.map((d, i) => <Cell key={i} fill={barColor(d)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </SCard>
        )}

      </Box>
    </Box>
  );
};

export default Dashboard;