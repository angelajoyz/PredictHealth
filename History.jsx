import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Button,
  Select, MenuItem, Skeleton,
  Chip, Tooltip, IconButton,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  ArrowBack as ArrowBackIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  CheckCircle as CheckCircleIcon,
  CalendarMonth as CalendarIcon,
  Folder as FolderIcon,
  DeleteOutline as DeleteIcon,
  WarningAmberRounded as WarningIcon,
} from '@mui/icons-material';
import Sidebar, { T } from './Sidebar';

// ── Helpers ────────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

const getDiseaseLabel = (col) => {
  const map = {
    respiratory: 'Respiratory', dengue: 'Dengue', covid: 'COVID-19',
    cardiovascular: 'Cardiovascular', urinary: 'Urinary/Renal',
    gastrointestinal: 'Gastrointestinal', diabetes: 'Diabetes',
    skin: 'Skin Disease', musculoskeletal: 'Musculoskeletal',
    injury: 'Injury/Trauma', infectious: 'Other Infectious',
    tuberculosis: 'Tuberculosis', viral_infection: 'Viral Infection',
    blood_metabolic: 'Blood/Metabolic', neurological: 'Neurological',
    sensory: 'Eye/Ear', mental_health: 'Mental Health',
    maternal: 'Maternal/OB', neoplasm: 'Neoplasm/Cancer',
    leptospirosis: 'Leptospirosis', diarrhea: 'Diarrhea',
    hypertension: 'Hypertension', malnutrition: 'Malnutrition',
    congenital: 'Congenital', other: 'Other',
  };
  return map[col] || col?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '—';
};

const formatDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-PH', { dateStyle: 'medium' }); }
  catch { return iso; }
};

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
});

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const SCard = ({ children, sx = {} }) => (
  <Card sx={{ borderRadius: '10px', backgroundColor: '#FFFFFF',
    border: `1px solid ${T.border}`, boxShadow: 'none', ...sx }}>
    {children}
  </Card>
);

