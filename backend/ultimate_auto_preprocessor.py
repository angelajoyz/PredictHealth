"""
ULTIMATE AUTO-PREPROCESSOR v2 (PATCHED)
Handles ANY health data format automatically:
1. Individual case records (1 row = 1 patient)
2. Aggregated long format (Type of Disease column)
3. Wide format (diseases as columns)
4. Multi-barangay sections
5. Mixed/unknown formats
6. ✅ NEW: Wide pivoted (months as columns)
7. ✅ NEW: Multi-sheet merge
8. ✅ NEW: Free-form scan (any layout)

Strategy: Detect format → Apply correct transformation → Return standard wide format
"""
import pandas as pd
import numpy as np
import re
import os

# ── Disease keyword list (expanded) ──────────────────────────────────────────
DISEASE_KEYWORDS = [
    'dengue', 'diarrhea', 'diarrhoea', 'respiratory', 'malnutrition',
    'hypertension', 'diabetes', 'tuberculosis', 'tb', 'measles',
    'influenza', 'flu', 'hfmd', 'covid', 'pneumonia', 'typhoid',
    'leptospirosis', 'lepto', 'cholera', 'hepatitis', 'ari', 'uri', 'uti',
    'rabies', 'malaria', 'sakit', 'karamdaman',
]

MONTH_MAP = {
    'jan': 1, 'january': 1, 'feb': 2, 'february': 2,
    'mar': 3, 'march': 3, 'apr': 4, 'april': 4,
    'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
    'aug': 8, 'august': 8, 'sep': 9, 'sept': 9, 'september': 9,
    'oct': 10, 'october': 10, 'nov': 11, 'november': 11,
    'dec': 12, 'december': 12,
}


