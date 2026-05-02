import os
import io
import base64
import numpy as np
from PIL import Image
from flask import Blueprint, request, jsonify
from tensorflow.keras.models import load_model
from pymongo import MongoClient
from datetime import datetime

predict_bp = Blueprint('predict_bp', __name__)

# MongoDB Configuration
# Using a short timeout to avoid hanging the server if MongoDB is not running
MONGO_URI = "mongodb://localhost:27017/"
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
db = client["retinal_db"]
# Single collection named connection1 as per user request
collection = db["connection1"]

DISEASES = [
    {
        "code": "DR",
        "name": "Diabetic Retinopathy",
        "description": "Damage to retinal blood vessels caused by diabetes. Can lead to vision loss if untreated.",
        "color": "#f87171",
    },
    {
        "code": "MH",
        "name": "Macular Hole",
        "description": "A small break in the macula — the part of the retina responsible for sharp central vision.",
        "color": "#fb923c",
    },
    {
        "code": "DN",
        "name": "Drusen / Normal",
        "description": "Small yellow deposits under the retina. Can indicate early or intermediate age-related macular degeneration.",
        "color": "#facc15",
    },
    {
        "code": "TSLN",
        "name": "Tessellation",
        "description": "A tigroid (mosaic-like) pattern in the retinal fundus, commonly associated with high myopia.",
        "color": "#34d399",
    },
    {
        "code": "ODC",
        "name": "Optic Disc Cup",
        "description": "Abnormal cupping of the optic disc, a hallmark sign of glaucoma progression.",
        "color": "#60a5fa",
    },
]

# Model Configuration
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "model", "multi_CNN.h5")
IMG_SIZE = (244, 244)

print("[INFO] Loading CNN model...")
model = None
try:
    model = load_model(MODEL_PATH)
    print("[INFO] Model loaded successfully.")
except Exception as e:
    print(f"[ERROR] Failed to load model: {e}")


def preprocess_image(pil_image: Image.Image) -> np.ndarray:
    """Resize, convert to numpy array and normalise to [0, 1]."""
    img = pil_image.convert("RGB")
    img = img.resize(IMG_SIZE)
    arr = np.array(img, dtype=np.float32)
    arr = arr / 255.0
    arr = np.expand_dims(arr, axis=0)
    return arr


def convert_to_binary_matrix(pil_image: Image.Image) -> list:
    """Convert image to a binary matrix of 0s and 1s."""
    img = pil_image.convert("L")  # Grayscale
    img = img.resize((100, 100))  # Resize to smaller matrix for storage efficiency if needed
    arr = np.array(img)
    # Thresholding to get 0s and 1s
    binary_arr = (arr > 128).astype(int)
    return binary_arr.tolist()


def is_retinal_image(pil_image: Image.Image) -> bool:
    """
    Heuristic check to see if an image is a retinal fundus image.
    Checks for:
    1. Red-dominant color distribution (Orange/Red spectrum)
    2. Minimum variance (to avoid solid colors)
    3. Brightness range typical of fundus scans
    """
    # Convert to RGB and resize for fast processing
    img = pil_image.convert("RGB")
    img = img.resize((100, 100))
    arr = np.array(img)
    
    # 1. Check for typical retinal colors (Red channel should be strongest)
    avg_color = np.mean(arr, axis=(0, 1))
    r, g, b = avg_color
    
    # 2. Check for variance (to avoid solid colors or noise)
    std_dev = np.std(arr)
    
    # 3. Check for dark corners (circular mask - common in fundus images)
    corners = [
        arr[0:10, 0:10], arr[0:10, 90:100],
        arr[90:100, 0:10], arr[90:100, 90:100]
    ]
    corner_avg = np.mean([np.mean(c) for c in corners])

    # Debug print
    print(f"[INFO] Validation: R={r:.1f}, G={g:.1f}, B={b:.1f}, Std={std_dev:.1f}, CornerAvg={corner_avg:.1f}")

    # Heuristic Thresholds:
    # - R should be the dominant channel (R > G and R > B)
    # - R should be at least 1.2x of B
    # - Std Dev > 15 (ensures it's not a flat image)
    # - CornerAvg is often low in fundus images, but we don't strictly require it 
    #   in case the image is cropped.
    
    is_red_dominant = r > g * 0.9 and r > b * 1.2
    is_bright_enough = r > 40
    is_not_flat = std_dev > 15
    
    # Most retinal images pass these checks.
    # Non-retinal images (faces, landscapes) usually have more balanced R/G/B 
    # or different dominance.
    return is_red_dominant and is_bright_enough and is_not_flat


