# ✨ ResumeScan Pro

**ResumeScan Pro** is a high-performance, ATS-optimized resume analysis tool designed to help job seekers bridge the gap between their skills and job requirements. Built with a focus on **resilience**, **speed**, and **professional aesthetics**, it provides instant feedback on resume-to-job matching.

Developed by **SCK**.

---

## 🚀 Key Features

### 🔍 AI-Powered Matching
- **Instant Scoring:** Get a percentage match score based on industry-standard job roles.
- **Keyword Analysis:** Identifies "Top Matches" and "Critical Gaps" (missing must-have skills).
- **Custom JDs:** Ability to paste custom Job Descriptions for tailored analysis.

### 🛡️ Self-Healing & Resilience
- **Offline Survival Mode:** Works perfectly without an internet connection using an internal local engine.
- **Background Sync:** Automatically pushes offline scans to the cloud the moment the connection returns.
- **Zero-Latency History:** Uses a **Cache-First** strategy to load your scan history instantly.

### 📊 Admin Dashboard
- **Global Analytics:** Track "Total Users", "Total Scans", and "Average Match Scores".
- **Live Feed:** Real-time visibility into platform activity (restricted to admin emails).

### 🔐 Secure Authentication
- **Gmail-Focused Login:** Professional Email/Password authentication.
- **Data Isolation:** User history is securely stored and isolated per account.

---

## 🛠️ Technology Stack

- **Frontend:** HTML5, Vanilla CSS3 (Custom Glassmorphism Design), Javascript (ES6+).
- **Libraries:** [PDF.js](https://mozilla.github.io/pdf.js/) for high-accuracy local resume extraction.
- **Database/Auth:** [Firebase](https://firebase.google.com/) (Firestore & Auth) with a built-in **Mock Cloud API** for local development.
- **Feedback:** Custom **Toast Notification System** for a non-intrusive user experience.

---

## 📦 Installation & Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/your-username/resume-scan-pro.git
   cd resume-scan-pro
   ```

2. **Configure Firebase (Optional):**
   Open `script.js` and replace the `firebaseConfig` placeholders with your own keys from the [Firebase Console](https://console.firebase.google.com/).
   *Note: If no keys are provided, the app automatically runs in **Virtual Cloud Mode**.*

3. **Launch the App:**
   Simply open `index.html` in any modern web browser or use a Live Server extension.

---

## 🎨 Design Philosophy
The application follows a **Modern Dark Aesthetic** using:
- **Glassmorphism:** Frosted-glass cards with vibrant backdrop blurs.
- **Dynamic Feedback:** Real-time system health indicators (Cloud vs Offline status).
- **Responsive Layout:** Optimized for all screen sizes from mobile to desktop.

---

## 📄 License
Designed and developed by SCK. All rights reserved. 2026.