class UltimateAutoPreprocessor:
    def __init__(self):
        self.metadata_blacklist = {
            'year', 'month', 'week', 'day', 'date', 'time',
            'sex', 'gender', 'male', 'female', 'age', 'agegroup',
            'city', 'municipality', 'province', 'region',
            'population', 'density', 'facility', 'facilities',
            'temperature', 'rainfall', 'humidity', 'climate',
            'poverty', 'income', 'employment', 'literacy',
            'id', 'no', 'number', 'row', 'index', 'unnamed'
        }
        self.disease_keywords = DISEASE_KEYWORDS

    # ─────────────────────────────────────────────────────────────────────────
    # PUBLIC API
    # ─────────────────────────────────────────────────────────────────────────

    def process_file(self, filepath):
        """Main entry: Auto-detect format and process ANY Excel/CSV file"""
        print(f"\n{'='*80}")
        print(f"🔍 ULTIMATE AUTO-PREPROCESSING")
        print(f"{'='*80}\n")

        if filepath.lower().endswith('.csv'):
            df_raw = self._read_csv_smart(filepath)
            return self._process_by_format(df_raw)

        else:
            # ── Try multi-barangay section detection ─────────────────────────
            try:
                df_test = pd.read_excel(filepath, sheet_name=0, header=None)
                barangay_sections = self._find_barangay_sections(df_test)
                if len(barangay_sections) > 1:
                    print(f"   📍 Detected {len(barangay_sections)} barangay sections")
                    return self._process_multi_barangay_sections(filepath, barangay_sections)
            except Exception as e:
                print(f"   ⚠️ Multi-barangay check failed: {e}")

            # ── Try each sheet ───────────────────────────────────────────────
            try:
                xl = pd.ExcelFile(filepath,
                                  engine='openpyxl' if filepath.endswith('.xlsx') else 'xlrd')
            except Exception as e:
                raise ValueError(f"Cannot open Excel file: {e}")

            last_error = None
            for sheet in xl.sheet_names:
                try:
                    df_raw = pd.read_excel(filepath, sheet_name=sheet,
                                           header=None,
                                           engine='openpyxl' if filepath.endswith('.xlsx') else 'xlrd')
                    df_raw = self._promote_header(df_raw)
                    if df_raw.empty or len(df_raw.columns) < 2:
                        continue
                    print(f"   📄 Using sheet: {sheet}")
                    result = self._process_by_format(df_raw, sheet_name=sheet)
                    if result is not None and not result.empty:
                        return result
                except Exception as e:
                    last_error = e
                    print(f"   ⚠️ Failed sheet '{sheet}': {e}")
                    continue

            # ── Multi-sheet merge ────────────────────────────────────────────
            try:
                result = self._merge_all_sheets(filepath, xl)
                if result is not None and not result.empty:
                    return result
            except Exception as e:
                print(f"   ⚠️ Multi-sheet merge failed: {e}")

            raise ValueError(
                f"Could not read any valid data from file. "
                f"Last error: {last_error}"
            )

    # ─────────────────────────────────────────────────────────────────────────
    # FORMAT DISPATCHER
    # ─────────────────────────────────────────────────────────────────────────

    def _process_by_format(self, df_raw, sheet_name=''):
        """Detect format and process accordingly"""
        format_type = self._detect_format(df_raw)
        print(f"📋 Detected format: {format_type}")

        if format_type == 'individual_cases':
            df_result = self._process_individual_cases(df_raw)
        elif format_type == 'long_aggregated':
            df_result = self._process_long_aggregated(df_raw)
        elif format_type == 'wide':
            df_result = self._process_wide(df_raw)
        elif format_type == 'wide_pivoted':
            df_result = self._process_wide_pivoted(df_raw, sheet_name)
        else:
            df_result = self._try_salvage(df_raw, sheet_name)

        if df_result is None or df_result.empty:
            return None

        df_result = self._standardize_output(df_result)

        disease_cols = [c for c in df_result.columns if c.endswith('_cases')]
        barangays = df_result['barangay'].nunique() if 'barangay' in df_result.columns else 0
        print(f"\n✅ Processing complete! Barangays: {barangays} | "
              f"Diseases: {len(disease_cols)} | Rows: {len(df_result)}")
        return df_result

    # ─────────────────────────────────────────────────────────────────────────
    # FORMAT DETECTION
    # ─────────────────────────────────────────────────────────────────────────

    def _detect_format(self, df):
        """Detect which format the data is in."""
        col_lower = [str(c).lower() for c in df.columns]

        tagalog_demographic  = ['edad', 'kasarian', 'sex', 'gender', 'age', 'gulang']
        # ✅ FIXED: added 'case' (singular) as disease column indicator
        tagalog_disease_col  = ['sakit', 'karamdaman', 'diagnosis', 'disease',
                                 'uri ng sakit', 'case', 'illness', 'condition']
        tagalog_total        = ['bilang', 'kabuuan', 'total', 'count', 'cases', 'kaso']

        # ✅ FIXED: detect individual records even without demographic columns
        # Layout: year | month | week | barangay | sex | age | case
        has_demographic        = any(any(x in col for x in tagalog_demographic) for col in col_lower)
        has_single_disease_col = any(col.strip() in tagalog_disease_col for col in col_lower)

        # Check if disease column has disease-name VALUES (not numbers)
        if has_single_disease_col:
            for col in df.columns:
                if str(col).lower().strip() in tagalog_disease_col:
                    sample = df[col].dropna().astype(str).str.lower().unique()[:10]
                    # If values are disease names (not numbers), it's individual/long
                    non_numeric = [v for v in sample if not re.match(r'^\d+(\.\d+)?$', v)]
                    if len(non_numeric) >= 1:
                        if has_demographic:
                            return 'individual_cases'
                        else:
                            return 'long_aggregated'

        if has_demographic and has_single_disease_col:
            return 'individual_cases'

        # Wide pivoted (month names as columns)
        month_cols = [c for c in df.columns
                      if isinstance(c, str) and c.lower().strip()[:3] in MONTH_MAP]
        if len(month_cols) >= 3:
            return 'wide_pivoted'

        # Long aggregated
        has_disease_type = any(
            ('type' in col and 'disease' in col) or
            ('uri' in col and 'sakit' in col) or
            ('klase' in col)
            for col in col_lower
        )
        has_total_cases = any(any(x in col for x in tagalog_total) for col in col_lower)
        if has_disease_type or (has_single_disease_col and has_total_cases):
            return 'long_aggregated'

        # Wide format
        extended = self.disease_keywords + [
            'flu', 'aki', 'ari', 'leptospira', 'rabies', 'cholera',
            'typhoid', 'hepatitis', 'chicken', 'mumps', 'pertussis',
        ]
        disease_cols = [
            col for col in df.columns
            if any(kw in str(col).lower() for kw in extended)
            and not any(skip in str(col).lower() for skip in self.metadata_blacklist)
        ]
        if len(disease_cols) >= 2:
            return 'wide'

        # Detect via cell values
        for col in df.columns:
            if df[col].dtype == 'object':
                unique_vals = df[col].dropna().astype(str).str.lower().unique()
                disease_hits = sum(1 for v in unique_vals
                                   if any(kw in v for kw in extended))
                if disease_hits >= 2:
                    return 'long_aggregated'

        return 'unknown'

    # ─────────────────────────────────────────────────────────────────────────
    # FORMAT PROCESSORS
    # ─────────────────────────────────────────────────────────────────────────

    def _process_individual_cases(self, df):
        """
        Process individual patient records.
        Handles: year | month | [week] | barangay | [sex] | [age] | case/disease
        """
        print("   📊 Processing individual case records...")
        year_col     = self._find_column(df, ['year', 'yr', 'taon'])
        month_col    = self._find_column(df, ['month', 'mo', 'buwan'])
        barangay_col = self._find_column(df, ['barangay', 'brgy', 'bgy', 'lugar'])
        # ✅ FIXED: 'case' (singular) is the disease column in this format
        disease_col  = self._find_column(df, ['case', 'disease', 'diagnosis',
                                               'sakit', 'illness', 'condition',
                                               'karamdaman'])

        if not year_col:
            raise ValueError("Missing 'year' column")
        if not disease_col:
            raise ValueError("Missing disease/case column")

        if not barangay_col:
            df = df.copy()
            df['barangay'] = 'Unknown'
            barangay_col = 'barangay'

        if not month_col:
            df = df.copy()
            df['month'] = 1
            month_col = 'month'

        # Clean disease values — standardize names
        df = df.copy()
        df['_disease_std'] = df[disease_col].astype(str).apply(
            self._standardize_disease_name
        )
        # Drop rows where disease couldn't be standardized
        df = df[df['_disease_std'] != '']

        if df.empty:
            raise ValueError("No recognizable disease names found in case column")

        # Group by barangay + year + month + disease → count patients
        group_cols = [year_col, month_col, barangay_col, '_disease_std']
        df_grouped = df.groupby(group_cols).size().reset_index(name='count')
        df_grouped = df_grouped.rename(columns={
            year_col:     'year',
            month_col:    'month',
            barangay_col: 'barangay',
        })

        # Pivot: one column per disease
        df_wide = df_grouped.pivot_table(
            index=['barangay', 'year', 'month'],
            columns='_disease_std',
            values='count',
            fill_value=0
        ).reset_index()
        df_wide.columns.name = None

        diseases_found = [c for c in df_wide.columns
                         if c not in ['barangay', 'year', 'month']]
        print(f"      ✅ Individual records grouped — diseases: {diseases_found}")
        return df_wide

    def _process_long_aggregated(self, df):
        print("   📊 Processing long aggregated format...")
        year_col     = self._find_column(df, ['year'])
        month_col    = self._find_column(df, ['month'])
        barangay_col = self._find_column(df, ['barangay', 'brgy'])
        disease_col  = self._find_column(df, ['disease', 'type', 'case', 'sakit'])
        cases_col    = self._find_column(df, ['total', 'count', 'cases', 'bilang', 'kabuuan'])

        if not barangay_col:
            df['barangay'] = 'Unknown'
            barangay_col = 'barangay'

        if not disease_col or not cases_col:
            return None

        df = df.dropna(subset=[disease_col, cases_col])
        df[cases_col] = pd.to_numeric(df[cases_col], errors='coerce').fillna(0)

        df = df.rename(columns={barangay_col: 'barangay'})
        if year_col:
            df = df.rename(columns={year_col: 'year'})
        if month_col:
            df = df.rename(columns={month_col: 'month'})

        idx_cols = [c for c in ['barangay', 'year', 'month'] if c in df.columns]
        df_wide = df.pivot_table(
            index=idx_cols, columns=disease_col,
            values=cases_col, aggfunc='sum', fill_value=0
        ).reset_index()
        df_wide.columns.name = None
        rename_map = {col: self._standardize_disease_name(col)
                      for col in df_wide.columns
                      if col not in ['barangay', 'year', 'month', 'city']}
        return df_wide.rename(columns=rename_map)

    def _process_wide(self, df):
        print("   📊 Processing wide format...")
        rename_map = {}
        for col in df.columns:
            lc = str(col).lower()
            if 'barangay' in lc or 'brgy' in lc or 'bgy' in lc:
                rename_map[col] = 'barangay'
            elif lc in ('year', 'yr', 'taon'):
                rename_map[col] = 'year'
            elif lc in ('month', 'mo', 'buwan'):
                rename_map[col] = 'month'
            elif any(kw in lc for kw in self.disease_keywords):
                canon = self._standardize_disease_name(col)
                if canon:
                    rename_map[col] = canon
        df = df.rename(columns=rename_map)
        if 'barangay' not in df.columns:
            df['barangay'] = 'Unknown'
        return df

    def _process_wide_pivoted(self, df, sheet_name=''):
        """✅ NEW: Handles wide-pivoted layout where month names are column headers."""
        print("   📊 Processing wide-pivoted format (month columns)...")

        month_cols = {c: MONTH_MAP[c.lower().strip()[:3]]
                      for c in df.columns
                      if isinstance(c, str) and c.lower().strip()[:3] in MONTH_MAP}

        brgy_col    = self._find_column(df, ['barangay', 'brgy', 'bgy', 'location', 'lugar'])
        disease_col = self._find_column(df, ['disease', 'sakit', 'karamdaman', 'type'])
        year        = self._extract_year(sheet_name)

        rows = []
        if disease_col and brgy_col:
            for _, row in df.iterrows():
                brgy    = str(row[brgy_col]).strip()
                disease = str(row[disease_col]).strip()
                if not brgy or brgy.lower() in ('nan', '', 'total'):
                    continue
                canon = self._standardize_disease_name(disease)
                if not canon:
                    continue
                for col, month_num in month_cols.items():
                    rows.append({'barangay': brgy, 'year': year,
                                 'month': month_num, canon: self._safe_int(row.get(col, 0))})
        elif brgy_col:
            disease_name = self._standardize_disease_name(sheet_name) or 'dengue_cases'
            for _, row in df.iterrows():
                brgy = str(row[brgy_col]).strip()
                if not brgy or brgy.lower() in ('nan', '', 'total'):
                    continue
                for col, month_num in month_cols.items():
                    rows.append({'barangay': brgy, 'year': year,
                                 'month': month_num,
                                 disease_name: self._safe_int(row.get(col, 0))})

        if not rows:
            return None

        out  = pd.DataFrame(rows)
        grp  = ['barangay', 'year', 'month']
        dcols = [c for c in out.columns if c not in grp]
        return out.groupby(grp, as_index=False)[dcols].sum()

    def _try_salvage(self, df, sheet_name=''):
        """Last resort: improved salvage with free-form scan."""
        print("   ⚠️ Unknown format — trying salvage strategies...")

        # Strategy A: many numeric columns → wide
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) >= 3:
            print("      → Trying wide format interpretation")
            result = self._process_wide(df)
            if result is not None and 'barangay' in result.columns:
                return result

        # Strategy B: disease values in a column → aggregated
        for col in df.columns:
            if df[col].dtype == 'object' and df[col].nunique() < 20:
                unique_vals = df[col].dropna().unique()
                disease_matches = sum(1 for v in unique_vals
                                      if any(kw in str(v).lower()
                                             for kw in self.disease_keywords))
                if disease_matches >= 2:
                    print("      → Found disease column, trying aggregated format")
                    result = self._process_long_aggregated(df)
                    if result is not None:
                        return result

        # Strategy C: free-form scan
        print("      → Free-form scan...")
        result = self._free_form_scan(df, sheet_name)
        if result is not None and not result.empty:
            return result

        # Strategy D: minimal safe fallback — extract barangay names at least
        print("      → Minimal fallback: extracting barangay names only")
        text_cols = df.select_dtypes(include='object').columns
        if len(text_cols) > 0:
            brgy_col = text_cols[0]
            brgys = (df[brgy_col].dropna().astype(str).str.strip()
                     .pipe(lambda s: s[s.str.len() > 2])
                     .unique().tolist())
            brgys = [b for b in brgys
                     if not re.match(r'^\d+$', b)
                     and b.lower() not in ('nan', 'none', 'total')]
            if brgys:
                return pd.DataFrame({
                    'barangay': brgys,
                    'year':     [2020] * len(brgys),
                    'month':    [1] * len(brgys),
                    'dengue_cases': [0] * len(brgys),
                })
        return pd.DataFrame({
            'barangay': ['Unknown'], 'year': [2020],
            'month': [1], 'dengue_cases': [0]
        })

    # ─────────────────────────────────────────────────────────────────────────
    # ✅ NEW STRATEGIES
    # ─────────────────────────────────────────────────────────────────────────

    def _free_form_scan(self, df, sheet_name=''):
        """Scan every row for barangay-like text + adjacent numbers."""
        year    = self._extract_year(sheet_name)
        generic = ['dengue_cases', 'diarrhea_cases', 'respiratory_cases',
                   'tuberculosis_cases', 'pneumonia_cases', 'influenza_cases']
        all_rows = []
        for _, row in df.iterrows():
            vals = [str(v).strip() for v in row.tolist()]
            brgy = None
            nums = []
            for v in vals:
                if self._looks_like_barangay(v):
                    brgy = v
                elif self._looks_like_number(v):
                    nums.append(self._safe_int(v))
            if brgy and nums:
                record = {'barangay': brgy, 'year': year, 'month': 1}
                for i, val in enumerate(nums[:len(generic)]):
                    record[generic[i]] = val
                all_rows.append(record)
        return pd.DataFrame(all_rows) if all_rows else None

    def _merge_all_sheets(self, filepath, xl):
        """✅ NEW: Merge multiple sheets (one per barangay or per year)."""
        print("   🔄 Trying multi-sheet merge...")
        engine = 'openpyxl' if filepath.endswith('.xlsx') else 'xlrd'
        parts  = []
        for sheet in xl.sheet_names:
            try:
                df = pd.read_excel(filepath, sheet_name=sheet,
                                   header=None, engine=engine)
                df = self._promote_header(df)
                if df.empty or len(df.columns) < 2:
                    continue
                df = self._rename_known_cols(df)
                if 'barangay' not in df.columns:
                    df['barangay'] = sheet.strip()
                if 'year' not in df.columns:
                    df['year'] = self._extract_year(sheet)
                if 'month' not in df.columns:
                    df['month'] = 1
                if self._has_disease_data(df):
                    parts.append(df)
            except Exception:
                continue

        if len(parts) >= 2:
            combined = pd.concat(parts, ignore_index=True)
            return self._standardize_output(combined)
        return None

    # ─────────────────────────────────────────────────────────────────────────
    # MULTI-BARANGAY SECTIONS (unchanged from original)
    # ─────────────────────────────────────────────────────────────────────────

    def _find_barangay_sections(self, df_raw):
        sections = []
        for idx in range(len(df_raw)):
            first_cell = str(df_raw.iloc[idx, 0]).strip()
            if 'barangay' in first_cell.lower() and len(first_cell) > 8:
                sections.append(idx)
        return sections

    def _process_multi_barangay_sections(self, filepath, sections):
        print(f"   🔄 Using SmartHealthPreprocessor for multi-barangay format...")
        try:
            import sys
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            from backend.smart_health_preprocessor import SmartHealthPreprocessor
            preprocessor = SmartHealthPreprocessor()
            df = preprocessor.process_file(filepath)
            df = preprocessor.complete_time_series(df)
            print(f"      ✅ SmartHealthPreprocessor succeeded")
            return df
        except ImportError:
            print(f"      ⚠️ SmartHealthPreprocessor not available")
            return self._process_manual_multibarangay(filepath, sections)
        except Exception as e:
            print(f"      ⚠️ SmartHealthPreprocessor failed: {e}")
            raise

    def _process_manual_multibarangay(self, filepath, sections):
        engine  = 'openpyxl' if filepath.endswith('.xlsx') else 'xlrd'
        df_raw  = pd.read_excel(filepath, sheet_name=0, header=None, engine=engine)
        parts   = []
        for i, start in enumerate(sections):
            end        = sections[i+1] if i+1 < len(sections) else len(df_raw)
            chunk      = df_raw.iloc[start:end].copy()
            brgy_name  = re.sub(r'(?i)barangay\s*:?\s*', '',
                                str(df_raw.iloc[start, 0])).strip()
            chunk      = chunk.iloc[1:].reset_index(drop=True)
            chunk      = self._promote_header(chunk)
            chunk      = self._rename_known_cols(chunk)
            chunk['barangay'] = brgy_name
            if self._has_disease_data(chunk):
                parts.append(chunk)
        return pd.concat(parts, ignore_index=True) if parts else None

    # ─────────────────────────────────────────────────────────────────────────
    # CSV READER (unchanged from original)
    # ─────────────────────────────────────────────────────────────────────────

    def _read_csv_smart(self, filepath):
        print(f"   CSV reading: {filepath}")
        encodings = ["utf-8-sig", "utf-8", "latin-1", "cp1252", "iso-8859-1"]
        raw_lines = []
        used_encoding = "utf-8"
        for enc in encodings:
            try:
                with open(filepath, "r", encoding=enc, errors="strict") as f:
                    raw_lines = f.readlines()
                used_encoding = enc
                break
            except (UnicodeDecodeError, LookupError):
                continue

        if not raw_lines:
            raise ValueError("Could not read CSV with any known encoding")

        sample = "".join(raw_lines[:10])
        sep_candidates = [(",", sample.count(",")), (";", sample.count(";")),
                          ("\t", sample.count("\t")), ("|", sample.count("|"))]
        separator = max(sep_candidates, key=lambda x: x[1])[0]

        health_keywords = ["barangay", "brgy", "year", "month", "disease", "cases",
                           "dengue", "diarrhea", "city", "type", "total", "buwan", "taon"]
        header_row = 0
        for i, line in enumerate(raw_lines[:15]):
            cols_in_line = [c.strip().lower() for c in line.split(separator)]
            matches = sum(1 for c in cols_in_line
                         if any(kw in c for kw in health_keywords))
            if matches >= 2:
                header_row = i
                break

        try:
            df = pd.read_csv(filepath, sep=separator, encoding=used_encoding,
                             skiprows=header_row, on_bad_lines="skip")
        except Exception:
            df = pd.read_csv(filepath, encoding=used_encoding, on_bad_lines="skip")

        df = df.dropna(how="all").reset_index(drop=True)
        df = df.loc[:, ~df.columns.str.match(r"^Unnamed")]
        print(f"      CSV loaded: {df.shape[0]} rows x {df.shape[1]} cols")
        return df

    # ─────────────────────────────────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────────────────────────────────

    def _promote_header(self, df):
        """Find the real header row and promote it."""
        if df.empty:
            return df
        health_kw = ['barangay', 'brgy', 'year', 'month', 'disease',
                     'cases', 'dengue', 'city', 'type', 'total']
        for i in range(min(10, len(df))):
            row_vals = [str(v).lower().strip() for v in df.iloc[i] if pd.notna(v)]
            hits     = sum(1 for v in row_vals if any(kw in v for kw in health_kw))
            if hits >= 2:
                df.columns = [str(v).strip() if pd.notna(v) else f'col_{j}'
                              for j, v in enumerate(df.iloc[i])]
                return df.iloc[i+1:].reset_index(drop=True)
        df.columns = [str(c).strip() for c in df.columns]
        return df

    def _rename_known_cols(self, df):
        brgy_aliases  = ['barangay', 'brgy', 'bgy', 'brgy.', 'bgy.',
                         'barangay name', 'brgy name', 'location', 'lugar']
        year_aliases  = ['year', 'taon', 'yr']
        month_aliases = ['month', 'buwan', 'mo', 'mon']
        rename = {}
        for col in df.columns:
            lc = str(col).lower().strip()
            if lc in brgy_aliases and 'barangay' not in rename.values():
                rename[col] = 'barangay'
            elif lc in year_aliases and 'year' not in rename.values():
                rename[col] = 'year'
            elif lc in month_aliases and 'month' not in rename.values():
                rename[col] = 'month'
        return df.rename(columns=rename)

    def _has_disease_data(self, df):
        for col in df.columns:
            if str(col).endswith('_cases') or col == 'malnutrition_prevalence_pct':
                return True
            if any(kw in str(col).lower() for kw in self.disease_keywords):
                return True
        return False

    def _find_column(self, df, keywords):
        for col in df.columns:
            if any(kw in str(col).lower() for kw in keywords):
                return col
        return None

    def _standardize_disease_name(self, name):
        name_str = str(name).lower()
        noise    = ['kaso ng', 'case of', 'cases', 'case', 'count',
                    'total', 'bilang', 'kabuuan', 'number of']
        for word in noise:
            name_str = name_str.replace(word, '')
        name_str = re.sub(r'[^a-z0-9]+', '_', name_str).strip('_')
        if not name_str:
            return ''
        # Use word-boundary matching to avoid partial replacements
        # e.g. 'flu' must not match inside 'influenza'
        alias_map = {
            r'\btb\b':         'tuberculosis',
            r'\bflu\b':        'influenza',
            r'\bdiarrhoea\b':  'diarrhea',
            r'\blepto\b':      'leptospirosis',
            r'\bhptn\b':       'hypertension',
            r'\bdm\b':         'diabetes',
            r'\bari\b':        'respiratory',
            r'\buri\b':        'respiratory',
            r'\bhfmd\b':       'hfmd',
            r'\brespiratory_infection\b': 'respiratory',
            r'\brespiratory_tract\b':     'respiratory',
        }
        for pattern, canon in alias_map.items():
            name_str = re.sub(pattern, canon, name_str)

        # Remove leftover noise after alias replacement
        name_str = re.sub(r'_+', '_', name_str).strip('_')
        # Remove 'nan' entries
        if name_str in ('nan', 'none', 'n_a', ''):
            return ''
        if not name_str.endswith('_cases'):
            name_str += '_cases'
        return name_str

    def _standardize_output(self, df):
        if df is None or df.empty:
            return df
        if 'city' not in df.columns:
            df['city'] = 'Unknown'
        if 'barangay' not in df.columns:
            df['barangay'] = 'Unknown'

        df['barangay'] = df['barangay'].astype(str).str.strip()
        df = df[~df['barangay'].str.lower().isin(['nan', 'none', 'total',
                                                   'grand total', ''])]
        if 'year' in df.columns:
            df['year']  = pd.to_numeric(df['year'],  errors='coerce').fillna(2020).astype(int)
        if 'month' in df.columns:
            df['month'] = pd.to_numeric(df['month'], errors='coerce').fillna(1).astype(int)
            df['month'] = df['month'].clip(1, 12)

        standard_cols = ['city', 'barangay', 'year', 'month']
        disease_cols  = sorted([c for c in df.columns
                                 if c.endswith('_cases') or c == 'malnutrition_prevalence_pct'])
        other_cols    = [c for c in df.columns
                         if c not in standard_cols and c not in disease_cols]
        ordered       = [c for c in standard_cols if c in df.columns] + disease_cols + other_cols
        return df[ordered].reset_index(drop=True)

    def _extract_year(self, name):
        m = re.search(r'(20\d{2}|19\d{2})', str(name))
        return int(m.group(1)) if m else 2020

    @staticmethod
    def _safe_int(v):
        try:
            return int(float(str(v).replace(',', '').strip()))
        except Exception:
            return 0

    @staticmethod
    def _looks_like_barangay(s):
        s = s.strip()
        skip = {'total', 'grand total', 'nan', 'none', 'n/a', ''}
        if len(s) < 3 or len(s) > 60 or s.lower() in skip:
            return False
        if re.match(r'^\d+(\.\d+)?$', s):
            return False
        return bool(re.search(r'[a-zA-Z]', s))

    @staticmethod
    def _looks_like_number(s):
        try:
            float(s.replace(',', ''))
            return True
        except Exception:
            return False

    # ─────────────────────────────────────────────────────────────────────────
    # complete_time_series (unchanged from original)
    # ─────────────────────────────────────────────────────────────────────────

    def complete_time_series(self, df):
        """Fill missing months and empty cells."""
        if 'year' not in df.columns or 'month' not in df.columns:
            return df

        disease_cols = [c for c in df.columns if c.endswith('_cases')]
        if not disease_cols:
            return df

        print(f"   🔧 Completing time series...")

        for c in disease_cols:
            if df[c].isna().sum() > 0:
                df[c] = df[c].fillna(0)

        if 'barangay' not in df.columns:
            return df

        completed = []
        for brgy in df['barangay'].unique():
            df_b   = df[df['barangay'] == brgy].copy()
            min_yr = int(df_b['year'].min())
            max_yr = int(df_b['year'].max())
            grid   = pd.DataFrame([{'year': y, 'month': m}
                                    for y in range(min_yr, max_yr + 1)
                                    for m in range(1, 13)])
            df_b_merged             = grid.merge(df_b, on=['year', 'month'], how='left')
            df_b_merged['barangay'] = brgy
            if 'city' in df.columns:
                city_val = df_b['city'].dropna().iloc[0] \
                    if not df_b['city'].dropna().empty else 'Unknown'
                df_b_merged['city'] = df_b_merged['city'].fillna(city_val)
            for c in disease_cols:
                if c in df_b_merged.columns:
                    df_b_merged[c] = df_b_merged[c].fillna(0)
                else:
                    df_b_merged[c] = 0
            completed.append(df_b_merged)

        result         = pd.concat(completed, ignore_index=True)
        result         = result.sort_values(['barangay', 'year', 'month']).reset_index(drop=True)
        result['year'] = result['year'].astype(int)
        result['month']= result['month'].astype(int)
        for c in disease_cols:
            result[c]  = pd.to_numeric(result[c], errors='coerce').fillna(0).astype(float)
        return result