def build_explanation(sorted_results: list) -> str:
    """Build a human-readable explanation from the prediction results."""
    top_disease, top_prob = sorted_results[0]
    top_pct = top_prob * 100

    detected = [(d, p) for d, p in sorted_results if p >= 0.5]
    if detected:
        detected_names = ", ".join(d["name"] for d, _ in detected)
        return (
            f"The AI model has identified patterns most consistent with "
            f"{top_disease['name']} ({top_pct:.1f}% confidence). "
            f"The following conditions exceeded the 50% detection threshold: {detected_names}. "
            f"Please consult a qualified ophthalmologist for a clinical diagnosis. "
            f"Note: This is a multi-label classifier — the model can detect more than one condition at a time."
        )
    else:
        return (
            f"The AI model identified {top_disease['name']} as the most likely condition "
            f"with {top_pct:.1f}% confidence. No condition exceeded the 50% detection threshold. "
            f"Results may still warrant clinical review by a qualified ophthalmologist."
        )


@predict_bp.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({"error": "Model is not loaded. Check server logs."}), 503

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded. Please send an image as 'file' in multipart/form-data."}), 400

    file = request.files["file"]
    patient_name = request.form.get("patientName", "Unknown")
    patient_id = request.form.get("patientId", "PT-XXXXXX")
    doctor_id = request.form.get("doctorId") or request.form.get("doctor_id")

    if file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    allowed_extensions = {"jpg", "jpeg", "png", "bmp", "tiff"}
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed_extensions:
        return jsonify({"error": f"Unsupported file type: '{ext}'. Allowed: {allowed_extensions}"}), 400

    try:
        img_bytes = file.read()
        pil_image = Image.open(io.BytesIO(img_bytes))
        
        # Validate if it's a retinal image
        if not is_retinal_image(pil_image):
            print(f"[WARNING] Invalid image rejected: {file.filename}")
            return jsonify({
                "error": "Invalid image detected. Please upload a valid retinal fundus scan image.",
                "details": "The image provided does not match the expected color and pattern profile of a retinal scan."
            }), 400

        # Preprocess for model
        img_array = preprocess_image(pil_image)
        
        # Convert to binary matrix for storage
        binary_matrix = convert_to_binary_matrix(pil_image)
        
        # Convert original image to base64 for storage and UI display
        buffered = io.BytesIO()
        pil_image.save(buffered, format="PNG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')

        preds = model.predict(img_array, verbose=0)[0]
        
        # Adjust for 0% prediction as requested
        # If all predictions are very low (below 1%), pick the max one and set to 1-5%
        if np.all(preds < 0.01):
            max_idx = np.argmax(preds)
            new_val = np.random.uniform(0.01, 0.05)
            preds[max_idx] = new_val
            print(f"[INFO] Adjusted 0% prediction for {DISEASES[max_idx]['name']} to {new_val*100:.2f}%")

        results = list(zip(DISEASES, preds.tolist()))
        results.sort(key=lambda x: x[1], reverse=True)

        top_disease, top_prob = results[0]
        top_pct = round(top_prob * 100, 2)

        risks = {disease["name"]: round(prob * 100, 2) for disease, prob in results}

        diseases_list = [
            {
                "code": d["code"],
                "name": d["name"],
                "description": d["description"],
                "color": d["color"],
                "probability": round(p * 100, 2),
            }
            for d, p in results
        ]

        explanation = build_explanation(results)

        # Prepare record for MongoDB
        record = {
            "patient_name": patient_name,
            "patient_id": patient_id,
            "doctor_id": doctor_id, # Added doctor_id
            "date": datetime.now(),
            "original_image": f"data:image/png;base64,{img_base64}",
            "binary_image": binary_matrix,
            "predicted_disease": top_disease["code"],
            "predicted_disease_name": top_disease["name"],
            "probability": top_pct,
            "risks": diseases_list,
            "explanation": explanation,
            "status": "Pending Review" if top_pct > 50 else "Auto-Cleared"
        }
        
        # Save to MongoDB
        try:
            collection.insert_one(record)
        except Exception as mongo_err:
            print(f"[WARNING] MongoDB save failed: {mongo_err}")

        return jsonify({
            "explanation": explanation,
            "predicted_disease": top_disease["code"],
            "predicted_disease_name": top_disease["name"],
            "top_probability": top_pct,
            "risks": risks,
            "diseases": diseases_list,
            "shap_values": []
        })

    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500


@predict_bp.route("/api/report/<record_id>", methods=["GET"])
def download_report(record_id):
    try:
        from bson.objectid import ObjectId
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        
        record = collection.find_one({"_id": ObjectId(record_id)})
        if not record:
            return jsonify({"error": "Report not found"}), 404
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle('TitleStyle', parent=styles['Heading1'], alignment=1, spaceAfter=20)
        heading_style = ParagraphStyle('HeadingStyle', parent=styles['Heading2'], spaceBefore=10, spaceAfter=10)
        body_style = styles['BodyText']
        
        elements = []
        
        # Header
        elements.append(Paragraph("Retinal Disease Analysis Report", title_style))
        elements.append(Spacer(1, 12))
        
        # Patient Info
        elements.append(Paragraph("Patient Information", heading_style))
        patient_data = [
            ["Patient Name:", record.get("patient_name", "Unknown")],
            ["Patient ID:", record.get("patient_id", "Unknown")],
            ["Doctor ID:", record.get("doctor_id", "N/A")], # Added doctor_id to report
            ["Date of Scan:", record.get("date").strftime("%Y-%m-%d %H:%M") if isinstance(record.get("date"), datetime) else str(record.get("date"))]
        ]
        patient_table = Table(patient_data, colWidths=[120, 300])
        patient_table.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('BACKGROUND', (0,0), (0,-1), colors.whitesmoke),
            ('PADDING', (0,0), (-1,-1), 6)
        ]))
        elements.append(patient_table)
        elements.append(Spacer(1, 20))
        
        # Scan Image
        elements.append(Paragraph("Retinal Scan Image", heading_style))
        img_data = record.get("original_image")
        if img_data and "base64," in img_data:
            header, encoded = img_data.split("base64,")
            img_bytes = base64.b64decode(encoded)
            img_io = io.BytesIO(img_bytes)
            img = RLImage(img_io, width=200, height=200)
            elements.append(img)
        elements.append(Spacer(1, 20))
        
        # Prediction Results
        elements.append(Paragraph("AI Diagnostic Results", heading_style))
        elements.append(Paragraph(f"<b>Top Prediction: {record.get('predicted_disease_name')}</b>", body_style))
        elements.append(Paragraph(f"Confidence Level: {record.get('probability')}%", body_style))
        elements.append(Spacer(1, 10))
        
        # All Risks Table
        elements.append(Paragraph("Full Probability List", styles['Heading3']))
        risks_data = [["Disease Name", "Code", "Probability (%)"]]
        for r in record.get("risks", []):
            risks_data.append([r["name"], r["code"], f"{r['probability']}%"])
        
        risks_table = Table(risks_data, colWidths=[200, 100, 120])
        risks_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('PADDING', (0,0), (-1,-1), 6)
        ]))
        elements.append(risks_table)
        elements.append(Spacer(1, 20))
        
        # Explanation
        elements.append(Paragraph("Clinical Insight", heading_style))
        elements.append(Paragraph(record.get("explanation", "No explanation available."), body_style))
        
        # Disclaimer
        elements.append(Spacer(1, 40))
        disclaimer = "DISCLAIMER: This report was generated by an AI model. It is intended for informational purposes only and does not constitute a clinical diagnosis. Please consult a qualified ophthalmologist."
        elements.append(Paragraph(f"<font size='8' color='grey'>{disclaimer}</font>", body_style))
        
        doc.build(elements)
        buffer.seek(0)
        
        from flask import send_file
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f"Report_{record.get('patient_id')}_{record_id}.pdf",
            mimetype='application/pdf'
        )
    except Exception as e:
        print(f"[ERROR] PDF Generation failed: {e}")
        return jsonify({"error": f"Failed to generate report: {str(e)}"}), 500


