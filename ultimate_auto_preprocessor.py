"""
ULTIMATE AUTO-PREPROCESSOR
Handles ANY health data format automatically:
1. Individual case records (1 row = 1 patient)
2. Aggregated long format (Type of Disease column)
3. Wide format (diseases as columns)
4. Multi-barangay sections
5. Mixed/unknown formats

Strategy: Detect format → Apply correct transformation → Return standard wide format
"""
import pandas as pd
import numpy as np
import re

class UltimateAutoPreprocessor:
    def __init__(self):
        # Columns to EXCLUDE from disease/barangay detection
        self.metadata_blacklist = {
            'year', 'month', 'week', 'day', 'date', 'time',
            'sex', 'gender', 'male', 'female', 'age', 'agegroup',
            'city', 'municipality', 'province', 'region',
            'population', 'density', 'facility', 'facilities',
            'temperature', 'rainfall', 'humidity', 'climate',
            'poverty', 'income', 'employment', 'literacy',
            'id', 'no', 'number', 'row', 'index', 'unnamed'
        }
        
        # Known disease keywords
        self.disease_keywords = [
            'dengue', 'diarrhea', 'respiratory', 'malnutrition',
            'hypertension', 'diabetes', 'tuberculosis', 'tb',
            'measles', 'influenza', 'hfmd', 'covid', 'pneumonia'
        ]
    
    def process_file(self, filepath):
        """
        Main entry: Auto-detect format and process ANY Excel/CSV file
        """
        print(f"\n{'='*80}")
        print(f"🔍 ULTIMATE AUTO-PREPROCESSING")
        print(f"{'='*80}\n")
        
        # Try to read file
        if filepath.endswith('.csv'):
            df_raw = pd.read_csv(filepath)
            return self._process_by_format(df_raw)
        
        else:
            # Excel file - check for multi-barangay sections
            try:
                df_test = pd.read_excel(filepath, sheet_name=0, header=None)  # Read ALL rows
                barangay_sections = self._find_barangay_sections(df_test)
                
                if len(barangay_sections) > 1:
                    # Multi-barangay long format - use existing processor
                    print(f"   📍 Detected {len(barangay_sections)} barangay sections")
                    return self._process_multi_barangay_sections(filepath, barangay_sections)
            except Exception as e:
                print(f"   ⚠️ Multi-barangay check failed: {e}")
            
            # Try reading normally
            xl = pd.ExcelFile(filepath)
            for sheet in xl.sheet_names:
                try:
                    df_raw = pd.read_excel(filepath, sheet_name=sheet)
                    if not df_raw.empty and len(df_raw.columns) >= 3:
                        print(f"   📄 Using sheet: {sheet}")
                        return self._process_by_format(df_raw)
                except Exception as e:
                    print(f"   ⚠️ Failed to read sheet {sheet}: {e}")
                    continue
            
            raise ValueError("Could not read any valid data from file")
    
    def _process_by_format(self, df_raw):
        """Detect format and process accordingly"""
        # Detect format
        format_type = self._detect_format(df_raw)
        print(f"📋 Detected format: {format_type}")
        
        # Process based on format
        if format_type == 'individual_cases':
            df_result = self._process_individual_cases(df_raw)
        elif format_type == 'long_aggregated':
            df_result = self._process_long_aggregated(df_raw)
        elif format_type == 'wide':
            df_result = self._process_wide(df_raw)
        else:
            df_result = self._try_salvage(df_raw)
        
        # Standardize and clean
        df_result = self._standardize_output(df_result)
        
        disease_cols = [c for c in df_result.columns if c.endswith('_cases')]
        barangays = df_result['barangay'].nunique() if 'barangay' in df_result.columns else 0
        
        print(f"\n✅ Processing complete!")
        print(f"   • Barangays: {barangays}")
        print(f"   • Diseases: {len(disease_cols)}")
        print(f"   • Rows: {len(df_result)}")
        
        return df_result
    
    def _detect_format(self, df):
        """
        Detect which format the data is in:
        1. individual_cases: Each row = 1 patient (has age/sex columns)
        2. long_aggregated: Type of Disease + Total Cases columns
        3. wide: Diseases already as columns
        """
        col_lower = [str(c).lower() for c in df.columns]
        
        # Check 1: Individual case records (has age/sex)
        has_demographic = any(x in col_lower for x in ['age', 'sex', 'gender'])
        has_single_disease_col = any(x in col_lower for x in ['case', 'disease', 'diagnosis'])
        
        if has_demographic and has_single_disease_col:
            print("   → Individual case records (1 row = 1 patient)")
            return 'individual_cases'
        
        # Check 2: Long aggregated (Type of Disease column)
        has_disease_type = any('type' in col and 'disease' in col for col in col_lower)
        has_total_cases = any('total' in col or 'count' in col or 'case' in col for col in col_lower)
        
        if has_disease_type or (has_single_disease_col and has_total_cases):
            print("   → Long aggregated format (Type of Disease column)")
            return 'long_aggregated'
        
        # Check 3: Wide format (multiple disease columns)
        disease_cols = []
        for col in df.columns:
            col_str = str(col).lower()
            if any(kw in col_str for kw in self.disease_keywords):
                if not any(skip in col_str for skip in self.metadata_blacklist):
                    disease_cols.append(col)
        
        if len(disease_cols) >= 2:
            print(f"   → Wide format ({len(disease_cols)} disease columns)")
            return 'wide'
        
        return 'unknown'
    
    def _process_individual_cases(self, df):
        """
        Process individual patient records
        Each row = 1 patient
        Need to: GROUP BY (barangay, year, month, disease) → COUNT
        """
        print("   📊 Processing individual case records...")
        
        # Find key columns
        year_col = self._find_column(df, ['year', 'yr'])
        month_col = self._find_column(df, ['month', 'mo', 'buwan'])
        barangay_col = self._find_column(df, ['barangay', 'brgy', 'bgy'])
        disease_col = self._find_column(df, ['case', 'disease', 'diagnosis', 'sakit'])
        
        if not all([year_col, month_col, disease_col]):
            raise ValueError(f"Missing required columns: year={year_col}, month={month_col}, disease={disease_col}")
        
        # Use generic barangay if not found
        if not barangay_col:
            df['barangay'] = 'Unknown'
            barangay_col = 'barangay'
        
        # Group and count
        df_grouped = df.groupby([year_col, month_col, barangay_col, disease_col]).size().reset_index(name='count')
        
        # Rename columns
        df_grouped = df_grouped.rename(columns={
            year_col: 'year',
            month_col: 'month',
            barangay_col: 'barangay',
            disease_col: 'disease'
        })
        
        # Pivot to wide
        df_wide = df_grouped.pivot_table(
            index=['barangay', 'year', 'month'],
            columns='disease',
            values='count',
            fill_value=0
        ).reset_index()
        
        df_wide.columns.name = None
        
        # Standardize disease names
        rename_map = {}
        for col in df_wide.columns:
            if col not in ['barangay', 'year', 'month', 'city']:
                std_name = self._standardize_disease_name(col)
                rename_map[col] = std_name
        
        df_wide = df_wide.rename(columns=rename_map)
        
        print(f"      ✅ Grouped {len(df)} individual cases into {len(df_wide)} monthly aggregates")
        
        return df_wide
    
    def _process_long_aggregated(self, df):
        """
        Process long aggregated format (Type of Disease column)
        Similar to existing smart_health_preprocessor
        """
        print("   📊 Processing long aggregated format...")
        
        # Find columns
        year_col = self._find_column(df, ['year'])
        month_col = self._find_column(df, ['month'])
        barangay_col = self._find_column(df, ['barangay', 'brgy'])
        disease_col = self._find_column(df, ['disease', 'type', 'case'])
        cases_col = self._find_column(df, ['total', 'count', 'cases'])
        
        if not barangay_col:
            df['barangay'] = 'Unknown'
            barangay_col = 'barangay'
        
        # Clean data
        df = df.dropna(subset=[year_col, disease_col, cases_col])
        df[cases_col] = pd.to_numeric(df[cases_col], errors='coerce').fillna(0)
        
        # Pivot
        df_wide = df.pivot_table(
            index=['barangay', 'year', 'month'] if month_col else ['barangay', 'year'],
            columns=disease_col,
            values=cases_col,
            aggfunc='sum',
            fill_value=0
        ).reset_index()
        
        df_wide.columns.name = None
        
        # Standardize
        rename_map = {}
        for col in df_wide.columns:
            if col not in ['barangay', 'year', 'month', 'city']:
                rename_map[col] = self._standardize_disease_name(col)
        
        df_wide = df_wide.rename(columns=rename_map)
        
        return df_wide
    
    def _process_wide(self, df):
        """Process wide format (diseases already as columns)"""
        print("   📊 Processing wide format...")
        
        # Standardize column names
        rename_map = {}
        
        for col in df.columns:
            col_lower = str(col).lower()
            
            if 'barangay' in col_lower or 'brgy' in col_lower:
                rename_map[col] = 'barangay'
            elif col_lower in ['year', 'yr']:
                rename_map[col] = 'year'
            elif col_lower in ['month', 'mo']:
                rename_map[col] = 'month'
            elif any(kw in col_lower for kw in self.disease_keywords):
                rename_map[col] = self._standardize_disease_name(col)
        
        df = df.rename(columns=rename_map)
        
        if 'barangay' not in df.columns:
            df['barangay'] = 'Unknown'
        
        return df
    
    def _try_salvage(self, df):
        """Last resort: try to make sense of unknown format"""
        print("   ⚠️ Unknown format - trying salvage...")
        
        # Strategy: Look for any recognizable patterns
        # If has many numeric columns → assume wide format
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        
        if len(numeric_cols) >= 3:
            print("      → Attempting wide format interpretation")
            return self._process_wide(df)
        
        # If has categorical disease column + numeric column → assume aggregated
        for col in df.columns:
            if df[col].dtype == 'object' and df[col].nunique() < 20:
                # Might be disease names
                unique_vals = df[col].dropna().unique()
                disease_matches = sum(1 for val in unique_vals 
                                    if any(kw in str(val).lower() for kw in self.disease_keywords))
                if disease_matches >= 2:
                    print("      → Found disease column, assuming aggregated format")
                    return self._process_long_aggregated(df)
        
        # Give up - return minimal frame
        print("      → Could not determine format, returning minimal structure")
        result = pd.DataFrame({
            'city': ['Unknown'],
            'barangay': ['Unknown'],
            'year': [2020],
            'month': [1]
        })
        return result
    
    def _find_column(self, df, keywords):
        """Find column matching any keyword"""
        for col in df.columns:
            col_lower = str(col).lower()
            if any(kw in col_lower for kw in keywords):
                return col
        return None
    
    def _standardize_disease_name(self, name):
        """Standardize to lowercase_disease_cases"""
        name_str = str(name).lower()
        
        # Remove noise
        noise = ['kaso ng', 'case of', 'cases', 'case', 'count', 'total']
        for word in noise:
            name_str = name_str.replace(word, '')
        
        # Clean
        name_str = re.sub(r'[^a-z0-9]+', '_', name_str).strip('_')
        
        # Add suffix
        if not name_str.endswith('_cases'):
            name_str += '_cases'
        
        return name_str
    
    def _standardize_output(self, df):
        """Ensure standard column order and data types"""
        # Ensure required columns
        if 'city' not in df.columns:
            df['city'] = 'Unknown'
        if 'barangay' not in df.columns:
            df['barangay'] = 'Unknown'
        
        # Convert year/month to int
        if 'year' in df.columns:
            df['year'] = pd.to_numeric(df['year'], errors='coerce').astype('Int64')
        if 'month' in df.columns:
            df['month'] = pd.to_numeric(df['month'], errors='coerce').astype('Int64')
        
        # Order columns
        standard_cols = ['city', 'barangay', 'year', 'month']
        disease_cols = sorted([c for c in df.columns if c.endswith('_cases')])
        other_cols = [c for c in df.columns if c not in standard_cols and c not in disease_cols]
        
        ordered_cols = [c for c in standard_cols if c in df.columns] + disease_cols + other_cols
        df = df[ordered_cols]
        
        return df
    
    def _find_barangay_sections(self, df_raw):
        """Find multi-barangay sections (same as before)"""
        sections = []
        for idx in range(len(df_raw)):
            first_cell = str(df_raw.iloc[idx, 0]).strip()
            if 'barangay' in first_cell.lower() and len(first_cell) > 8:
                sections.append(idx)
        return sections
    
    def _process_multi_barangay_sections(self, filepath, sections):
        """Process multi-barangay files using SmartHealthPreprocessor"""
        print(f"   🔄 Using SmartHealthPreprocessor for multi-barangay format...")
        
        try:
            # Import and use existing preprocessor
            import sys
            import os
            
            # Add current directory to path
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            
            from smart_health_preprocessor import SmartHealthPreprocessor
            
            preprocessor = SmartHealthPreprocessor()
            df = preprocessor.process_file(filepath)
            df = preprocessor.complete_time_series(df)
            
            print(f"      ✅ SmartHealthPreprocessor succeeded")
            return df
            
        except ImportError:
            print(f"      ⚠️ SmartHealthPreprocessor not available, processing manually...")
            # Fallback: process manually
            return self._process_manual_multibarangay(filepath, sections)
        except Exception as e:
            print(f"      ⚠️ SmartHealthPreprocessor failed: {e}")
            raise
    
    def complete_time_series(self, df):
        """
        ✅ Fill missing months and empty cells (same as SmartHealthPreprocessor)
        For EACH barangay:
          1. Fill NaN disease cells → 0
          2. Insert missing months (year/month combos) → all diseases = 0
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
        if 'barangay' not in df.columns:
            return df
        
        completed = []
        total_added = 0
        
        for brgy in df['barangay'].unique():
            df_b = df[df['barangay'] == brgy].copy()
            
            # Get date range
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
        
        return result

# Wrapper function
def preprocess_any_health_file(filepath):
    """Auto-process ANY health data file format"""
    processor = UltimateAutoPreprocessor()
    return processor.process_file(filepath)

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        df = preprocess_any_health_file(sys.argv[1])
        print(f"\n✅ Result: {df.shape}")
        print(f"Columns: {list(df.columns)}")
        print(df.head())