# ── Wrapper ───────────────────────────────────────────────────────────────────
def preprocess_any_health_file(filepath):
    return UltimateAutoPreprocessor().process_file(filepath)


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        df = preprocess_any_health_file(sys.argv[1])
        print(f"\n✅ Result: {df.shape}")
        print(f"Columns: {list(df.columns)}")
        print(df.head())

# ══════════════════════════════════════════════════════════════════════════════
# ICD-10 MORBIDITY FORMAT PARSER
# For files like GENERAL_TRIAS_MORBIDITY_2022-2025.xlsx:
#   REG_CODE | PROV_CODE | MUN_CODE | BGY_CODE | DATE | DISEASE |
#   UNDER1_M | UNDER1_F | 1_4_M | ... | 29DAYS_11MOS_F
#
# Strategy: group rows by (barangay, year, month, disease_category),
#           sum all age/sex columns per group.
# ══════════════════════════════════════════════════════════════════════════════

import re as _re

# ICD-10 → (category_key, label)
_ICD_MAP = [
    (_re.compile(r'^A[89]\d|^A9\d'),                          'dengue',           'Dengue'),
    (_re.compile(r'^A[01][5-9]|^A1[6-8]'),                    'tuberculosis',     'Tuberculosis'),
    (_re.compile(r'^A2[7-9]'),                                 'leptospirosis',    'Leptospirosis'),
    (_re.compile(r'^A0[0-9]|^A[12][0-9]|^A3[0-9]|^B[4-9]'),  'infectious',       'Other Infectious'),
    (_re.compile(r'^A0[689]|^K[2-9]\d'),                      'gastrointestinal', 'Gastrointestinal'),
    (_re.compile(r'^J[0-4]\d|^J[6-9]\d|^U04'),                'respiratory',      'Respiratory'),
    (_re.compile(r'^U07|^U09'),                                'covid',            'COVID-19'),
    (_re.compile(r'^I\d\d'),                                   'cardiovascular',   'Cardiovascular'),
    (_re.compile(r'^E1[0-4]'),                                 'diabetes',         'Diabetes'),
    (_re.compile(r'^E\d\d|^D[5-9]\d'),                        'blood_metabolic',  'Blood/Metabolic'),
    (_re.compile(r'^N\d\d'),                                   'urinary',          'Urinary/Renal'),
    (_re.compile(r'^L\d\d'),                                   'skin',             'Skin Disease'),
    (_re.compile(r'^M\d\d'),                                   'musculoskeletal',  'Musculoskeletal'),
    (_re.compile(r'^T1[4-9]|^W5[4-5]|^S\d|^T\d|^W|^V|^Y'),  'injury',           'Injury/Trauma'),
    (_re.compile(r'^B[0-3]\d'),                                'viral_infection',  'Viral Infection'),
    (_re.compile(r'^F\d\d'),                                   'mental_health',    'Mental Health'),
    (_re.compile(r'^O\d\d'),                                   'maternal',         'Maternal/OB'),
    (_re.compile(r'^C\d\d|^D[0-4]\d'),                        'neoplasm',         'Neoplasm/Cancer'),
    (_re.compile(r'^G\d\d'),                                   'neurological',     'Neurological'),
    (_re.compile(r'^H\d\d'),                                   'sensory',          'Eye/Ear'),
    (_re.compile(r'^Q\d\d'),                                   'congenital',       'Congenital'),
]

