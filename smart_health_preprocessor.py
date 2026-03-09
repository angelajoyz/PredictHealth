"""
SMART HEALTH DATA PREPROCESSOR - V2
Handles multi-barangay long format files + all other formats
"""
import pandas as pd
import numpy as np
import re

class SmartHealthPreprocessor:
    def __init__(self):
        self.metadata_keywords = [
            'city', 'barangay', 'year', 'month', 'date', 'time',
            'population', 'density', 'facilities', 'facility',
            'temperature', 'rainfall', 'humidity', 'wind', 'solar', 'pressure',
            'flood', 'air_quality', 'pm25', 'pm10', 'waste', 'water_quality',
            'ndvi', 'distance', 'poverty', 'employment', 'literacy', 'income'
        ]
        
        self.disease_keywords = [
            'dengue', 'diarrhea', 'diarrhoea', 'respiratory', 'malnutrition',
            'hypertension', 'diabetes', 'tuberculosis', 'tb', 'malaria',
            'typhoid', 'pneumonia', 'asthma', 'covid', 'influenza', 'flu',
            'measles', 'chickenpox', 'hepatitis', 'cholera', 'leptospirosis',
            'rabies', 'ptb', 'eptb', 'hiv', 'aids', 'cancer', 'stroke'
        ]
    
    def process_file(self, filepath):
        """Main entry point"""
        xl = pd.ExcelFile(filepath)
        
        # Check if file has multi-barangay long format
        df_raw = pd.read_excel(filepath, sheet_name=0, header=None)
        barangay_sections = self._find_barangay_sections(df_raw)
        
        if len(barangay_sections) > 1:
            # Multi-barangay long format
            print(f"   Found {len(barangay_sections)} barangay sections in long format")
            return self._process_multi_barangay_long(filepath, barangay_sections)
        
        # Try normal read (single barangay or wide format)
        sheets = xl.sheet_names
        
        if 'Unified_Data' in sheets:
            df = pd.read_excel(filepath, sheet_name='Unified_Data')
            if 'Health_Data' in sheets:
                df_health = pd.read_excel(filepath, sheet_name='Health_Data')
                new_cols = [c for c in df_health.columns
                            if c.endswith('_cases') and c not in df.columns]
                if new_cols:
                    merge_keys = [k for k in ['city', 'barangay', 'year', 'month']
                                  if k in df.columns and k in df_health.columns]
                    if merge_keys:
                        df = df.merge(df_health[merge_keys + new_cols], on=merge_keys, how='left')
            return df
        
        elif 'Health_Data' in sheets:
            df = pd.read_excel(filepath, sheet_name='Health_Data')
            if self._is_long_format(df):
                brgy_name = self._extract_barangay_from_title(df_raw)
                header_row = self._find_header_row(df_raw)
                df = pd.read_excel(filepath, sheet_name='Health_Data', header=header_row)
                return self._transform_long_to_wide(df, brgy_name)
            return df
        
        else:
            # Single sheet
            df = pd.read_excel(filepath, sheet_name=0)
            if self._is_long_format(df):
                brgy_name = self._extract_barangay_from_title(df_raw)
                header_row = self._find_header_row(df_raw)
                df = pd.read_excel(filepath, sheet_name=0, header=header_row)
                return self._transform_long_to_wide(df, brgy_name)
            return df
    
    def _find_barangay_sections(self, df_raw):
        """Find all barangay section start rows"""
        sections = []
        for idx, row in df_raw.iterrows():
            first_cell = str(row[0])
            if 'barangay' in first_cell.lower() or 'brgy' in first_cell.lower():
                brgy_name = first_cell.replace('Barangay', '').replace('barangay', '')
                brgy_name = brgy_name.replace('Brgy.', '').replace('Brgy', '').strip()
                sections.append((brgy_name, idx))
        
        # Calculate end rows
        result = []
        for i, (brgy_name, start_row) in enumerate(sections):
            end_row = sections[i + 1][1] - 1 if i < len(sections) - 1 else len(df_raw) - 1
            result.append((brgy_name, start_row, end_row))
        
        return result
    
    def _process_multi_barangay_long(self, filepath, sections):
        """Process file with multiple barangay sections"""
        all_dfs = []
        
        for brgy_name, start_row, end_row in sections:
            try:
                nrows = end_row - start_row + 1
                df_section = pd.read_excel(
                    filepath, sheet_name=0, header=None, 
                    skiprows=start_row, nrows=nrows
                )
                
                header_row = self._find_header_row(df_section)
                
                df = pd.read_excel(
                    filepath, sheet_name=0, 
                    header=start_row + header_row,
                    nrows=nrows - header_row - 1
                )
                
                df_wide = self._transform_long_to_wide(df, brgy_name)
                
                if not df_wide.empty:
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
        """Check if DataFrame is in long format"""
        col_lower = [str(c).lower() for c in df.columns]
        return any('type of disease' in col or 'disease type' in col for col in col_lower)
    
    def _find_header_row(self, df_raw):
        """Find which row contains headers"""
        header_keywords = ['month', 'year', 'disease', 'cases', 'type', 'total', 'barangay']
        for row_idx in range(min(10, len(df_raw))):
            row_values = df_raw.iloc[row_idx].fillna('').astype(str).str.lower()
            matches = sum(any(kw in val for kw in header_keywords) for val in row_values if val)
            if matches >= 2:
                return row_idx
        return 0
    
    def _extract_barangay_from_title(self, df_raw):
        """Extract barangay name from first cell"""
        try:
            first_cell = str(df_raw.iloc[0, 0])
            if 'barangay' in first_cell.lower():
                return first_cell.replace('Barangay ', '').replace('barangay ', '').strip()
        except:
            pass
        return None
    
    def _transform_long_to_wide(self, df, barangay_name=None):
        """Transform long format to wide"""
        # Find key columns
        month_col = year_col = disease_col = cases_col = None
        
        for col in df.columns:
            col_lower = str(col).lower()
            if not month_col and 'month' in col_lower:
                month_col = col
            elif not year_col and 'year' in col_lower:
                year_col = col
            elif not disease_col and any(kw in col_lower for kw in ['disease', 'type']):
                disease_col = col
            elif not cases_col and any(kw in col_lower for kw in ['case', 'total', 'count']):
                cases_col = col
        
        if not all([year_col, disease_col, cases_col]):
            raise ValueError("Missing required columns for long→wide transformation")
        
        # Clean
        df = df.dropna(subset=[year_col, disease_col, cases_col])
        df = df[df[disease_col].astype(str) != str(disease_col)]
        
        # Prepare
        df['year'] = pd.to_numeric(df[year_col], errors='coerce').astype('Int64')
        df['month'] = self._parse_month(df[month_col]) if month_col else 1
        df[cases_col] = pd.to_numeric(df[cases_col], errors='coerce').fillna(0)
        
        # Pivot
        df_pivot = df.pivot_table(
            index=['year', 'month'],
            columns=disease_col,
            values=cases_col,
            aggfunc='sum',
            fill_value=0
        ).reset_index()
        
        # Standardize disease names
        df_pivot.columns.name = None
        rename_map = {}
        for col in df_pivot.columns:
            if col not in ['year', 'month']:
                rename_map[col] = self._standardize_disease_name(col)
        df_pivot = df_pivot.rename(columns=rename_map)
        
        # Add metadata
        df_pivot['barangay'] = barangay_name or 'Unknown'
        df_pivot['city'] = 'Unknown'
        
        # Reorder
        std_cols = ['city', 'barangay', 'year', 'month']
        disease_cols = [c for c in df_pivot.columns if c.endswith('_cases')]
        other_cols = [c for c in df_pivot.columns if c not in std_cols and c not in disease_cols]
        df_pivot = df_pivot[std_cols + disease_cols + other_cols]
        
        return df_pivot
    
    def _parse_month(self, month_series):
        """Parse month names or numbers to 1-12"""
        month_map = {
            'january': 1, 'jan': 1, 'enero': 1,
            'february': 2, 'feb': 2, 'pebrero': 2,
            'march': 3, 'mar': 3, 'marso': 3,
            'april': 4, 'apr': 4, 'abril': 4,
            'may': 5, 'mayo': 5,
            'june': 6, 'jun': 6, 'hunyo': 6,
            'july': 7, 'jul': 7, 'hulyo': 7,
            'august': 8, 'aug': 8, 'agosto': 8,
            'september': 9, 'sep': 9, 'setyembre': 9,
            'october': 10, 'oct': 10, 'oktubre': 10,
            'november': 11, 'nov': 11, 'nobyembre': 11,
            'december': 12, 'dec': 12, 'disyembre': 12
        }
        
        result = []
        for val in month_series:
            val_str = str(val).lower().strip()
            if val_str.isdigit():
                result.append(int(val_str))
            else:
                mapped = month_map.get(val_str)
                if mapped:
                    result.append(mapped)
                else:
                    for name, num in month_map.items():
                        if name in val_str:
                            result.append(num)
                            break
                    else:
                        result.append(1)
        return pd.Series(result, dtype='Int64')
    
    def _standardize_disease_name(self, name):
        """Convert disease name to standard format"""
        name_str = str(name).lower()
        noise = ['kaso ng', 'case of', 'cases', 'case', 'count', 'total']
        for word in noise:
            name_str = name_str.replace(word, ' ')
        name_str = re.sub(r'[^a-z0-9]+', '_', name_str)
        name_str = name_str.strip('_')
        if not name_str.endswith('_cases'):
            name_str += '_cases'
        return name_str
    
    def complete_time_series(self, df):
        """
        ✅ HANDLE MISSING DATA
        1. Empty cells (NaN) → fillna(0)
        2. Missing months → add rows with 0 cases
        
        Example: If June 2020 is missing, adds a row with all diseases = 0
        """
        if 'year' not in df.columns or 'month' not in df.columns:
            return df
        
        # Get disease columns
        disease_cols = [c for c in df.columns if c.endswith('_cases')]
        if not disease_cols:
            return df
        
        print(f"   🔧 Completing time series (handling missing data)...")
        
        # Step 1: Fill NaN cells with 0
        for col in disease_cols:
            nan_count = df[col].isna().sum()
            if nan_count > 0:
                print(f"      • {col}: filled {nan_count} empty cells with 0")
                df[col] = df[col].fillna(0)
        
        # Step 2: Fill missing months
        if 'barangay' not in df.columns:
            return df
        
        completed_dfs = []
        total_added = 0
        
        for barangay in df['barangay'].unique():
            df_brgy = df[df['barangay'] == barangay].copy()
            
            # Get date range
            min_year = int(df_brgy['year'].min())
            max_year = int(df_brgy['year'].max())
            
            # Create complete date range
            complete_dates = []
            for year in range(min_year, max_year + 1):
                for month in range(1, 13):
                    complete_dates.append({'year': year, 'month': month})
            
            df_complete = pd.DataFrame(complete_dates)
            
            # Count existing vs complete
            existing_count = len(df_brgy)
            expected_count = len(df_complete)
            missing_count = expected_count - existing_count
            
            if missing_count > 0:
                # Merge to add missing months
                df_brgy = df_complete.merge(
                    df_brgy,
                    on=['year', 'month'],
                    how='left'
                )
                
                # Fill metadata
                df_brgy['barangay'] = barangay
                if 'city' in df.columns:
                    city_val = df[df['barangay'] == barangay]['city'].iloc[0]
                    df_brgy['city'] = df_brgy['city'].fillna(city_val)
                else:
                    df_brgy['city'] = 'Unknown'
                
                # Fill disease columns with 0
                for col in disease_cols:
                    df_brgy[col] = df_brgy[col].fillna(0)
                
                total_added += missing_count
            
            completed_dfs.append(df_brgy)
        
        if total_added > 0:
            print(f"      • Added {total_added} missing month rows (all diseases = 0)")
        
        result = pd.concat(completed_dfs, ignore_index=True)
        result = result.sort_values(['barangay', 'year', 'month']).reset_index(drop=True)
        
        return result

def preprocess_health_file(filepath):
    """Convenience wrapper"""
    processor = SmartHealthPreprocessor()
    df = processor.process_file(filepath)
    # ✅ Auto-complete time series (handle missing data)
    df = processor.complete_time_series(df)
    return df