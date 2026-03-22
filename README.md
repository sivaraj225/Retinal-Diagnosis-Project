# Retinal Fundus Multi-Disease Classification System

This project is a comprehensive medical imaging tool designed to detect multiple retinal diseases using a Deep Learning (CNN) model. It consists of a modern **Angular** frontend and a **Flask** REST API backend.

## Project Structure

- `frontend/`: Angular-based user interface for image upload and result visualization.
- `backend/`: Flask REST API that handles image processing and model inference.
  - `model/`: Contains the pre-trained `multi_CNN.h5` model.
  - `notebooks/`: Contains the original training/analysis notebook.
  - `app.py`: Main Flask application entry point.

## Features

- **Multi-Disease Detection**: Analyzes retinal fundus images for DR, MH, DN, TSLN, and ODC.
- **REST API Architecture**: Decoupled frontend and backend for better scalability and maintenance.
- **Premium UI**: Dark-mode interface with glassmorphism elements, real-time image filters, and detailed probability visualizations.
- **Explainable Results**: Provides confidence scores and descriptions for each detected condition.

## Setup and Installation

### Prerequisites

- Node.js (v18+)
- Python (3.9+)
- pip

### Backend Setup

1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the Flask server:
   ```bash
   python app.py
   ```
   The API will be available at `http://127.0.0.1:5000`.

### Frontend Setup

1. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm start
   ```
   The application will be available at `http://localhost:4200`.

## How to Use

1. Launch both the backend and frontend servers.
2. Open the browser to `http://localhost:4200`.
3. Go to the **Upload Images** page.
4. Enter patient details and upload a retinal fundus image (JPG, PNG).
5. Click **Analyze**.
6. View the detailed results, including risk levels, probability bars, and the analyzed image with filters.

---
**Medical Disclaimer**: This tool is for educational and research purposes only. Always consult a qualified ophthalmologist for clinical diagnosis.
"# Retinal-Diagnosis-Project" 