@predict_bp.route("/api/history", methods=["GET"])
def get_history():
    """Fetch all patient scan records, optionally filtered by doctor."""
    try:
        doctor_id = request.args.get("doctor_id")
        query = {}
        if doctor_id:
            query["doctor_id"] = doctor_id
            
        # Fetch all records, most recent first
        records = list(collection.find(query).sort("date", -1))
        for r in records:
            r["_id"] = str(r["_id"])
            # Format date for frontend
            if isinstance(r["date"], datetime):
                r["date"] = r["date"].strftime("%Y-%m-%d")
        return jsonify(records)
    except Exception as e:
        return jsonify({"error": f"Failed to fetch history: {str(e)}"}), 500


@predict_bp.route("/api/stats", methods=["GET"])
def get_stats():
    """Calculate and return dashboard statistics, optionally filtered by doctor."""
    try:
        doctor_id = request.args.get("doctor_id")
        query = {}
        if doctor_id:
            query["doctor_id"] = doctor_id
            
        total_scans = collection.count_documents(query)
        
        # Simplified count for high risk with query
        if doctor_id:
             high_risk_cases = collection.count_documents({"doctor_id": doctor_id, "probability": {"$gt": 70}})
        else:
             high_risk_cases = collection.count_documents({"probability": {"$gt": 70}})

        # Average confidence
        pipeline_avg = [
            {"$match": query}, # Apply filter here
            {"$group": {"_id": None, "avg_conf": {"$avg": "$probability"}}}
        ]
        result_avg = list(collection.aggregate(pipeline_avg))
        avg_confidence = round(result_avg[0]["avg_conf"], 1) if result_avg else 0
        
        # New patients (unique patient IDs)
        new_patients = len(collection.distinct("patient_id"))

        # Disease Distribution for Pie Chart
        pipeline_dist = [
            {"$group": {"_id": "$predicted_disease_name", "count": {"$sum": 1}}}
        ]
        dist_results = list(collection.aggregate(pipeline_dist))
        
        # Expected disease names for consistency in chart labels
        disease_names = [d["name"] for d in DISEASES]
        dist_data = {d_name: 0 for d_name in disease_names}
        for dr in dist_results:
            if dr["_id"] in dist_data:
                dist_data[dr["_id"]] = dr["count"]
        
        pie_chart_data = {
            "labels": list(dist_data.keys()),
            "data": list(dist_data.values())
        }

        # Daily Activity for last 7 days
        # We'll calculate dates for the last 7 days
        from datetime import timedelta
        end_date = datetime.now()
        start_date = end_date - timedelta(days=6)
        
        activity_pipeline = [
            {"$match": {"date": {"$gte": start_date}}},
            {"$project": {"day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$date"}}}},
            {"$group": {"_id": "$day", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}}
        ]
        activity_results = list(collection.aggregate(activity_pipeline))
        
        activity_map = {ar["_id"]: ar["count"] for ar in activity_results}
        
        activity_labels = []
        activity_counts = []
        for i in range(7):
            d = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
            activity_labels.append(d)
            activity_counts.append(activity_map.get(d, 0))
            
        line_chart_data = {
            "labels": activity_labels,
            "data": activity_counts
        }
        
        return jsonify({
            "total_scans": total_scans,
            "high_risk_cases": high_risk_cases,
            "avg_confidence": avg_confidence,
            "new_patients": new_patients,
            "pie_chart": pie_chart_data,
            "line_chart": line_chart_data
        })
    except Exception as e:
        print(f"[ERROR] Stats failed: {e}")
        return jsonify({"error": f"Failed to fetch stats: {str(e)}"}), 500
