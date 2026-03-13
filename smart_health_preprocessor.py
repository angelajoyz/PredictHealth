"""
SMART HEALTH DATA PREPROCESSOR - V3
Handles ALL possible health data formats:
1. Multi-barangay long format (barangay sections)
2. Long format (Type of Disease column)
3. Wide format (diseases as columns)
4. Individual case records
5. Month-as-columns format
6. Filipino/Tagalog column names
7. Abbreviated disease names
8. ANY disease name (fuzzy detection)
"""
import pandas as pd
import numpy as np
import re

# ── Master disease name mapping ───────────────────────────────────────────────
# Covers English, Filipino, abbreviations, common misspellings
DISEASE_ALIAS_MAP = {
    # Dengue
    'dengue': 'dengue_cases',
    'dengue fever': 'dengue_cases',
    'dengue hemorrhagic': 'dengue_cases',
    'dhf': 'dengue_cases',
    'dengue cases': 'dengue_cases',

    # Diarrhea
    'diarrhea': 'diarrhea_cases',
    'diarrhoea': 'diarrhea_cases',
    'diarrhea/gastroenteritis': 'diarrhea_cases',
    'gastroenteritis': 'diarrhea_cases',
    'acute gastroenteritis': 'diarrhea_cases',
    'age': 'diarrhea_cases',
    'loose bowel movement': 'diarrhea_cases',
    'lbm': 'diarrhea_cases',
    'pagtatae': 'diarrhea_cases',

    # Respiratory
    'respiratory': 'respiratory_cases',
    'ari': 'respiratory_cases',
    'acute respiratory infection': 'respiratory_cases',
    'uri': 'respiratory_cases',
    'upper respiratory': 'respiratory_cases',
    'upper respiratory tract infection': 'respiratory_cases',
    'urti': 'respiratory_cases',
    'lrti': 'respiratory_cases',
    'lower respiratory': 'respiratory_cases',
    'respiratory tract infection': 'respiratory_cases',
    'respiratory infection': 'respiratory_cases',
    'sipon': 'respiratory_cases',
    'ubo': 'respiratory_cases',

    # Tuberculosis
    'tuberculosis': 'tuberculosis_cases',
    'tb': 'tuberculosis_cases',
    'ptb': 'tuberculosis_cases',
    'pulmonary tb': 'tuberculosis_cases',
    'eptb': 'tuberculosis_cases',
    'extra pulmonary tb': 'tuberculosis_cases',
    'koch\'s disease': 'tuberculosis_cases',
    'tb cases': 'tuberculosis_cases',

    # Hypertension
    'hypertension': 'hypertension_cases',
    'hptn': 'hypertension_cases',
    'htn': 'hypertension_cases',
    'high blood pressure': 'hypertension_cases',
    'high blood': 'hypertension_cases',
    'hbp': 'hypertension_cases',
    'mataas na presyon': 'hypertension_cases',

    # Diabetes
    'diabetes': 'diabetes_cases',
    'dm': 'diabetes_cases',
    'diabetes mellitus': 'diabetes_cases',
    'type 1 diabetes': 'diabetes_cases',
    'type 2 diabetes': 'diabetes_cases',
    't2dm': 'diabetes_cases',
    'asukal': 'diabetes_cases',

    # Pneumonia
    'pneumonia': 'pneumonia_cases',
    'pneumonia cases': 'pneumonia_cases',
    'community acquired pneumonia': 'pneumonia_cases',
    'cap': 'pneumonia_cases',
    'baga': 'pneumonia_cases',

    # Influenza
    'influenza': 'influenza_cases',
    'flu': 'influenza_cases',
    'influenza like illness': 'influenza_cases',
    'ili': 'influenza_cases',
    'h1n1': 'influenza_cases',
    'trangkaso': 'influenza_cases',

    # Malnutrition
    'malnutrition': 'malnutrition_prevalence_pct',
    'malnourished': 'malnutrition_prevalence_pct',
    'undernutrition': 'malnutrition_prevalence_pct',
    'underweight': 'malnutrition_prevalence_pct',
    'wasted': 'malnutrition_prevalence_pct',
    'stunted': 'malnutrition_prevalence_pct',
    'malnutrisyon': 'malnutrition_prevalence_pct',

    # Typhoid
    'typhoid': 'typhoid_cases',
    'typhoid fever': 'typhoid_cases',
    'enteric fever': 'typhoid_cases',
    'typhoid/paratyphoid': 'typhoid_cases',

    # Leptospirosis
    'leptospirosis': 'leptospirosis_cases',
    'lepto': 'leptospirosis_cases',
    'leptospira': 'leptospirosis_cases',

    # Cholera
    'cholera': 'cholera_cases',
    'vibrio cholerae': 'cholera_cases',

    # Hepatitis
    'hepatitis': 'hepatitis_cases',
    'hepatitis a': 'hepatitis_cases',
    'hepatitis b': 'hepatitis_cases',
    'hepatitis c': 'hepatitis_cases',
    'viral hepatitis': 'hepatitis_cases',

    # Measles
    'measles': 'measles_cases',
    'tigdas': 'measles_cases',
    'rubeola': 'measles_cases',

    # COVID
    'covid': 'covid_cases',
    'covid-19': 'covid_cases',
    'covid19': 'covid_cases',
    'coronavirus': 'covid_cases',
    'sars-cov-2': 'covid_cases',

    # Malaria
    'malaria': 'malaria_cases',
    'plasmodium': 'malaria_cases',

    # Rabies
    'rabies': 'rabies_cases',
    'animal bite': 'rabies_cases',

    # Chickenpox
    'chickenpox': 'chickenpox_cases',
    'varicella': 'chickenpox_cases',
    'bulutong hangin': 'chickenpox_cases',

    # UTI
    'uti': 'uti_cases',
    'urinary tract infection': 'uti_cases',
    'urinary tract': 'uti_cases',

    # Hand Foot Mouth
    'hfmd': 'hfmd_cases',
    'hand foot mouth': 'hfmd_cases',
    'hand foot and mouth': 'hfmd_cases',

    # Schistosomiasis
    'schistosomiasis': 'schistosomiasis_cases',
    'schisto': 'schistosomiasis_cases',

    # Filariasis
    'filariasis': 'filariasis_cases',
    'lymphatic filariasis': 'filariasis_cases',

    # Pertussis
    'pertussis': 'pertussis_cases',
    'whooping cough': 'pertussis_cases',

    # Tetanus
    'tetanus': 'tetanus_cases',
    'neonatal tetanus': 'tetanus_cases',

    # Mumps
    'mumps': 'mumps_cases',
    'beke': 'mumps_cases',

    # HIV/AIDS
    'hiv': 'hiv_cases',
    'aids': 'hiv_cases',
    'hiv/aids': 'hiv_cases',

    # Stroke
    'stroke': 'stroke_cases',
    'cerebrovascular': 'stroke_cases',
    'cva': 'stroke_cases',

    # Cancer
    'cancer': 'cancer_cases',
    'malignancy': 'cancer_cases',
    'tumor': 'cancer_cases',

    # Asthma
    'asthma': 'asthma_cases',
    'hika': 'asthma_cases',
    'bronchial asthma': 'asthma_cases',
}

