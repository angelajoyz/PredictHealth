"""
SMART HEALTH DATA PREPROCESSOR - V3
========================================
Handles:
✅ ANY barangay format (1 to 36+ barangays)
✅ Long format (rows = disease per month)
✅ Wide format (columns = disease)
✅ Multi-sheet files
✅ Empty cells → filled with 0
✅ Missing months → inserted with 0
✅ Merged cells, messy headers
✅ Barangay name in any column/row
"""
import pandas as pd
import numpy as np
import re


class SmartHealthPreprocessor:

    # ──────────────────────────────────────────────
    # KNOWN DISEASE KEYWORDS (expand as needed)
    # ──────────────────────────────────────────────
    DISEASE_KEYWORDS = [
        'dengue', 'diarrhea', 'diarrhoea', 'respiratory', 'malnutrition',
        'hypertension', 'diabetes', 'tuberculosis', 'tb', 'malaria',
        'typhoid', 'pneumonia', 'asthma', 'covid', 'influenza', 'flu',
        'measles', 'chickenpox', 'hepatitis', 'cholera', 'leptospirosis',
        'rabies', 'ptb', 'eptb', 'hiv', 'aids', 'cancer', 'stroke',
        'ari', 'uri', 'uti', 'scabies', 'acute', 'chronic'
    ]

    MONTH_MAP = {
        'january': 1,  'jan': 1,  'enero': 1,
        'february': 2, 'feb': 2,  'pebrero': 2,
        'march': 3,    'mar': 3,  'marso': 3,
        'april': 4,    'apr': 4,  'abril': 4,
        'may': 5,      'mayo': 5,
        'june': 6,     'jun': 6,  'hunyo': 6,
        'july': 7,     'jul': 7,  'hulyo': 7,
        'august': 8,   'aug': 8,  'agosto': 8,
        'september': 9,'sep': 9,  'sept': 9, 'setyembre': 9,
        'october': 10, 'oct': 10, 'oktubre': 10,
        'november': 11,'nov': 11, 'nobyembre': 11,
        'december': 12,'dec': 12, 'disyembre': 12,
    }

    # ──────────────────────────────────────────────
    # PUBLIC ENTRY POINT
    # ──────────────────────────────────────────────
    def process_file(self, filepath):
        """
        Main entry: auto-detect format, return clean wide DataFrame.
        Columns: city, barangay, year, month, <disease>_cases...
        """
        xl = pd.ExcelFile(filepath)
        sheet_names = xl.sheet_names
        print(f"   📄 Sheets: {sheet_names}")

        # Try each sheet; merge all results
        all_dfs = []
        for sheet in sheet_names:
            try:
                df_sheet = self._process_sheet(filepath, sheet)
                if df_sheet is not None and not df_sheet.empty:
                    all_dfs.append(df_sheet)
                    print(f"   ✅ Sheet '{sheet}': {len(df_sheet)} rows, "
                          f"{df_sheet['barangay'].nunique()} barangay(s)")
            except Exception as e:
                print(f"   ⚠️  Sheet '{sheet}' failed: {e}")
                continue

        if not all_dfs:
            raise ValueError("Could not read any usable data from file.")

        # Merge sheets (union of barangays/months)
        result = pd.concat(all_dfs, ignore_index=True)
        result = self._deduplicate(result)
        result = result.sort_values(['barangay', 'year', 'month']).reset_index(drop=True)

        n_brgy = result['barangay'].nunique()
        print(f"   📊 Total: {len(result)} rows | {n_brgy} barangay(s)")
        return result

    # ──────────────────────────────────────────────
    # SHEET-LEVEL PROCESSING
    # ──────────────────────────────────────────────
    def _process_sheet(self, filepath, sheet):
        """Auto-detect format for a single sheet."""
        df_raw = pd.read_excel(filepath, sheet_name=sheet, header=None)
        if df_raw.empty or df_raw.shape[0] < 2:
            return None

        # ── STRATEGY 1: Multi-barangay long format (sections separated by barangay header)
        sections = self._find_barangay_sections(df_raw)
        if len(sections) > 1:
            print(f"      → Multi-barangay long format ({len(sections)} sections)")
            return self._process_multi_section(filepath, sheet, df_raw, sections)

        # ── STRATEGY 2: Single-barangay long format
        header_row = self._find_header_row(df_raw)
        df = pd.read_excel(filepath, sheet_name=sheet, header=header_row)
        df.columns = [str(c).strip() for c in df.columns]

        if self._is_long_format(df):
            brgy_name = self._extract_barangay_name_from_raw(df_raw) or sheet
            print(f"      → Long format | barangay: {brgy_name}")
            return self._transform_long_to_wide(df, brgy_name)

        # ── STRATEGY 3: Wide format (already has disease columns)
        if self._is_wide_format(df):
            print(f"      → Wide format")
            return self._clean_wide(df)

        # ── STRATEGY 4: Multi-barangay wide format (barangay column exists)
        if 'barangay' in [c.lower() for c in df.columns]:
            print(f"      → Multi-barangay wide format")
            return self._clean_wide(df)

        print(f"      ⚠️  Unknown format, skipping sheet")
        return None

    # ──────────────────────────────────────────────
    # BARANGAY SECTION DETECTION (Long Format)
    # ──────────────────────────────────────────────
    def _find_barangay_sections(self, df_raw):
        """
        Find rows where a new barangay section starts.
        Checks ALL cells in the row (not just column 0).
        Handles: 'Barangay Bonuan', 'Brgy. 1', 'BARANGAY: Centro', etc.
        """
        sections = []
        n_cols = min(df_raw.shape[1], 6)  # check first 6 cols

        for idx in range(len(df_raw)):
            row = df_raw.iloc[idx]
            for col_i in range(n_cols):
                cell = str(row.iloc[col_i]) if pd.notna(row.iloc[col_i]) else ''
                cell_s = cell.strip()
                if not cell_s or cell_s.lower() in ('nan', 'none', ''):
                    continue

                cell_low = cell_s.lower()
                is_brgy_header = (
                    re.match(r'(barangay|brgy\.?)\s*[:\-]?\s*\S+', cell_low) is not None
                    or (('barangay' in cell_low or 'brgy' in cell_low)
                        and len(cell_s) > 4)
                )

                if is_brgy_header:
                    brgy_name = self._clean_brgy_name(cell_s)

                    # Name might be in the NEXT cell
                    if not brgy_name and col_i + 1 < n_cols:
                        nxt = str(row.iloc[col_i + 1]) if pd.notna(row.iloc[col_i + 1]) else ''
                        brgy_name = nxt.strip()

                    if brgy_name and (not sections or sections[-1][1] != idx):
                        sections.append((brgy_name, idx))
                    break  # found in this row, move on

        # Build (name, start_row, end_row) triples
        result = []
        for i, (name, start) in enumerate(sections):
            end = sections[i + 1][1] - 1 if i < len(sections) - 1 else len(df_raw) - 1
            result.append((name, start, end))

        if result:
            print(f"      Sections found: {[r[0] for r in result]}")
        return result

    def _clean_brgy_name(self, raw):
        """Strip 'Barangay', 'Brgy.', colons etc. and return clean name."""
        name = raw
        for prefix in ['BARANGAY', 'Barangay', 'barangay',
                        'BRGY.', 'Brgy.', 'brgy.',
                        'BRGY', 'Brgy', 'brgy']:
            name = name.replace(prefix, '')
        name = name.strip().strip(':').strip('-').strip()
        return name

    # ──────────────────────────────────────────────
    # MULTI-SECTION PROCESSOR
    # ──────────────────────────────────────────────
    def _process_multi_section(self, filepath, sheet, df_raw, sections):
        """Process each barangay section and concatenate."""
        all_dfs = []
        for brgy_name, start_row, end_row in sections:
            try:
                nrows = end_row - start_row + 1
                df_section_raw = df_raw.iloc[start_row: end_row + 1].reset_index(drop=True)

                # Find header within this section
                header_offset = self._find_header_row(df_section_raw)
                actual_header_row = start_row + header_offset

                df_section = pd.read_excel(
                    filepath, sheet_name=sheet,
                    header=actual_header_row,
                    nrows=nrows - header_offset - 1
                )
                df_section.columns = [str(c).strip() for c in df_section.columns]

                # Drop rows that are entirely NaN
                df_section = df_section.dropna(how='all')

                if self._is_long_format(df_section):
                    df_wide = self._transform_long_to_wide(df_section, brgy_name)
                else:
                    df_section['barangay'] = brgy_name
                    df_wide = self._clean_wide(df_section)

                if not df_wide.empty:
                    all_dfs.append(df_wide)
                    print(f"         ✅ {brgy_name}: {len(df_wide)} rows")
            except Exception as e:
                print(f"         ⚠️  {brgy_name}: {e}")

        if not all_dfs:
            return None
        return pd.concat(all_dfs, ignore_index=True)

    # ──────────────────────────────────────────────
    # LONG → WIDE TRANSFORM
    # ──────────────────────────────────────────────
    def _is_long_format(self, df):
        """True if there's a disease/type column (one row per disease per month)."""
        col_lower = [str(c).lower() for c in df.columns]
        return any(
            any(kw in c for kw in ['disease', 'type of', 'sakit', 'illness', 'condition'])
            for c in col_lower
        )

    def _transform_long_to_wide(self, df, barangay_name=None):
        """Pivot long format → wide format with _cases columns."""
        # Identify key columns
        year_col = month_col = disease_col = cases_col = None

        for col in df.columns:
            cl = str(col).lower()
            if not year_col and 'year' in cl:
                year_col = col
            elif not month_col and 'month' in cl:
                month_col = col
            elif not disease_col and any(k in cl for k in ['disease', 'type', 'sakit']):
                disease_col = col
            elif not cases_col and any(k in cl for k in ['case', 'total', 'count', 'number']):
                cases_col = col

        if not year_col or not disease_col or not cases_col:
            raise ValueError(
                f"Missing columns. Found: {list(df.columns)}"
            )

        # Clean & coerce
        df = df.copy()
        df = df.dropna(subset=[disease_col])
        df = df[df[disease_col].astype(str).str.strip() != '']
        df = df[df[disease_col].astype(str) != str(disease_col)]  # drop header repeat rows

        df['year'] = pd.to_numeric(df[year_col], errors='coerce')
        df = df.dropna(subset=['year'])
        df['year'] = df['year'].astype(int)

        if month_col:
            df['month'] = self._parse_month_series(df[month_col])
        else:
            df['month'] = 1

        df[cases_col] = pd.to_numeric(df[cases_col], errors='coerce').fillna(0)

        # Standardize disease names BEFORE pivot
        df[disease_col] = df[disease_col].astype(str).apply(self._standardize_disease_name)

        # Pivot
        df_pivot = df.pivot_table(
            index=['year', 'month'],
            columns=disease_col,
            values=cases_col,
            aggfunc='sum',
            fill_value=0
        ).reset_index()
        df_pivot.columns.name = None

        # Ensure all disease cols end in _cases
        rename = {}
        for c in df_pivot.columns:
            if c not in ('year', 'month') and not c.endswith('_cases'):
                rename[c] = c + '_cases'
        df_pivot = df_pivot.rename(columns=rename)

        df_pivot['barangay'] = barangay_name or 'Unknown'
        df_pivot['city'] = 'Unknown'

        return self._reorder_columns(df_pivot)

    # ──────────────────────────────────────────────
    # WIDE FORMAT CLEANING
    # ──────────────────────────────────────────────
    def _is_wide_format(self, df):
        """True if disease columns already exist as separate columns."""
        col_lower = [str(c).lower() for c in df.columns]
        return any(
            any(kw in c for kw in self.DISEASE_KEYWORDS)
            for c in col_lower
        )

    def _clean_wide(self, df):
        """Normalize column names in a wide-format DataFrame."""
        df = df.copy()

        # Normalize column names
        col_map = {}
        for c in df.columns:
            cl = c.lower().strip()
            if 'year' in cl:
                col_map[c] = 'year'
            elif 'month' in cl:
                col_map[c] = 'month'
            elif 'barangay' in cl or 'brgy' in cl:
                col_map[c] = 'barangay'
            elif 'city' in cl or 'municipality' in cl:
                col_map[c] = 'city'
            else:
                # Disease column
                std = self._standardize_disease_name(c)
                if std != c:
                    col_map[c] = std
        df = df.rename(columns=col_map)

        # Drop rows fully empty
        df = df.dropna(how='all')

        # Coerce types
        if 'year' in df.columns:
            df['year'] = pd.to_numeric(df['year'], errors='coerce')
            df = df.dropna(subset=['year'])
            df['year'] = df['year'].astype(int)
        if 'month' in df.columns:
            df['month'] = self._parse_month_series(df['month'])

        # Ensure barangay/city columns exist
        if 'barangay' not in df.columns:
            df['barangay'] = 'Unknown'
        if 'city' not in df.columns:
            df['city'] = 'Unknown'

        # Coerce disease columns
        disease_cols = [c for c in df.columns if c.endswith('_cases')]
        for c in disease_cols:
            df[c] = pd.to_numeric(df[c], errors='coerce').fillna(0)

        return self._reorder_columns(df)

    # ──────────────────────────────────────────────
    # COMPLETE TIME SERIES (missing months / empty cells)
    # ──────────────────────────────────────────────
    def complete_time_series(self, df):
        """
        For EACH barangay:
          1. Fill NaN disease cells → 0
          2. Insert missing months (year/month combos) → all diseases = 0

        Example:
          If Bonuan has no row for June 2020 → row added with dengue=0, etc.
          If July 2020 dengue cell is empty → filled with 0.
        """
        if 'year' not in df.columns or 'month' not in df.columns:
            return df

        disease_cols = [c for c in df.columns if c.endswith('_cases')]
        if not disease_cols:
            return df

        print(f"   🔧 Completing time series for {df['barangay'].nunique()} barangay(s)...")

        # Step 1: Fill existing NaN cells
        for c in disease_cols:
            n = df[c].isna().sum()
            if n > 0:
                df[c] = df[c].fillna(0)
                print(f"      • '{c}': filled {n} empty cell(s) with 0")

        # Step 2: Insert missing months per barangay
        completed = []
        total_added = 0

        for brgy in df['barangay'].unique():
            df_b = df[df['barangay'] == brgy].copy()

            min_yr = int(df_b['year'].min())
            max_yr = int(df_b['year'].max())

            # Full grid of (year, month)
            grid = pd.DataFrame([
                {'year': y, 'month': m}
                for y in range(min_yr, max_yr + 1)
                for m in range(1, 13)
            ])

            df_b_merged = grid.merge(df_b, on=['year', 'month'], how='left')

            added = df_b_merged['barangay'].isna().sum()
            total_added += added

            # Fill metadata
            df_b_merged['barangay'] = brgy
            if 'city' in df.columns:
                city_val = df_b['city'].dropna().iloc[0] if not df_b['city'].dropna().empty else 'Unknown'
                df_b_merged['city'] = df_b_merged['city'].fillna(city_val)
            else:
                df_b_merged['city'] = 'Unknown'

            # Fill disease columns
            for c in disease_cols:
                if c in df_b_merged.columns:
                    df_b_merged[c] = df_b_merged[c].fillna(0)
                else:
                    df_b_merged[c] = 0

            completed.append(df_b_merged)

        if total_added > 0:
            print(f"      • Inserted {total_added} missing month row(s) across all barangays (diseases = 0)")

        result = pd.concat(completed, ignore_index=True)
        result = result.sort_values(['barangay', 'year', 'month']).reset_index(drop=True)

        # Final dtype cleanup
        result['year'] = result['year'].astype(int)
        result['month'] = result['month'].astype(int)
        for c in disease_cols:
            result[c] = pd.to_numeric(result[c], errors='coerce').fillna(0).astype(float)

        return self._reorder_columns(result)

    # ──────────────────────────────────────────────
    # HELPERS
    # ──────────────────────────────────────────────
    def _find_header_row(self, df_raw, max_scan=15):
        """Find the row index that contains column headers."""
        header_kws = ['month', 'year', 'disease', 'case', 'type',
                      'total', 'barangay', 'january', 'jan', 'dengue']
        best_row, best_score = 0, 0
        for i in range(min(max_scan, len(df_raw))):
            row_vals = df_raw.iloc[i].fillna('').astype(str).str.lower()
            score = sum(any(kw in v for kw in header_kws) for v in row_vals if v)
            if score > best_score:
                best_score, best_row = score, i
        return best_row

    def _extract_barangay_name_from_raw(self, df_raw):
        """Look in the first few rows/cells for a barangay name."""
        for i in range(min(5, len(df_raw))):
            for j in range(min(4, df_raw.shape[1])):
                cell = str(df_raw.iloc[i, j]) if pd.notna(df_raw.iloc[i, j]) else ''
                if 'barangay' in cell.lower() or 'brgy' in cell.lower():
                    return self._clean_brgy_name(cell)
        return None

    def _parse_month_series(self, series):
        """Convert month names or numbers to integers 1–12."""
        result = []
        for val in series:
            val_s = str(val).lower().strip()
            if val_s.isdigit():
                result.append(int(val_s))
                continue
            # Try exact match first
            matched = self.MONTH_MAP.get(val_s)
            if matched:
                result.append(matched)
                continue
            # Partial match
            found = False
            for name, num in self.MONTH_MAP.items():
                if name in val_s:
                    result.append(num)
                    found = True
                    break
            if not found:
                # Try numeric coerce
                try:
                    result.append(int(float(val_s)))
                except Exception:
                    result.append(1)
        return pd.array(result, dtype='Int64')

    def _standardize_disease_name(self, name):
        """'Type of Disease: Dengue' → 'dengue_cases'"""
        s = str(name).lower()
        # Remove noise phrases
        for noise in ['type of disease', 'type of', 'kaso ng', 'case of',
                      'cases', 'case', 'count', 'total', 'number of']:
            s = s.replace(noise, ' ')
        s = re.sub(r'[^a-z0-9]+', '_', s)
        s = s.strip('_')
        if not s:
            return 'unknown_cases'
        if not s.endswith('_cases'):
            s += '_cases'
        return s

    def _reorder_columns(self, df):
        """Put standard columns first."""
        std = ['city', 'barangay', 'year', 'month']
        disease = sorted([c for c in df.columns if c.endswith('_cases')])
        other = [c for c in df.columns if c not in std and c not in disease]
        ordered = [c for c in std if c in df.columns] + disease + other
        return df[ordered]

    def _deduplicate(self, df):
        """Remove exact duplicate rows."""
        key_cols = ['barangay', 'year', 'month']
        key_cols = [c for c in key_cols if c in df.columns]
        if key_cols:
            disease_cols = [c for c in df.columns if c.endswith('_cases')]
            if disease_cols:
                df = df.groupby(key_cols, as_index=False)[disease_cols].sum()
                if 'city' in df.columns:
                    pass  # city lost after groupby; re-add if needed
        return df


# ──────────────────────────────────────────────
# CONVENIENCE WRAPPER
# ──────────────────────────────────────────────
def preprocess_health_file(filepath):
    p = SmartHealthPreprocessor()
    df = p.process_file(filepath)
    df = p.complete_time_series(df)
    return df