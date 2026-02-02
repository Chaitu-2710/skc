import json
import re
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
# Enable CORS so the local frontend can talk to the local backend
CORS(app)

# Load our local "Database" of keywords
def load_keywords():
    with open('roles_keywords.json', 'r') as f:
        return json.load(f)

import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase Admin
# To use Firebase in the backend, download your 'serviceAccountKey.json' 
# from Firebase Console > Project Settings > Service Accounts.
try:
    import os
    key_path = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
    if os.path.exists(key_path):
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("✅ Firebase Admin connected successfully.")
    else:
        db = None
        print("⚠️ Warning: 'serviceAccountKey.json' not found. Backend history will be saved locally.")
        print("👉 To fix: Go to Firebase Console -> Service Accounts -> Generate New Private Key.")
except Exception as e:
    db = None
    print(f"❌ Error initializing Firebase Admin: {e}")

def save_to_history(result_data):
    if db:
        try:
            from datetime import datetime
            result_data['timestamp'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            # Save to 'scans' collection in Firebase
            db.collection('scans').add(result_data)
            print("Result saved to Firebase Firestore!")
        except Exception as e:
            print(f"Error saving to Firebase: {e}")
    else:
        # Fallback to local file if Firebase is not connected
        try:
            import os
            history = []
            if os.path.exists('scans_history.json'):
                with open('scans_history.json', 'r') as f:
                    history = json.load(f)
            history.append(result_data)
            with open('scans_history.json', 'w') as f:
                json.dump(history, f, indent=4)
            print("Firebase not active, saved to local scans_history.json instead.")
        except:
            pass

@app.route('/analyze', methods=['POST'])
def analyze_resume():
    data = request.json
    resume_text = data.get('resume_text', '').lower()
    job_role_key = data.get('job_role', '')
    custom_jd = data.get('custom_jd', '').lower()
    is_custom = data.get('is_custom', False)

    roles_data = load_keywords()
    
    target_data = {
        "must_have": [],
        "important": [],
        "optional": []
    }
    job_title = "Selected Role"

    if is_custom:
        # Simple extraction for custom JD
        tech_skills = ["java", "spring boot", "rest api", "sql", "git", "microservices", "react", "javascript", "python", "aws", "docker", "kubernetes", "node.js", "typescript", "html", "css", "machine learning", "figma", "agile", "jenkins"]
        for skill in tech_skills:
            if skill in custom_jd:
                target_data["important"].append(skill)
        job_title = "Custom Role"
        if not target_data["important"]:
             return jsonify({"error": "No technical keywords detected in your job description."}), 400
    else:
        if job_role_key not in roles_data:
            return jsonify({"error": "Invalid job role selected."}), 400
        
        role_info = roles_data[job_role_key]
        target_data["must_have"] = role_info.get("must_have", [])
        target_data["important"] = role_info.get("important", [])
        target_data["optional"] = role_info.get("optional", [])
        job_title = role_info.get("title", "Job Role")

    # Analysis Weights: Must-have: 3, Important: 2, Optional: 1
    total_weight = 0
    matched_weight = 0
    matched_keywords = []
    missing_keywords = []

    def process_group(keywords, weight):
        nonlocal total_weight, matched_weight
        for kw in keywords:
            total_weight += weight
            if re.search(r'\b' + re.escape(kw) + r'\b', resume_text, re.IGNORECASE):
                matched_weight += weight
                matched_keywords.append({"name": kw, "level": weight})
            else:
                missing_keywords.append({"name": kw, "level": weight})

    process_group(target_data["must_have"], 3)
    process_group(target_data["important"], 2)
    process_group(target_data["optional"], 1)

    score = round((matched_weight / total_weight) * 100) if total_weight > 0 else 0

    response_data = {
        "score": score,
        "job_title": job_title,
        "matched": matched_keywords,
        "missing": missing_keywords,
        "verdict": "STRONG" if score >= 70 else ("MEDIUM" if score >= 40 else "POOR")
    }

    # PERSISTENCE: Save this result to the database (Firebase or Local)
    save_to_history({
        "score": score,
        "job_title": job_title,
        "matched_count": len(matched_keywords),
        "missing_count": len(missing_keywords),
        "matched": [k['name'] for k in matched_keywords],
        "missing": [k['name'] for k in missing_keywords],
        "verdict": response_data["verdict"]
    })

    return jsonify(response_data)

@app.route('/history', methods=['GET'])
def get_history():
    if db:
        try:
            docs = db.collection('scans').order_by('timestamp', direction=firestore.Query.DESCENDING).limit(20).stream()
            history = []
            for doc in docs:
                data = doc.to_dict()
                data['id'] = doc.id
                history.append(data)
            return jsonify(history)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        try:
            import os
            if os.path.exists('scans_history.json'):
                with open('scans_history.json', 'r') as f:
                    history = json.load(f)
                return jsonify(history[::-1][:20]) # Return last 20 reversed
            return jsonify([])
        except:
            return jsonify([])

if __name__ == '__main__':
    print("ResumeScan Pro Backend starting on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