MONTH_MAP = {
    'january': 1, 'jan': 1, 'enero': 1,
    'february': 2, 'feb': 2, 'pebrero': 2,
    'march': 3, 'mar': 3, 'marso': 3,
    'april': 4, 'apr': 4, 'abril': 4,
    'may': 5, 'mayo': 5,
    'june': 6, 'jun': 6, 'hunyo': 6,
    'july': 7, 'jul': 7, 'hulyo': 7,
    'august': 8, 'aug': 8, 'agosto': 8,
    'september': 9, 'sep': 9, 'sept': 9, 'setyembre': 9,
    'october': 10, 'oct': 10, 'oktubre': 10,
    'november': 11, 'nov': 11, 'nobyembre': 11,
    'december': 12, 'dec': 12, 'disyembre': 12,
}


class SmartHealthPreprocessor:
    def __init__(self):
        self.metadata_keywords = [
            'city', 'barangay', 'year', 'month', 'date', 'time',
            'population', 'density', 'facilities', 'facility',
            'temperature', 'rainfall', 'humidity', 'wind', 'solar',
            'flood', 'air_quality', 'pm25', 'pm10', 'waste',
            'ndvi', 'distance', 'poverty', 'employment', 'literacy',
        ]
        self.disease_keywords = list(DISEASE_ALIAS_MAP.keys())

    # ─────────────────────────────────────────────────────────────────────────
    # PUBLIC API
    # ─────────────────────────────────────────────────────────────────────────

    def process_file(self, filepath):
        """Main entry point — tries all strategies."""
        ext = filepath.lower()
        if ext.endswith('.csv'):
            return self._process_csv(filepath)

        xl     = pd.ExcelFile(filepath,
                              engine='openpyxl' if filepath.endswith('.xlsx') else 'xlrd')
        df_raw = pd.read_excel(filepath, sheet_name=0, header=None,
                               engine='openpyxl' if filepath.endswith('.xlsx') else 'xlrd')

        # Strategy 1: Multi-barangay sections
        barangay_sections = self._find_barangay_sections(df_raw)
        if len(barangay_sections) > 1:
            print(f"   Found {len(barangay_sections)} barangay sections in long format")
            return self._process_multi_barangay_long(filepath, barangay_sections)

        # Strategy 2: Known sheet names
        sheets = xl.sheet_names
        for sheet in ['Unified_Data', 'Health_Data', 'Disease_Data',
                      'Data', 'Sheet1', sheets[0]]:
            if sheet not in sheets:
                continue
            try:
                df = pd.read_excel(filepath, sheet_name=sheet,
                                   engine='openpyxl' if filepath.endswith('.xlsx') else 'xlrd')
                if df.empty or len(df.columns) < 2:
                    continue
                result = self._auto_process(df, df_raw, filepath, sheet)
                if result is not None and not result.empty:
                    return result
            except Exception as e:
                print(f"   ⚠️ Sheet '{sheet}' failed: {e}")
                continue

        # Strategy 3: Try every sheet
        for sheet in sheets:
            try:
                df = pd.read_excel(filepath, sheet_name=sheet,
                                   engine='openpyxl' if filepath.endswith('.xlsx') else 'xlrd')
                if df.empty:
                    continue
                result = self._auto_process(df, df_raw, filepath, sheet)
                if result is not None and not result.empty:
                    return result
            except Exception:
                continue

        raise ValueError("Could not process any sheet in this file.")

    def _auto_process(self, df, df_raw, filepath, sheet_name):
        """Auto-detect format and process."""
        # Check for month-as-columns (wide pivoted)
        month_cols = [c for c in df.columns
                      if isinstance(c, str) and c.lower().strip()[:3] in MONTH_MAP]
        if len(month_cols) >= 3:
            print(f"   📊 Wide-pivoted format detected (month columns)")
            return self._process_wide_pivoted(df, sheet_name)

        # Check for long format
        if self._is_long_format(df):
            brgy_name = self._extract_barangay_from_title(df_raw)
            header_row = self._find_header_row(df_raw)
            engine = 'openpyxl' if filepath.endswith('.xlsx') else 'xlrd'
            df2 = pd.read_excel(filepath, sheet_name=sheet_name,
                                header=header_row, engine=engine)
            return self._transform_long_to_wide(df2, brgy_name)

        # Check for wide format with disease columns
        if self._has_disease_columns(df):
            print(f"   📊 Wide format detected")
            return self._process_wide(df)

        # Try to salvage
        return self._salvage(df, sheet_name)

    # ─────────────────────────────────────────────────────────────────────────
    # FORMAT PROCESSORS
    # ─────────────────────────────────────────────────────────────────────────

    def _process_wide_pivoted(self, df, sheet_name=''):
        """Handle month-as-columns layout."""
        month_cols = {c: MONTH_MAP[c.lower().strip()[:3]]
                      for c in df.columns
                      if isinstance(c, str) and c.lower().strip()[:3] in MONTH_MAP}

        brgy_col    = self._find_col(df, ['barangay', 'brgy', 'bgy', 'location'])
        disease_col = self._find_col(df, ['disease', 'sakit', 'type', 'karamdaman'])
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
                                 'month': month_num, canon: self._to_int(row.get(col, 0))})
        elif brgy_col:
            disease_name = self._standardize_disease_name(sheet_name) or 'dengue_cases'
            for _, row in df.iterrows():
                brgy = str(row[brgy_col]).strip()
                if not brgy or brgy.lower() in ('nan', '', 'total'):
                    continue
                for col, month_num in month_cols.items():
                    rows.append({'barangay': brgy, 'year': year,
                                 'month': month_num,
                                 disease_name: self._to_int(row.get(col, 0))})

        if not rows:
            return None
        out  = pd.DataFrame(rows)
        grp  = ['barangay', 'year', 'month']
        dcols = [c for c in out.columns if c not in grp]
        return out.groupby(grp, as_index=False)[dcols].sum()

    def _process_wide(self, df):
        """Handle wide format — diseases already as columns."""
        rename_map = {}
        for col in df.columns:
            lc = str(col).lower().strip()
            if any(a in lc for a in ['barangay', 'brgy', 'bgy']):
                rename_map[col] = 'barangay'
            elif lc in ('year', 'yr', 'taon'):
                rename_map[col] = 'year'
            elif lc in ('month', 'mo', 'buwan'):
                rename_map[col] = 'month'
            else:
                canon = self._standardize_disease_name(col)
                if canon:
                    rename_map[col] = canon
        df = df.rename(columns=rename_map)
        if 'barangay' not in df.columns:
            df['barangay'] = 'Unknown'
        return df

    def _salvage(self, df, sheet_name=''):
        """Last resort — try to extract any useful data."""
        print(f"   ⚠️ Salvaging sheet '{sheet_name}'...")

        # Try: rename columns and check for diseases
        df2 = self._process_wide(df)
        disease_cols = [c for c in df2.columns if c.endswith('_cases')
                        or c == 'malnutrition_prevalence_pct']
        if disease_cols and 'barangay' in df2.columns:
            return df2

        # Try: cell-value scan for disease names
        for col in df.columns:
            if df[col].dtype == 'object':
                vals = df[col].dropna().astype(str).str.lower().unique()
                hits = sum(1 for v in vals
                           if self._standardize_disease_name(v) != '')
                if hits >= 2:
                    print(f"      → Disease values found in column '{col}'")
                    return self._transform_long_to_wide(df, None)

        return None

    def _process_csv(self, filepath):
        """Smart CSV reader."""
        encodings = ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']
        for enc in encodings:
            try:
                df = pd.read_csv(filepath, encoding=enc, on_bad_lines='skip')
                if not df.empty:
                    return self._process_wide(df)
            except Exception:
                continue
        raise ValueError("Cannot read CSV file.")

    # ─────────────────────────────────────────────────────────────────────────
    # MULTI-BARANGAY LONG FORMAT (unchanged logic, improved disease detection)
    # ─────────────────────────────────────────────────────────────────────────

    def _find_barangay_sections(self, df_raw):
        sections = []
        for idx, row in df_raw.iterrows():
            first_cell = str(row[0])
            if 'barangay' in first_cell.lower() or 'brgy' in first_cell.lower():
                brgy_name = re.sub(r'(?i)(barangay|brgy\.?)\s*:?\s*', '',
                                   first_cell).strip()
                sections.append((brgy_name, idx))
        result = []
        for i, (brgy_name, start_row) in enumerate(sections):
            end_row = sections[i+1][1] - 1 if i < len(sections) - 1 else len(df_raw) - 1
            result.append((brgy_name, start_row, end_row))
        return result

    def _process_multi_barangay_long(self, filepath, sections):
        all_dfs = []
        engine  = 'openpyxl' if filepath.endswith('.xlsx') else 'xlrd'
        for brgy_name, start_row, end_row in sections:
            try:
                nrows      = end_row - start_row + 1
                df_section = pd.read_excel(filepath, sheet_name=0, header=None,
                                           skiprows=start_row, nrows=nrows, engine=engine)
                header_row = self._find_header_row(df_section)
                df         = pd.read_excel(filepath, sheet_name=0,
                                           header=start_row + header_row,
                                           nrows=nrows - header_row - 1, engine=engine)
                df_wide = self._transform_long_to_wide(df, brgy_name)
                if df_wide is not None and not df_wide.empty:
                    all_dfs.append(df_wide)
                    print(f"      ✅ {brgy_name}: {len(df_wide)} rows")
            except Exception as e:
                print(f"      ⚠️ {brgy_name}: Failed ({e})")
                continue

        if not all_dfs:
            raise ValueError("Could not process any barangay sections")
        result = pd.concat(all_dfs, axis=0, ignore_index=True)
        print(f"   Combined: {len(result)} total rows")
        return result

    def _is_long_format(self, df):
        col_lower = [str(c).lower().strip() for c in df.columns]
        long_indicators = [
            'type of disease', 'disease type', 'uri ng sakit',
            'klase ng sakit', 'diagnosis', 'disease name',
            'type', 'category', 'sakit', 'illness', 'condition',
            # ✅ FIXED: 'case' singular = individual record disease column
            'case',
        ]
        for col in col_lower:
            if any(ind == col or ind in col for ind in long_indicators):
                # Verify the column has disease-name values (not numbers)
                for orig_col in df.columns:
                    if str(orig_col).lower().strip() == col:
                        sample = df[orig_col].dropna().astype(str).str.lower().unique()[:10]
                        non_numeric = [v for v in sample
                                      if not re.match(r'^\d+(\.\d+)?$', v)
                                      and v not in ('nan', '', 'none')]
                        if non_numeric:
                            return True
        # Check cell values
        for col in df.columns:
            if df[col].dtype == 'object':
                vals = df[col].dropna().astype(str).str.lower().unique()
                hits = sum(1 for v in vals
                           if self._standardize_disease_name(v) != '')
                if hits >= 2:
                    return True
        return False

    def _find_header_row(self, df_raw):
        header_keywords = ['month', 'year', 'disease', 'cases', 'type',
                           'total', 'barangay', 'sakit', 'kaso', 'buwan']
        for row_idx in range(min(10, len(df_raw))):
            row_values = df_raw.iloc[row_idx].fillna('').astype(str).str.lower()
            matches    = sum(any(kw in val for kw in header_keywords)
                            for val in row_values if val)
            if matches >= 2:
                return row_idx
        return 0

    def _extract_barangay_from_title(self, df_raw):
        try:
            first_cell = str(df_raw.iloc[0, 0])
            if 'barangay' in first_cell.lower():
                return re.sub(r'(?i)barangay\s*:?\s*', '', first_cell).strip()
        except Exception:
            pass
        return None

    def _transform_long_to_wide(self, df, barangay_name=None):
        """
        Transform long/individual format to wide.
        Handles both:
          - Aggregated: year | month | disease | total_cases
          - Individual: year | month | barangay | sex | age | case
        """
        month_col = year_col = disease_col = cases_col = barangay_col = None

        for col in df.columns:
            col_lower = str(col).lower().strip()
            if not month_col and any(k in col_lower for k in ['month', 'buwan', 'mo']):
                month_col = col
            elif not year_col and any(k in col_lower for k in ['year', 'taon', 'yr']):
                year_col = col
            elif not disease_col and any(k == col_lower for k in
                                         ['case', 'disease', 'type', 'sakit',
                                          'karamdaman', 'diagnosis', 'illness',
                                          'condition', 'disease type',
                                          'type of disease']):
                disease_col = col
            elif not disease_col and any(k in col_lower for k in
                                         ['disease', 'sakit', 'diagnosis',
                                          'illness', 'category']):
                disease_col = col
            elif not cases_col and any(k in col_lower for k in
                                       ['case', 'total', 'count', 'kaso',
                                        'bilang', 'kabuuan', 'number']):
                if col != disease_col:
                    cases_col = col
            elif not barangay_col and any(k in col_lower for k in
                                          ['barangay', 'brgy', 'bgy', 'location']):
                barangay_col = col

        # Auto-detect disease column from cell values
        if not disease_col:
            for col in df.columns:
                if df[col].dtype == 'object':
                    vals = df[col].dropna().astype(str).str.lower().unique()
                    hits = sum(1 for v in vals
                               if self._standardize_disease_name(v) != '')
                    if hits >= 2:
                        disease_col = col
                        print(f"      🔍 Disease column auto-detected: '{col}'")
                        break

        if not year_col or not disease_col:
            print(f"      ⚠️ Missing columns: year={year_col}, disease={disease_col}")
            return None

        df = df.dropna(subset=[disease_col]).copy()
        df = df[df[disease_col].astype(str).str.strip() != str(disease_col)]

        # Standardize disease names
        df['_disease_std'] = df[disease_col].astype(str).apply(
            self._standardize_disease_name
        )
        df = df[df['_disease_std'] != '']

        if df.empty:
            print(f"      ⚠️ No recognized disease names found")
            return None

        df['year']  = pd.to_numeric(df[year_col], errors='coerce').fillna(2020).astype(int)
        df['month'] = self._parse_month(df[month_col]) if month_col else 1

        # ✅ FIXED: Detect if individual records (no cases_col) → count rows
        is_individual = cases_col is None or (
            cases_col and not pd.api.types.is_numeric_dtype(df[cases_col])
        )

        if is_individual:
            # Count individual patient records
            print(f"      📊 Counting individual patient records...")
            agg_col = 'count'
            df[agg_col] = 1
        else:
            df[cases_col] = pd.to_numeric(df[cases_col], errors='coerce').fillna(0)
            agg_col = cases_col

        # Handle barangay
        if barangay_col and not barangay_name:
            results = []
            for brgy, grp in df.groupby(barangay_col):
                pivot = grp.pivot_table(
                    index=['year', 'month'],
                    columns='_disease_std',
                    values=agg_col,
                    aggfunc='sum',
                    fill_value=0
                ).reset_index()
                pivot.columns.name = None
                pivot['barangay'] = str(brgy).strip()
                pivot['city']     = 'Unknown'
                results.append(pivot)
            result = pd.concat(results, ignore_index=True) if results else None
            if result is not None:
                diseases = [c for c in result.columns if c.endswith('_cases')]
                print(f"      ✅ Diseases detected: {diseases}")
            return result

        df_pivot = df.pivot_table(
            index=['year', 'month'],
            columns='_disease_std',
            values=agg_col,
            aggfunc='sum',
            fill_value=0
        ).reset_index()
        df_pivot.columns.name = None
        df_pivot['barangay']  = barangay_name or 'Unknown'
        df_pivot['city']      = 'Unknown'

        diseases = [c for c in df_pivot.columns if c.endswith('_cases')]
        print(f"      ✅ Diseases detected: {diseases}")
        return df_pivot

    # ─────────────────────────────────────────────────────────────────────────
    # DISEASE NAME STANDARDIZATION — CORE FIX
    # ─────────────────────────────────────────────────────────────────────────

    def _standardize_disease_name(self, name):
        """
        Convert ANY disease name to canonical _cases format.
        Tries: exact match → partial match → keyword match → generic naming.
        """
        if not name or not isinstance(name, str):
            return ''

        raw = str(name).strip()
        lc  = raw.lower()

        # Skip metadata / non-disease values
        skip = {'total', 'grand total', 'subtotal', 'year', 'month',
                'barangay', 'city', 'nan', 'none', 'n/a', '', 'cases',
                'no.', 'number', 'count'}
        if lc in skip:
            return ''
        if re.match(r'^\d+(\.\d+)?$', lc):
            return ''

        # 1. Already canonical
        if lc.endswith('_cases') or lc == 'malnutrition_prevalence_pct':
            return lc.replace(' ', '_')

        # 2. Exact match in alias map
        if lc in DISEASE_ALIAS_MAP:
            return DISEASE_ALIAS_MAP[lc]

        # 3. Partial/contains match
        for alias, canon in DISEASE_ALIAS_MAP.items():
            if alias in lc or lc in alias:
                return canon

        # 4. Word-level match
        words = re.split(r'[\s/\-,]+', lc)
        for word in words:
            if word in DISEASE_ALIAS_MAP:
                return DISEASE_ALIAS_MAP[word]

        # 5. Generic: clean up and add _cases suffix
        #    (catches any disease not in our map)
        cleaned = re.sub(r'[^a-z0-9]+', '_', lc).strip('_')
        if cleaned and len(cleaned) >= 3:
            noise = ['kaso_ng', 'case_of', 'cases', 'case',
                     'count', 'total', 'bilang', 'kabuuan']
            for n in noise:
                cleaned = cleaned.replace(n, '').strip('_')
            if cleaned and len(cleaned) >= 2:
                if not cleaned.endswith('_cases'):
                    cleaned += '_cases'
                return cleaned

        return ''

    # ─────────────────────────────────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────────────────────────────────

    def _has_disease_columns(self, df):
        for col in df.columns:
            canon = self._standardize_disease_name(str(col))
            if canon:
                return True
        return False

    def _find_col(self, df, keywords):
        for col in df.columns:
            if any(kw in str(col).lower() for kw in keywords):
                return col
        return None

    def _extract_year(self, name):
        m = re.search(r'(20\d{2}|19\d{2})', str(name))
        return int(m.group(1)) if m else 2020

    @staticmethod
    def _to_int(v):
        try:
            return int(float(str(v).replace(',', '').strip()))
        except Exception:
            return 0

    def _parse_month(self, month_series):
        result = []
        for val in month_series:
            val_str = str(val).lower().strip()
            if val_str.isdigit():
                result.append(int(val_str))
            else:
                matched = MONTH_MAP.get(val_str)
                if matched:
                    result.append(matched)
                else:
                    found = False
                    for name, num in MONTH_MAP.items():
                        if name in val_str:
                            result.append(num)
                            found = True
                            break
                    if not found:
                        result.append(1)
        return pd.Series(result, dtype='Int64')

    # ─────────────────────────────────────────────────────────────────────────
    # complete_time_series (unchanged)
    # ─────────────────────────────────────────────────────────────────────────

    def complete_time_series(self, df):
        """Fill missing months and empty cells."""
        if 'year' not in df.columns or 'month' not in df.columns:
            return df
        disease_cols = [c for c in df.columns
                        if c.endswith('_cases') or c == 'malnutrition_prevalence_pct']
        if not disease_cols:
            return df

        print(f"   🔧 Completing time series (handling missing data)...")
        for col in disease_cols:
            nan_count = df[col].isna().sum()
            if nan_count > 0:
                df[col] = df[col].fillna(0)
                print(f"      • {col}: filled {nan_count} empty cells with 0")

        if 'barangay' not in df.columns:
            return df

        completed_dfs = []
        total_added   = 0
        for barangay in df['barangay'].unique():
            df_brgy   = df[df['barangay'] == barangay].copy()
            min_year  = int(df_brgy['year'].min())
            max_year  = int(df_brgy['year'].max())
            grid      = pd.DataFrame([{'year': y, 'month': m}
                                       for y in range(min_year, max_year + 1)
                                       for m in range(1, 13)])
            missing   = len(grid) - len(df_brgy)
            df_brgy   = grid.merge(df_brgy, on=['year', 'month'], how='left')
            df_brgy['barangay'] = barangay
            if 'city' in df.columns:
                city_val = df[df['barangay'] == barangay]['city'].iloc[0]
                df_brgy['city'] = df_brgy['city'].fillna(city_val)
            else:
                df_brgy['city'] = 'Unknown'
            for col in disease_cols:
                df_brgy[col] = df_brgy[col].fillna(0)
            total_added += max(0, missing)
            completed_dfs.append(df_brgy)

        if total_added > 0:
            print(f"      • Added {total_added} missing month rows (all diseases = 0)")

        result = pd.concat(completed_dfs, ignore_index=True)
        result = result.sort_values(['barangay', 'year', 'month']).reset_index(drop=True)
        result['year']  = result['year'].astype(int)
        result['month'] = result['month'].astype(int)
        for col in disease_cols:
            result[col] = pd.to_numeric(result[col], errors='coerce').fillna(0).astype(float)
        return result


def preprocess_health_file(filepath):
    """Convenience wrapper"""
    processor = SmartHealthPreprocessor()
    df = processor.process_file(filepath)
    df = processor.complete_time_series(df)
    return df