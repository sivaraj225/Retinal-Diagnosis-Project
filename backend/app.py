import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import blueprints
from api.predict import predict_bp
from api.auth import auth_bp

# App Setup
app = Flask(__name__)
CORS(app)  # Allow requests from Angular development server

# Register Blueprints
app.register_blueprint(predict_bp)
app.register_blueprint(auth_bp)

@app.route("/", methods=["GET"])
def health_check():
    """Simple health check endpoint."""
    return jsonify({
        "status": "ok",
        "message": "Retinal Disease Classifier API is running with modular APIs."
    })

if __name__ == "__main__":
    print("[INFO] Starting Retinal Disease Classifier API server on http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
