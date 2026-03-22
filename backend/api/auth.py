from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
import os

auth_bp = Blueprint('auth_bp', __name__)

# MongoDB Configuration
MONGO_URI = "mongodb://localhost:27017/"
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
db = client["retinal_db"]
users_collection = db["users"]

@auth_bp.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
        
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not name or not email or not password:
        return jsonify({"error": "Missing Name, Email or Password"}), 400

    if users_collection.find_one({"email": email}):
        return jsonify({"error": "User with this email already exists"}), 400

    hashed_password = generate_password_hash(password)
    user_id = users_collection.insert_one({
        "name": name,
        "email": email,
        "password": hashed_password
    }).inserted_id

    return jsonify({
        "message": "Signup successful",
        "user": {
            "name": name,
            "email": email,
            "doctor_id": str(user_id)
        }
    }), 201

@auth_bp.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
        
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = users_collection.find_one({"email": email})
    if not user or not check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid email or password"}), 401

    return jsonify({
        "message": "Login successful",
        "user": {
            "name": user["name"],
            "email": user["email"],
            "doctor_id": str(user["_id"])
        }
    }), 200