# All age/sex column names in source file order
_AGE_SEX_COLS = [
    'UNDER1_M','UNDER1_F','1_4_M','1_4_F','5_9_M','5_9_F',
    '10_14_M','10_14_F','15_19_M','15_19_F','20_24_M','20_24_F',
    '25_29_M','25_29_F','30_34_M','30_34_F','35_39_M','35_39_F',
    '40_44_M','40_44_F','45_49_M','45_49_F','50_54_M','50_54_F',
    '55_59_M','55_59_F','60_64_M','60_64_F','65ABOVE_M','65ABOVE_F',
    '65_69_M','65_69_F','70ABOVE_M','70ABOVE_F',
    '0_6DAYS_M','0_6DAYS_F','7_28DAYS_M','7_28DAYS_F',
    '29DAYS_11MOS_M','29DAYS_11MOS_F',
]

_MALE_COLS   = [c for c in _AGE_SEX_COLS if c.endswith('_M')]
_FEMALE_COLS = [c for c in _AGE_SEX_COLS if c.endswith('_F')]


def _icd_category(disease_str):
    """Map ICD-10 disease string to (category_key, label)."""
    s = str(disease_str).strip()
    m = _re.match(r'^([A-Z]\d+)', s)
    if not m:
        return None, None
    code = m.group(1).upper()
    for pattern, key, label in _ICD_MAP:
        if pattern.match(code):
            return key, s   
    return 'other', s     

