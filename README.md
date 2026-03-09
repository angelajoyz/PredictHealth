# 🏥 Barangay Health Data Dashboard

Modern health prediction dashboard with **drag-and-drop CSV/Excel import** functionality.

## ✨ Features

### 📊 Dashboard Components
- **Sidebar Navigation** - Clean menu with active states
- **Stats Cards** - 4 key metrics with icons and colors
- **Line Chart** - Predicted vs Current patient volume
- **Donut Chart** - Illness distribution visualization
- **Trend Summary** - AI-powered insights and warnings
- **Prediction Confidence** - Model accuracy indicator

### 📁 File Import (NEW!)
- **Drag & Drop** - Upload CSV and Excel files
- **File Browser** - Click to select files
- **Validation** - Only accepts .csv, .xlsx, .xls formats
- **File Preview** - Shows uploaded file name and size
- **Ready for Processing** - Connects to your backend API

## 🚀 Quick Start

### 1. Setup
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

Dashboard opens at: **http://localhost:3000**

### 3. Build for Production
```bash
npm run build
```

## 🛠️ Tech Stack

### Frontend
- **React.js** (v18.2) with Vite
- **Material UI** (v5.14) - UI components
- **Recharts** (v2.10) - Charts
- **Single CSS File** - All styles in `Dashboard.css`

### File Processing (Ready to Connect)
- **xlsx** - Excel file parsing
- **papaparse** - CSV file parsing

### Backend (Your Setup)
- Python + FastAPI
- TensorFlow (LSTM)
- PostgreSQL
- Pandas, NumPy

## 📂 Project Structure

```
barangay-health-dashboard/
├── Dashboard.jsx       # Main component with all features
├── Dashboard.css       # Single CSS file (complete styling)
├── App.jsx            # Theme provider and root
├── main.jsx           # Entry point
├── index.html         # HTML template
├── vite.config.js     # Vite configuration
└── package.json       # Dependencies
```

## 🎯 Using the Dashboard

### Import Data
1. Click **"Import Data"** button in header
2. Drag and drop your CSV/Excel file OR click "Browse Files"
3. File gets validated (only .csv, .xlsx, .xls accepted)
4. Click **"Upload & Process"**
5. File data ready to send to backend

### File Upload Implementation

The dashboard is ready to connect to your backend. Here's how:

**Current Code (Dashboard.jsx)**:
```javascript
const handleFile = (file) => {
  setUploadedFile(file);
  // TODO: Send to backend for processing
};
```

**To Connect to Backend**:
```javascript
const handleFile = async (file) => {
  setUploadedFile(file);
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await fetch('http://localhost:8000/api/upload', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    console.log('Upload success:', result);
    // Update dashboard with new data
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

## 🔧 Customization

### Change Colors
Edit `Dashboard.css`:
```css
/* Primary Blue */
.user-avatar {
  background: linear-gradient(135deg, #YOUR_COLOR 0%, #YOUR_COLOR_DARK 100%);
}

/* Change stat card colors */
.stat-icon {
  background-color: #YOUR_COLOR15; /* 15 = opacity */
}
```

### Change Data
Edit arrays in `Dashboard.jsx`:
```javascript
// Update stats
const stats = [
  { 
    title: 'Your Title', 
    value: '123', 
    subtitle: 'Your subtitle',
    icon: <YourIcon />,
    color: '#HEX_COLOR'
  },
];

// Update chart data
const volumeData = [
  { month: 'Jan', current: 100, predicted: 120 },
  // Add more months...
];
```

### Add Backend API Integration
Create `services/api.js`:
```javascript
const API_URL = 'http://localhost:8000/api';

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    body: formData,
  });
  
  return response.json();
};

export const fetchPredictions = async () => {
  const response = await fetch(`${API_URL}/predictions`);
  return response.json();
};
```

Then import in `Dashboard.jsx`:
```javascript
import { uploadFile, fetchPredictions } from './services/api';
```

## 📊 Backend API Endpoints (Example)

Your Python FastAPI backend should have:

```python
# File upload endpoint
@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    # Process CSV/Excel file
    # Save to database
    # Run ML predictions
    return {"status": "success", "message": "File processed"}

# Get current stats
@app.get("/api/stats")
async def get_stats():
    return {
        "total_patients": 280,
        "predicted_next_month": 340,
        "active_cases": 45,
        "forecast_periods": 6
    }

# Get chart data
@app.get("/api/predictions/volume")
async def get_volume_predictions():
    return [
        {"month": "Jan", "current": 165, "predicted": 170},
        # More data...
    ]
```

## 🎨 Features Explained

### Drag & Drop Upload
- **Visual Feedback**: Area highlights when dragging file over it
- **File Validation**: Only accepts CSV and Excel files
- **Error Handling**: Shows alert for invalid file types
- **File Info**: Displays file name and size after selection
- **Remove Option**: Can remove selected file before uploading

### Responsive Design
- **Desktop**: 4-column stats, 2-column charts
- **Tablet**: 2-column stats, 1-column charts
- **Mobile**: Single column layout, collapsible sidebar

### Interactive Elements
- **Hover Effects**: Cards lift on hover
- **Active States**: Navigation menu shows active page
- **Smooth Transitions**: All animations use CSS transitions
- **Loading States**: Ready for API loading indicators

## 🔌 Processing Uploaded Files

To actually process the CSV/Excel files in React before sending to backend:

```javascript
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// For Excel files
const handleExcel = (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet);
    console.log('Excel data:', json);
    // Send to backend
  };
  reader.readAsArrayBuffer(file);
};

// For CSV files
const handleCSV = (file) => {
  Papa.parse(file, {
    complete: (results) => {
      console.log('CSV data:', results.data);
      // Send to backend
    },
    header: true
  });
};
```

## 📱 Mobile Support
Fully responsive on all devices:
- ✅ Desktop (1920px+)
- ✅ Laptop (1400px+)
- ✅ Tablet (768px+)
- ✅ Mobile (375px+)

## 🐛 Troubleshooting

**Issue**: `npm install` fails
**Fix**: Make sure Node.js v16+ is installed

**Issue**: Port 3000 already in use
**Fix**: Change port in `vite.config.js` to 3001 or any available port

**Issue**: File upload not working
**Fix**: Check browser console for errors, ensure file type is correct

**Issue**: Charts not displaying
**Fix**: Run `npm install recharts` again

## 📖 What's Next?

1. **Connect Backend API** - Integrate with FastAPI endpoints
2. **Process Files** - Use xlsx/papaparse to read uploaded data
3. **Real-time Updates** - Add WebSocket for live predictions
4. **User Authentication** - Add login system
5. **Export Reports** - Generate PDF reports from dashboard
6. **Data Filtering** - Add date range and filter controls
7. **Multiple Barangays** - Support multi-location data

## 🎓 Learning Resources

- [React Documentation](https://react.dev/)
- [Material UI Docs](https://mui.com/)
- [Recharts Examples](https://recharts.org/en-US/examples)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [TensorFlow LSTM Guide](https://www.tensorflow.org/guide/keras/rnn)

## 📄 License

MIT License - Free to use and modify

## 👥 Support

For questions or issues, check the code comments or create an issue.

---

**Ready to use! Just run `npm install` then `npm run dev` 🚀**