// ── Confirm Delete Dialog ──────────────────────────────────────────────────────
const ConfirmDeleteDialog = ({ upload, onConfirm, onCancel, isDeleting }) => {
  if (!upload) return null;
  return (
    <>
      {/* Backdrop */}
      <Box
        onClick={!isDeleting ? onCancel : undefined}
        sx={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)',
          zIndex: 1200,
          animation: 'fadeIn 0.15s ease',
          '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
        }}
      />
      {/* Dialog */}
      <Box sx={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1300,
        width: '100%', maxWidth: 420,
        px: 2,
        animation: 'slideUp 0.18s ease',
        '@keyframes slideUp': {
          from: { opacity: 0, transform: 'translate(-50%, calc(-50% + 12px))' },
          to:   { opacity: 1, transform: 'translate(-50%, -50%)' },
        },
      }}>
        <Box sx={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}>
          {/* Red accent bar */}
          <Box sx={{ height: 4, backgroundColor: T.danger, borderRadius: '14px 14px 0 0' }} />

          <Box sx={{ p: '24px 24px 20px' }}>
            {/* Icon + Title */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
              <Box sx={{
                width: 42, height: 42, borderRadius: '10px', flexShrink: 0,
                backgroundColor: T.dangerBg || '#FEF2F2',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <WarningIcon sx={{ fontSize: 22, color: T.danger }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: T.textHead, mb: 0.4 }}>
                  Delete this file?
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.5 }}>
                  This will permanently remove the file and{' '}
                  <strong style={{ color: T.textBody }}>all associated records</strong>{' '}
                  from the database. This action cannot be undone.
                </Typography>
              </Box>
            </Box>

            {/* File info box */}
            <Box sx={{
              backgroundColor: T.pageBg,
              border: `1px solid ${T.border}`,
              borderRadius: '8px',
              p: '10px 14px',
              mb: '20px',
              display: 'flex', alignItems: 'center', gap: 1.5,
            }}>
              <FolderIcon sx={{ fontSize: 16, color: T.textFaint, flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{
                  fontSize: 12.5, fontWeight: 600, color: T.textHead,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {upload.filename}
                </Typography>
                {upload.barangay_count && (
                  <Typography sx={{ fontSize: 11, color: T.textMuted }}>
                    {upload.barangay_count} barangay{upload.barangay_count > 1 ? 's' : ''} · Uploaded {formatDate(upload.uploaded_at)}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
              <Button
                size="small"
                onClick={onCancel}
                disabled={isDeleting}
                sx={{
                  textTransform: 'none', fontSize: 13, fontWeight: 600,
                  color: T.textBody, borderRadius: '8px', px: 2.5, py: 0.9,
                  border: `1px solid ${T.border}`,
                  backgroundColor: '#FFFFFF',
                  '&:hover': { backgroundColor: T.pageBg },
                  '&:disabled': { opacity: 0.5 },
                }}>
                Cancel
              </Button>
              <Button
                size="small"
                onClick={onConfirm}
                disabled={isDeleting}
                sx={{
                  textTransform: 'none', fontSize: 13, fontWeight: 600,
                  color: '#FFFFFF', borderRadius: '8px', px: 2.5, py: 0.9,
                  backgroundColor: T.danger,
                  '&:hover': { backgroundColor: '#b91c1c' },
                  '&:disabled': { opacity: 0.6 },
                  minWidth: 110,
                }}>
                {isDeleting ? 'Deleting…' : 'Yes, Delete'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
};

// ── Filter Dropdown ────────────────────────────────────────────────────────────
const FilterSelect = ({ label, value, options, onChange, formatOption }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
    <Typography sx={{ fontSize: 11.5, color: T.textMuted, fontWeight: 500, whiteSpace: 'nowrap' }}>
      {label}:
    </Typography>
    <Select
      value={value}
      onChange={e => onChange(e.target.value)}
      size="small"
      displayEmpty
      sx={{
        fontSize: 12, minWidth: 110,
        backgroundColor: value ? T.blueDim : '#FFFFFF',
        borderRadius: '7px',
        '& .MuiOutlinedInput-notchedOutline': { borderColor: value ? T.blue : T.border },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.blue },
        '& .MuiSelect-select': { py: '5px', px: '10px' },
      }}>
      <MenuItem value="" sx={{ fontSize: 12, color: T.textMuted }}>All</MenuItem>
      {options.map(opt => (
        <MenuItem key={opt} value={opt} sx={{ fontSize: 12 }}>
          {formatOption ? formatOption(opt) : opt}
        </MenuItem>
      ))}
    </Select>
  </Box>
);

// ── Pagination ─────────────────────────────────────────────────────────────────
const Pagination = ({ page, pages, total, perPage, onPage }) => {
  if (pages <= 1) return null;
  const from = (page - 1) * perPage + 1;
  const to   = Math.min(page * perPage, total);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      px: 3, py: 1.5, borderTop: `1px solid ${T.borderSoft}` }}>
      <Typography sx={{ fontSize: 12, color: T.textMuted }}>
        Showing <strong>{from}–{to}</strong> of <strong>{total}</strong> records
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Button size="small" disabled={page <= 1} onClick={() => onPage(page - 1)}
          sx={{ minWidth: 32, p: 0.5, borderRadius: '7px', color: T.textMuted,
            '&:not(:disabled):hover': { backgroundColor: T.borderSoft } }}>
          <ChevronLeftIcon sx={{ fontSize: 18 }} />
        </Button>

        {Array.from({ length: pages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === pages || Math.abs(p - page) <= 1)
          .reduce((acc, p, idx, arr) => {
            if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === '...'
              ? <Typography key={`ellipsis-${i}`} sx={{ fontSize: 12, color: T.textFaint, px: 0.5 }}>…</Typography>
              : <Button key={p} size="small" onClick={() => onPage(p)}
                  sx={{ minWidth: 32, height: 30, p: 0, borderRadius: '7px', fontSize: 12,
                    fontWeight: p === page ? 700 : 400,
                    backgroundColor: p === page ? T.blue : 'transparent',
                    color: p === page ? '#fff' : T.textBody,
                    '&:hover': { backgroundColor: p === page ? T.blueMid : T.borderSoft } }}>
                  {p}
                </Button>
          )}

        <Button size="small" disabled={page >= pages} onClick={() => onPage(page + 1)}
          sx={{ minWidth: 32, p: 0.5, borderRadius: '7px', color: T.textMuted,
            '&:not(:disabled):hover': { backgroundColor: T.borderSoft } }}>
          <ChevronRightIcon sx={{ fontSize: 18 }} />
        </Button>
      </Box>
    </Box>
  );
};

// ── File Card ──────────────────────────────────────────────────────────────────
const FileCard = ({ upload, onClick, onDelete }) => (
  <Box sx={{
    display: 'flex', alignItems: 'center', gap: 2, p: '14px 18px',
    borderRadius: '10px', border: `1.5px solid ${T.border}`,
    backgroundColor: '#FFFFFF', transition: 'all 0.15s',
    '&:hover': { borderColor: T.blue, backgroundColor: T.blueDim,
      boxShadow: '0 2px 8px rgba(37,99,235,0.08)' },
    '&:hover .delete-btn': { opacity: 1 },
  }}>
    {/* Clickable area */}
    <Box onClick={onClick} sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0, cursor: 'pointer' }}>
      <Box sx={{ width: 40, height: 40, borderRadius: '10px', backgroundColor: T.blueDim,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <FolderIcon sx={{ fontSize: 20, color: T.blue }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {upload.filename}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.4, flexWrap: 'wrap' }}>
          {upload.city && (
            <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>{upload.city}</Typography>
          )}
          {upload.barangay_count && (
            <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
              {upload.barangay_count} barangay{upload.barangay_count > 1 ? 's' : ''}
            </Typography>
          )}
          {upload.date_range_start && (
            <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
              {upload.date_range_start?.slice(0, 7)} – {upload.date_range_end?.slice(0, 7)}
            </Typography>
          )}
          <Typography sx={{ fontSize: 11, color: T.textFaint }}>
            Uploaded {formatDate(upload.uploaded_at)}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        {upload.status === 'success'
          ? <CheckCircleIcon sx={{ fontSize: 15, color: T.ok }} />
          : <Typography sx={{ fontSize: 11, color: T.danger }}>Failed</Typography>}
        <ChevronRightIcon sx={{ fontSize: 18, color: T.textFaint }} />
      </Box>
    </Box>

    {/* Delete button */}
    <Tooltip title="Delete file" placement="top">
      <IconButton
        className="delete-btn"
        size="small"
        onClick={(e) => { e.stopPropagation(); onDelete(upload); }}
        sx={{
          opacity: 0,
          transition: 'opacity 0.15s',
          color: T.danger,
          backgroundColor: T.dangerBg || '#FEF2F2',
          border: `1px solid rgba(220,38,38,0.2)`,
          borderRadius: '7px',
          width: 30, height: 30,
          flexShrink: 0,
          '&:hover': {
            backgroundColor: T.danger,
            color: '#FFFFFF',
          },
        }}>
        <DeleteIcon sx={{ fontSize: 15 }} />
      </IconButton>
    </Tooltip>
  </Box>
);

// ── Main History Page ──────────────────────────────────────────────────────────
const History = ({ onNavigate, onLogout }) => {
  const [view,          setView]          = useState('files');
  const [uploads,       setUploads]       = useState([]);
  const [uploadsLoading,setUploadsLoading]= useState(true);
  const [selectedUpload,setSelectedUpload]= useState(null);

  // Delete state
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [isDeleting,    setIsDeleting]    = useState(false);
  const [deleteError,   setDeleteError]   = useState('');

  // Table state
  const [records,       setRecords]       = useState([]);
  const [tableLoading,  setTableLoading]  = useState(false);
  const [page,          setPage]          = useState(1);
  const [totalPages,    setTotalPages]    = useState(1);
  const [totalRecords,  setTotalRecords]  = useState(0);
  const PER_PAGE = 20;

  // Filters
  const [filterBarangay,setFilterBarangay]= useState('');
  const [filterDisease, setFilterDisease] = useState('');
  const [filterYear,    setFilterYear]    = useState('');
  const [filterMonth,   setFilterMonth]   = useState('');
  const [filterOptions, setFilterOptions] = useState({ barangays: [], diseases: [], years: [], months: [] });

  // ── Fetch upload list ──────────────────────────────────────────────────────
  const fetchUploads = async () => {
    setUploadsLoading(true);
    try {
      const res  = await fetch(`${API}/upload-history`, { headers: getAuthHeaders() });
      const data = await res.json();
      setUploads(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch uploads:', e);
      setUploads([]);
    } finally {
      setUploadsLoading(false);
    }
  };

  useEffect(() => { fetchUploads(); }, []);

  // ── Delete handler ─────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    // Save values before any async — state may change
    const targetId       = deleteTarget.id;
    const wasViewingFile = selectedUpload?.id === targetId;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`${API}/upload-history/${targetId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Delete failed');
      }
      // If currently viewing the deleted file, go back to file list
      if (wasViewingFile) {
        setView('files');
        setSelectedUpload(null);
        setRecords([]);
      }
      // Refresh the file list
      await fetchUploads();
    } catch (e) {
      console.error('Delete error:', e);
      setDeleteError(e.message || 'Something went wrong. Please try again.');
    } finally {
      // Always close the dialog regardless of success or failure
      setDeleteTarget(null);
      setIsDeleting(false);
    }
  };

  // ── Fetch table data ───────────────────────────────────────────────────────
  const fetchTableData = useCallback(async (uploadId, pg = 1, filters = {}) => {
    if (!uploadId) return;
    setTableLoading(true);
    try {
      const params = new URLSearchParams({
        upload_id: uploadId,
        page:      pg,
        per_page:  PER_PAGE,
        ...(filters.barangay ? { barangay: filters.barangay } : {}),
        ...(filters.disease  ? { disease:  filters.disease  } : {}),
        ...(filters.year     ? { year:     filters.year     } : {}),
        ...(filters.month    ? { month:    filters.month    } : {}),
      });
      const res  = await fetch(`${API}/barangay-data?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      setRecords(data.records || []);
      setTotalPages(data.pages || 1);
      setTotalRecords(data.total || 0);
      if (data.filter_options) setFilterOptions(data.filter_options);
    } catch (e) {
      console.error('Failed to fetch barangay data:', e);
      setRecords([]);
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedUpload) {
      fetchTableData(selectedUpload.id, page, {
        barangay: filterBarangay,
        disease:  filterDisease,
        year:     filterYear,
        month:    filterMonth,
      });
    }
  }, [selectedUpload, page, filterBarangay, filterDisease, filterYear, filterMonth]);

  const handleSelectUpload = (upload) => {
    setSelectedUpload(upload);
    setView('table');
    setPage(1);
    setFilterBarangay('');
    setFilterDisease('');
    setFilterYear('');
    setFilterMonth('');
    setRecords([]);
    setFilterOptions({ barangays: [], diseases: [], years: [], months: [] });
  };

  const handleBack = () => {
    setView('files');
    setSelectedUpload(null);
    setRecords([]);
  };

  const handleFilterChange = (setter) => (val) => {
    setter(val);
    setPage(1);
  };

  // ── Table styles ───────────────────────────────────────────────────────────
  const thSx = {
    fontSize: 11, fontWeight: 600, color: T.textMuted,
    textTransform: 'uppercase', letterSpacing: '0.5px',
    padding: '10px 14px', textAlign: 'left', whiteSpace: 'nowrap',
    backgroundColor: T.pageBg, borderBottom: `1px solid ${T.border}`,
  };
  const tdSx = {
    fontSize: 12.5, color: T.textBody,
    padding: '10px 14px', borderBottom: `1px solid ${T.borderSoft}`,
    verticalAlign: 'middle', backgroundColor: '#FFFFFF',
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: T.pageBg }}>
      <Sidebar currentPage="history" onNavigate={onNavigate} onLogout={onLogout} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <Box sx={{ px: '24px', minHeight: 64, display: 'flex', alignItems: 'center',
          backgroundColor: '#FFFFFF', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
          {view === 'table' && (
            <Button size="small" onClick={handleBack}
              startIcon={<ArrowBackIcon sx={{ fontSize: 14 }} />}
              sx={{ textTransform: 'none', fontSize: 13, color: T.textMuted,
                mr: 1.5, borderRadius: '7px', px: 1.25,
                '&:hover': { backgroundColor: T.borderSoft } }}>
              Back
            </Button>
          )}
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: T.textHead, letterSpacing: '-0.2px' }}>
            {view === 'table' && selectedUpload
              ? selectedUpload.filename
              : 'History'}
          </Typography>
        </Box>

        <Box sx={{ px: '24px', pt: '20px', pb: '28px', overflow: 'auto', flex: 1 }}>

          {/* ── FILE LIST VIEW ── */}
          {view === 'files' && (
            <>
              {uploadsLoading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[1,2,3].map(i => (
                    <Skeleton key={i} variant="rectangular" height={72} sx={{ borderRadius: '10px' }} />
                  ))}
                </Box>
              ) : uploads.length === 0 ? (
                <SCard>
                  <CardContent sx={{ py: 7, textAlign: 'center' }}>
                    <UploadIcon sx={{ fontSize: 38, color: T.textFaint, mb: 1.5 }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead, mb: 0.5 }}>
                      No uploaded files yet
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: T.textMuted, mb: 2 }}>
                      Go to <strong>Data Import</strong> to upload your health dataset.
                    </Typography>
                    <Button size="small" onClick={() => onNavigate?.('dataimport')}
                      startIcon={<UploadIcon sx={{ fontSize: 13 }} />}
                      sx={{ textTransform: 'none', fontSize: 12, fontWeight: 600,
                        color: T.blue, backgroundColor: T.blueDim,
                        border: '1px solid rgba(37,99,235,0.25)', borderRadius: '7px',
                        px: 2, py: 0.75 }}>
                      Go to Data Import
                    </Button>
                  </CardContent>
                </SCard>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Typography sx={{ fontSize: 12, color: T.textMuted, mb: 0.5 }}>
                    {uploads.length} file{uploads.length > 1 ? 's' : ''} uploaded — click a file to view its data
                  </Typography>

                  {/* Delete error banner */}
                  {deleteError && (
                    <Box sx={{
                      p: '10px 14px', borderRadius: '8px',
                      backgroundColor: T.dangerBg || '#FEF2F2',
                      border: `1px solid rgba(220,38,38,0.25)`,
                    }}>
                      <Typography sx={{ fontSize: 12, color: T.danger }}>
                        ⚠ {deleteError}
                      </Typography>
                    </Box>
                  )}

                  {uploads.map(upload => (
                    <FileCard
                      key={upload.id}
                      upload={upload}
                      onClick={() => handleSelectUpload(upload)}
                      onDelete={(u) => { setDeleteError(''); setDeleteTarget(u); }}
                    />
                  ))}
                </Box>
              )}
            </>
          )}

          {/* ── TABLE VIEW ── */}
          {view === 'table' && selectedUpload && (
            <>
              {/* File info strip */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: '14px', flexWrap: 'wrap' }}>
                {selectedUpload.city && (
                  <Chip label={selectedUpload.city} size="small"
                    sx={{ backgroundColor: T.blueDim, color: T.blue, fontWeight: 600, fontSize: 11.5, height: 22, border: `1px solid rgba(37,99,235,0.2)` }} />
                )}
                {selectedUpload.date_range_start && (
                  <Chip label={`${selectedUpload.date_range_start?.slice(0,7)} – ${selectedUpload.date_range_end?.slice(0,7)}`}
                    size="small" icon={<CalendarIcon sx={{ fontSize: 11 }} />}
                    sx={{ fontSize: 11.5, height: 22, backgroundColor: T.pageBg, border: `1px solid ${T.border}` }} />
                )}
                {totalRecords > 0 && (
                  <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
                    {totalRecords.toLocaleString()} total records
                  </Typography>
                )}

                {/* Delete button in table view (top-right) */}
                <Box sx={{ ml: 'auto' }}>
                  <Button
                    size="small"
                    onClick={() => { setDeleteError(''); setDeleteTarget(selectedUpload); }}
                    startIcon={<DeleteIcon sx={{ fontSize: 13 }} />}
                    sx={{
                      textTransform: 'none', fontSize: 12, fontWeight: 600,
                      color: T.danger, borderRadius: '7px', px: 1.5, py: 0.5,
                      border: `1px solid rgba(220,38,38,0.3)`,
                      backgroundColor: T.dangerBg || '#FEF2F2',
                      '&:hover': { backgroundColor: T.danger, color: '#FFFFFF' },
                    }}>
                    Delete File
                  </Button>
                </Box>
              </Box>

              {/* Filters */}
              <SCard sx={{ mb: '14px' }}>
                <CardContent sx={{ p: '12px 16px', '&:last-child': { pb: '12px' } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>
                      Filter:
                    </Typography>
                    <FilterSelect label="Barangay" value={filterBarangay} options={filterOptions.barangays} onChange={handleFilterChange(setFilterBarangay)} />
                    <FilterSelect label="Disease" value={filterDisease} options={filterOptions.diseases} onChange={handleFilterChange(setFilterDisease)} formatOption={getDiseaseLabel} />
                    <FilterSelect label="Year" value={filterYear} options={filterOptions.years.map(String)} onChange={handleFilterChange(setFilterYear)} />
                    <FilterSelect label="Month" value={filterMonth} options={filterOptions.months.map(String)} onChange={handleFilterChange(setFilterMonth)} formatOption={m => MONTH_NAMES[parseInt(m) - 1] || m} />
                    {(filterBarangay || filterDisease || filterYear || filterMonth) && (
                      <Button size="small"
                        onClick={() => { setFilterBarangay(''); setFilterDisease(''); setFilterYear(''); setFilterMonth(''); setPage(1); }}
                        sx={{ textTransform: 'none', fontSize: 11.5, color: T.danger, px: 1, py: 0.25,
                          '&:hover': { backgroundColor: T.dangerBg } }}>
                        Clear filters
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </SCard>

              {/* Table */}
              <SCard>
                <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                  {tableLoading ? (
                    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {Array(8).fill(0).map((_, i) => (
                        <Skeleton key={i} variant="rectangular" height={40} sx={{ borderRadius: '6px' }} />
                      ))}
                    </Box>
                  ) : records.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Typography sx={{ fontSize: 13, color: T.textMuted }}>No records found.</Typography>
                    </Box>
                  ) : (
                    <>
                      <Box sx={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ ...thSx, paddingLeft: 20 }}>Barangay</th>
                              <th style={thSx}>Year</th>
                              <th style={thSx}>Month</th>
                              <th style={thSx}>Disease Category</th>
                              <th style={{ ...thSx, textAlign: 'right' }}>Male</th>
                              <th style={{ ...thSx, textAlign: 'right' }}>Female</th>
                              <th style={{ ...thSx, textAlign: 'right', paddingRight: 20 }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {records.map((row, i) => (
                              <tr key={row.id || i} style={{ backgroundColor: '#FFFFFF' }}>
                                <td style={{ ...tdSx, fontWeight: 600, color: T.textHead, paddingLeft: 20 }}>
                                  {row.barangay}
                                </td>
                                <td style={{ ...tdSx, color: T.textMuted, fontWeight: 500 }}>{row.year}</td>
                                <td style={tdSx}>{MONTH_NAMES[(row.month || 1) - 1]}</td>
                                <td style={tdSx}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <Typography sx={{ fontSize: 12.5, color: T.textBody }}>
                                      {getDiseaseLabel(row.disease_category)}
                                    </Typography>
                                    {row.disease_label && row.disease_label !== row.disease_category && (
                                      <Tooltip title={row.disease_label} placement="top">
                                        <Typography sx={{ fontSize: 11, color: T.textFaint,
                                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                          maxWidth: 160, cursor: 'help' }}>
                                          — {row.disease_label.replace(/^[A-Z0-9]+\.?[0-9]*;\s*/, '')}
                                        </Typography>
                                      </Tooltip>
                                    )}
                                  </Box>
                                </td>
                                <td style={{ ...tdSx, textAlign: 'right', color: '#3B82F6', fontWeight: 600 }}>
                                  {(row.total_male || 0).toLocaleString()}
                                </td>
                                <td style={{ ...tdSx, textAlign: 'right', color: '#EC4899', fontWeight: 600 }}>
                                  {(row.total_female || 0).toLocaleString()}
                                </td>
                                <td style={{ ...tdSx, textAlign: 'right', fontWeight: 700, color: T.textHead, paddingRight: 20 }}>
                                  {(row.total_cases || 0).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </Box>
                      <Pagination
                        page={page}
                        pages={totalPages}
                        total={totalRecords}
                        perPage={PER_PAGE}
                        onPage={setPage}
                      />
                    </>
                  )}
                </CardContent>
              </SCard>
            </>
          )}

        </Box>
      </Box>

      {/* ── Confirm Delete Dialog ── */}
      <ConfirmDeleteDialog
        upload={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        isDeleting={isDeleting}
      />
    </Box>
  );
};

export default History;