def is_morbidity_format(df):
    """Return True if this looks like the PH DOH morbidity report format."""
    cols = [str(c).upper().strip() for c in df.columns]
    has_bgy     = any('BGY' in c or 'BARANGAY' in c for c in cols)
    has_disease = 'DISEASE' in cols
    has_age_sex = any(c in cols for c in ['UNDER1_M', '1_4_M', '5_9_M'])
    return has_bgy and has_disease and has_age_sex


def parse_morbidity_file(filepath):
    """
    Parse a DOH morbidity report Excel file (multi-sheet, one sheet per year).
    Returns a tuple: (wide_df_for_lstm, raw_records_for_db)

    wide_df_for_lstm  — standard wide format for LSTM:
        city | barangay | year | month | respiratory_cases | dengue_cases | ...

    raw_records_for_db — list of dicts with full age/sex breakdown for DB insert:
        {city, barangay, year, month, disease_category, disease_label,
         total_male, total_female, total_cases, UNDER1_M, ..., 29DAYS_11MOS_F}
    """
    import pandas as pd
    import numpy as np
    from collections import defaultdict

    xl     = pd.ExcelFile(filepath, engine='openpyxl')
    sheets = xl.sheet_names

    all_records = []   # for DB (full age/sex breakdown per disease category)

    for sheet in sheets:
        try:
            df = pd.read_excel(filepath, sheet_name=sheet, header=0, engine='openpyxl')
            df.columns = [str(c).strip() for c in df.columns]

            if not is_morbidity_format(df):
                print(f"   Sheet '{sheet}' — not morbidity format, skipping")
                continue

            print(f"   Sheet '{sheet}' — {len(df)} rows")

            # Identify key columns (handle column order difference between 2022 and 2023+)
            bgy_col     = next((c for c in df.columns if 'BGY' in c.upper() or
                                'BARANGAY' in c.upper()), None)
            disease_col = next((c for c in df.columns if c.upper() == 'DISEASE'), None)
            date_col    = next((c for c in df.columns if c.upper() == 'DATE'), None)
            mun_col     = next((c for c in df.columns if 'MUN' in c.upper()), None)

            if not bgy_col or not disease_col:
                print(f"   Sheet '{sheet}' — missing BGY or DISEASE column, skipping")
                continue

            # Get actual age/sex cols present in this sheet
            present_age_sex = [c for c in _AGE_SEX_COLS if c in df.columns]

            # Convert age/sex columns to numeric
            for c in present_age_sex:
                df[c] = pd.to_numeric(df[c], errors='coerce').fillna(0).astype(int)

            # Parse date → year, month
            if date_col:
                df['_parsed_date'] = pd.to_datetime(df[date_col], format='%m/%d/%y', errors='coerce').fillna(pd.to_datetime(df[date_col], dayfirst=True, errors='coerce'))
                df['_year']  = df['_parsed_date'].dt.year.fillna(
                    int(_re.search(r'(20\d{2})', str(sheet)).group(1))
                    if _re.search(r'(20\d{2})', str(sheet)) else 2020
                ).astype(int)
                df['_month'] = df['_parsed_date'].dt.month.fillna(1).astype(int)
            else:
                yr = int(_re.search(r'(20\d{2})', str(sheet)).group(1)) \
                     if _re.search(r'(20\d{2})', str(sheet)) else 2020
                df['_year']  = yr
                df['_month'] = 1

            # Get city from MUN_CODE column
            city = ''
            if mun_col:
                city_vals = df[mun_col].dropna().astype(str).str.strip().unique()
                if city_vals.size:
                    city = city_vals[0]

            # Group by (barangay, year, month, disease_category) → sum age/sex
            groups = defaultdict(lambda: {c: 0 for c in present_age_sex})

            for _, row in df.iterrows():
                brgy    = str(row[bgy_col]).strip()
                disease = str(row[disease_col]).strip()
                year    = int(row['_year'])
                month   = int(row['_month'])

                if not brgy or brgy.lower() in ('nan','none',''):
                    continue

                cat_key, cat_label = _icd_category(disease)
                if cat_key is None:
                    continue   # skip zero reports

                key = (city, brgy, year, month, cat_key, cat_label)
                for c in present_age_sex:
                    groups[key][c] += int(row.get(c, 0))

            # Convert groups to records
            for (city_v, brgy, year, month, cat_key, cat_label), age_data in groups.items():
                total_m = sum(age_data.get(c, 0) for c in _MALE_COLS if c in age_data)
                total_f = sum(age_data.get(c, 0) for c in _FEMALE_COLS if c in age_data)
                rec = {
                    'city':             city_v,
                    'barangay':         brgy,
                    'year':             year,
                    'month':            month,
                    'disease_category': cat_key,
                    'disease_label':    cat_label,
                    'total_male':       total_m,
                    'total_female':     total_f,
                    'total_cases':      total_m + total_f,
                }
                # Add all age/sex values (NULL-safe)
                for src_col in _AGE_SEX_COLS:
                    rec[src_col] = age_data.get(src_col, None)
                all_records.append(rec)

        except Exception as e:
            import traceback
            print(f"   Sheet '{sheet}' error: {e}")
            traceback.print_exc()
            continue

    if not all_records:
        raise ValueError("No valid morbidity data found in file.")

    # Build wide DataFrame for LSTM
    import pandas as pd
    df_long = pd.DataFrame(all_records)[
        ['city','barangay','year','month','disease_category','total_cases']
    ].copy()

    df_wide = df_long.pivot_table(
        index=['city','barangay','year','month'],
        columns='disease_category',
        values='total_cases',
        aggfunc='sum',
        fill_value=0,
    ).reset_index()
    df_wide.columns.name = None

    # Rename category keys to _cases columns
    rename = {col: f"{col}_cases" for col in df_wide.columns
              if col not in ['city','barangay','year','month']}
    df_wide = df_wide.rename(columns=rename)

    barangays = df_wide['barangay'].nunique()
    diseases  = [c for c in df_wide.columns if c.endswith('_cases')]
    print(f"\n   Morbidity parse complete:")
    print(f"   Barangays: {barangays} | Categories: {len(diseases)} | DB records: {len(all_records)}")
    print(f"   Categories: {diseases}")

    return df_wide, all_records