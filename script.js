const JOB_DATA = {
    frontend: {
        title: "Frontend Developer",
        must_have: ["react", "javascript", "html", "css"],
        important: ["typescript", "tailwind", "nextjs", "git"],
        optional: ["webpack", "vite", "redux", "accessibility"]
    },
    backend: {
        title: "Backend Developer",
        must_have: ["java", "spring boot", "rest api", "sql"],
        important: ["node.js", "express", "python", "git"],
        optional: ["docker", "kubernetes", "aws", "redis", "microservices"]
    },
    fullstack: {
        title: "Full Stack Engineer",
        must_have: ["react", "node.js", "sql", "javascript"],
        important: ["express", "typescript", "git", "rest api"],
        optional: ["mongodb", "graphql", "deployment", "cicd", "system design"]
    },
    ds: {
        title: "Data Scientist",
        must_have: ["python", "sql", "machine learning", "statistics"],
        important: ["pandas", "numpy", "scikit-learn", "data visualization"],
        optional: ["tensorflow", "pytorch", "tableau", "deep learning", "r"]
    },
    pm: {
        title: "Product Manager",
        must_have: ["agile", "scrum", "roadmapping", "communication"],
        important: ["stakeholder management", "user research", "analytics", "jira"],
        optional: ["product discovery", "strategic thinking", "market analysis"]
    },
    uiux: {
        title: "UI/UX Designer",
        must_have: ["figma", "user experience", "interface design", "prototyping"],
        important: ["wireframing", "user research", "visual design", "sketch"],
        optional: ["adobe xd", "usability testing", "design systems"]
    },
    devops: {
        title: "DevOps Engineer",
        must_have: ["ci/cd", "docker", "kubernetes", "aws"],
        important: ["terraform", "jenkins", "linux", "ansible"],
        optional: ["monitoring", "logging", "bash", "azure", "security"]
    }
};

const BACKEND_URL = "http://127.0.0.1:5000";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_ID",
    appId: "YOUR_APP_ID"
};

// --- MOCK CLOUD API (Ensures app works without external keys) ---
class MockFirebase {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('mock_user')) || null;
        this.onAuthStateChangedCallbacks = [];
    }
    auth() {
        return {
            onAuthStateChanged: (cb) => {
                this.onAuthStateChangedCallbacks.push(cb);
                cb(this.currentUser);
            },
            signInWithEmailAndPassword: async (email, pass) => {
                this.currentUser = { uid: "user_" + Date.now(), email: email };
                localStorage.setItem('mock_user', JSON.stringify(this.currentUser));
                this.onAuthStateChangedCallbacks.forEach(cb => cb(this.currentUser));
            },
            createUserWithEmailAndPassword: async (email, pass) => {
                this.currentUser = { uid: "user_" + Date.now(), email: email };
                localStorage.setItem('mock_user', JSON.stringify(this.currentUser));
                this.onAuthStateChangedCallbacks.forEach(cb => cb(this.currentUser));
            },
            signInWithPhoneNumber: async (num) => {
                this.currentUser = { uid: "user_" + Date.now(), phoneNumber: num };
                localStorage.setItem('mock_user', JSON.stringify(this.currentUser));
                this.onAuthStateChangedCallbacks.forEach(cb => cb(this.currentUser));
                return { confirm: async () => true };
            },
            signOut: async () => {
                this.currentUser = null;
                localStorage.removeItem('mock_user');
                this.onAuthStateChangedCallbacks.forEach(cb => cb(null));
            },
            currentUser: this.currentUser
        };
    }
    firestore() {
        const getStore = () => JSON.parse(localStorage.getItem('mock_db') || '[]');
        const setStore = (d) => localStorage.setItem('mock_db', JSON.stringify(d));
        return {
            collection: (name) => ({
                add: async (data) => {
                    const store = getStore();
                    store.push({ ...data, id: Date.now(), timestamp: { toDate: () => new Date() } });
                    setStore(store);
                },
                where: (field, op, val) => ({
                    orderBy: () => ({
                        limit: () => ({
                            get: async () => ({
                                empty: getStore().filter(d => d[field] === val).length === 0,
                                docs: getStore().filter(d => d[field] === val).map(d => ({ data: () => d }))
                            })
                        })
                    })
                }),
                orderBy: () => ({
                    limit: () => ({
                        get: async () => ({
                            empty: getStore().length === 0,
                            docs: getStore().sort((a, b) => b.id - a.id).map(d => ({ data: () => d }))
                        })
                    })
                })
            }),
            FieldValue: { serverTimestamp: () => new Date().toISOString() }
        };
    }
}

// --- SELF-HEALING ENGINE (Connectivity & Data Guard) ---
const SystemState = {
    isCloudActive: false,
    isOnline: navigator.onLine,
    updateStatus: (msg, type = "online") => {
        const dot = document.querySelector('.status-dot');
        const text = document.getElementById('statusText');
        if (!dot || !text) return;
        text.textContent = msg;
        dot.className = "status-dot " + (type === "offline" ? "disconnected" : (type === "sync" ? "syncing" : ""));
    },
    // Auto-Backup cloud data
    cacheToLocal: (key, data) => localStorage.setItem('cache_' + key, JSON.stringify({ data, time: Date.now() })),
    getFromLocal: (key) => JSON.parse(localStorage.getItem('cache_' + key))?.data || null,

    // Offline Queuing (The "Survival" Vault)
    queueForSync: (data) => {
        const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        queue.push({ ...data, queuedAt: Date.now() });
        localStorage.setItem('sync_queue', JSON.stringify(queue));
        SystemState.updateStatus("Logged Offline (Pending Sync)", "sync");
    },
    flushQueue: async () => {
        if (!SystemState.isOnline || !auth?.currentUser || !db) return;
        const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        if (queue.length === 0) return;

        SystemState.updateStatus(`Syncing ${queue.length} records...`, "sync");
        for (const item of queue) {
            try {
                await db.collection("scans").add(item);
            } catch (e) { console.error("Sync failed for item", e); }
        }
        localStorage.removeItem('sync_queue');
        SystemState.updateStatus("Cloud Synced", "online");
        showToast("Cloud sync complete!", "success");
    }
};

function showToast(message, type = "error") {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Connectivity Watcher
window.addEventListener('online', () => {
    SystemState.isOnline = true;
    SystemState.flushQueue();
});
window.addEventListener('offline', () => {
    SystemState.isOnline = false;
    SystemState.updateStatus("Offline Mode", "offline");
});

// Initialize Firebase state variables
let db = null;
let auth = null;
let confirmationResult = null;

// Initializing real Firebase OR Mock
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    try {
        if (firebase.apps.length === 0) firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        SystemState.isCloudActive = true;
        console.log("Real Firebase Connected.");
    } catch (err) {
        SystemState.updateStatus("Cloud Unreachable", "offline");
        console.error(err);
    }
} else {
    const mock = new MockFirebase();
    auth = mock.auth();
    db = mock.firestore();
    window.firebase = mock;
    SystemState.isCloudActive = false;
}

document.addEventListener('DOMContentLoaded', function () {
    // UI Elements - Auth
    const authSection = document.getElementById('authSection');
    const protectedContent = document.getElementById('protectedContent');
    const loginTabBtn = document.getElementById('loginTabBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    const nameField = document.getElementById('nameField');
    const nameInput = document.getElementById('nameInput');
    const authSubtitle = document.getElementById('authSubtitle');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const primaryAuthBtn = document.getElementById('primaryAuthBtn');
    const toggleSignup = document.getElementById('toggleSignup');

    const adminTab = document.getElementById('adminTab');
    const adminSection = document.getElementById('adminSection');

    let isSignup = false;

    // --- System Boot Status ---
    if (SystemState.isCloudActive) {
        SystemState.updateStatus("Cloud Online", "online");
    } else {
        SystemState.updateStatus("Ready for Demo", "online"); // Smoother message as requested
    }

    // Monitor Auth State
    if (auth) {
        auth.onAuthStateChanged(user => {
            if (user) {
                console.log("User logged in:", user.email || user.phoneNumber);
                authSection.classList.add('hidden');
                protectedContent.classList.remove('hidden');
                logoutBtn.classList.remove('hidden');
                loginTabBtn.classList.add('hidden');
                document.getElementById('displayUser').textContent = `User: ${user.email || user.phoneNumber}`;

                // Admin Check: Emails containing 'admin' get access
                if (user.email && user.email.toLowerCase().includes('admin')) {
                    document.getElementById('adminTab').classList.remove('hidden');
                } else {
                    document.getElementById('adminTab').classList.add('hidden');
                }

                loadHistory();
            } else {
                authSection.classList.remove('hidden');
                protectedContent.classList.add('hidden');
                logoutBtn.classList.add('hidden');
                loginTabBtn.classList.remove('hidden');
                document.getElementById('adminTab').classList.add('hidden');
            }
        });
    }

    // Updated Registration Toggle
    toggleSignup?.addEventListener('click', (e) => {
        e.preventDefault();
        isSignup = !isSignup;

        // Update UI for Registration vs Login
        document.getElementById('authTitle').textContent = isSignup ? "Join ResumeScan Pro" : "Welcome Back";
        authSubtitle.textContent = isSignup ? "Create your account to start analyzing" : "Please enter your details to continue";
        primaryAuthBtn.textContent = isSignup ? "Create Account" : "Sign In";
        toggleSignup.textContent = isSignup ? "Login here" : "Register Now";

        // Toggle Name Field visibility
        if (isSignup) {
            nameField.classList.remove('hidden');
        } else {
            nameField.classList.add('hidden');
        }
    });

    // Email/Password Auth
    primaryAuthBtn?.addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        const fullName = nameInput.value;

        if (!email || !password) return showToast("Please enter both email and password");
        if (isSignup && !fullName) return showToast("Please enter your full name");

        try {
            if (isSignup) {
                // Mock or Real Firestore call for name would happen here
                await auth.createUserWithEmailAndPassword(email, password);
                console.log("Registered:", fullName);
            } else {
                await auth.signInWithEmailAndPassword(email, password);
            }
        } catch (err) {
            showToast(err.message);
        }
    });

    // Removed Phone Auth Listeners for cleaner code 

    logoutBtn?.addEventListener('click', () => auth && auth.signOut());

    // --- Tab & Scanner Elements ---
    const scannerTab = document.getElementById('scannerTab');
    const historyTab = document.getElementById('historyTab');
    const scanWorkspace = document.querySelector('.scan-workspace');
    const heroSection = document.querySelector('.hero-section');
    const historySection = document.getElementById('historySection');

    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    }

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const resumeTextArea = document.getElementById('resumeText');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const customToggle = document.getElementById('customToggle');

    // Tab Switching
    scannerTab.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveTab(scannerTab, scanWorkspace);
        heroSection.style.display = 'block';
        historySection.classList.add('hidden');
    });

    historyTab.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveTab(historyTab, historySection);
        loadHistory();
    });

    adminTab?.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveTab(adminTab, adminSection);
        loadAdminDashboard();
    });

    function setActiveTab(tab, section) {
        document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
        tab.classList.add('active');
        // Hide all major sections
        [scanWorkspace, heroSection, historySection, adminSection].forEach(s => {
            if (s) {
                s.classList.add('hidden');
                if (s === heroSection) s.style.display = 'none';
            }
        });
        // Show current
        section.classList.remove('hidden');
        if (section === scanWorkspace) heroSection.style.display = 'block';
    }

    // Scanner logic
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFile);

    async function handleFile(e) {
        const file = e.target.files[0];
        if (!file || file.type !== 'application/pdf') {
            showToast("Please upload a PDF.");
            return;
        }

        fileNameDisplay.textContent = `Selected: ${file.name}`;
        try {
            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<span>Extracting...</span>';
            const text = await extractTextFromPDF(file);
            resumeTextArea.value = text.trim();
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<span>Analyze Resume</span>';
        } catch (err) {
            showToast("Error reading PDF.");
            analyzeBtn.disabled = false;
        }
    }

    async function extractTextFromPDF(file) {
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = async function () {
                const typedarray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    fullText += content.items.map(item => item.str).join(" ") + " ";
                }
                resolve(fullText);
            };
            reader.readAsArrayBuffer(file);
        });
    }

    customToggle.addEventListener('change', function (e) {
        document.getElementById('roleSelectWrapper').classList.toggle('hidden', e.target.checked);
        document.getElementById('customDescWrapper').classList.toggle('hidden', !e.target.checked);
    });

    analyzeBtn.addEventListener('click', async function () {
        const resumeText = resumeTextArea.value;
        const jobRole = document.getElementById('jobRole').value;
        const isCustom = customToggle.checked;
        const customJD = document.getElementById('customJobDesc').value;

        if (resumeText.length < 20) {
            showToast("Please provide resume text.");
            return;
        }

        if (!isCustom && !jobRole) {
            showToast("Please select a job role.");
            return;
        }

        try {
            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<span>Analyzing...</span>';

            let finalResult = null;

            // Try Backend Analysis first
            try {
                const response = await fetch(`${BACKEND_URL}/analyze`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        resume_text: resumeText,
                        job_role: jobRole,
                        custom_jd: customJD,
                        is_custom: isCustom
                    })
                });

                if (response.ok) {
                    finalResult = await response.json();
                }
            } catch (backendErr) {
                console.log("Backend offline, switching to Local Analysis Mode");
            }

            // Fallback: Local Analysis if backend failed
            if (!finalResult) {
                console.log("Using Local Analysis Engine...");
                finalResult = analyzeLocally(resumeText, jobRole, customJD, isCustom);
            }

            // Ensure result is well-formed
            if (!finalResult || typeof finalResult.score === 'undefined') {
                throw new Error("Analysis generated invalid data.");
            }

            // Update UI with result (Score, Job Title, Matched, Missing)
            updateUI(
                finalResult.score || 0,
                finalResult.job_title || "Unknown Role",
                finalResult.matched || [],
                finalResult.missing || []
            );

            // Save to History (Cloud or Local)
            if (auth && auth.currentUser) {
                const user = auth.currentUser;
                const scanData = {
                    ...finalResult,
                    userId: user.uid,
                    userRef: user.email || user.phoneNumber,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    matched_count: (finalResult.matched || []).length,
                    missing_count: (finalResult.missing || []).length
                };

                if (SystemState.isOnline && SystemState.isCloudActive) {
                    db.collection("scans").add(scanData).catch(e => SystemState.queueForSync(scanData));
                } else {
                    SystemState.queueForSync(scanData);
                }
            } else {
                const localHistory = JSON.parse(localStorage.getItem('scans_history') || '[]');
                localHistory.unshift({ ...finalResult, timestamp: new Date().toISOString() });
                localStorage.setItem('scans_history', JSON.stringify(localHistory.slice(0, 50)));
            }

        } catch (err) {
            console.error("General Error:", err);
            showToast("Analysis failed. Please try again.");
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<span>Analyze Resume</span>';
        }
    });

    function analyzeLocally(text, roleKey, customJD, isCustom) {
        let target = isCustom ? { title: "Custom Role", must_have: [], important: [], optional: [] } : JOB_DATA[roleKey];
        if (isCustom) {
            // Simple keyword extraction for custom JDs
            const tech = ["java", "react", "python", "sql", "javascript", "aws", "docker", "node.js", "typescript"];
            tech.forEach(s => { if (customJD.toLowerCase().includes(s)) target.important.push(s); });
        }

        let tw = 0, mw = 0;
        const matched = [], missing = [];
        const process = (keywords, weight) => {
            (keywords || []).forEach(kw => {
                tw += weight;
                if (new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi').test(text)) {
                    mw += weight;
                    matched.push({ name: kw, level: weight });
                } else {
                    missing.push({ name: kw, level: weight });
                }
            });
        };

        process(target.must_have, 3);
        process(target.important, 2);
        process(target.optional, 1);

        const score = tw > 0 ? Math.round((mw / tw) * 100) : 0;
        return { score, job_title: target.title, matched, missing, verdict: score >= 70 ? "STRONG" : (score >= 40 ? "MEDIUM" : "POOR") };
    }

    function updateUI(score, jobTitle, matched, missing) {
        const resultsArea = document.getElementById('resultsArea');
        if (!resultsArea) return;

        resultsArea.classList.remove('hidden');
        resultsArea.scrollIntoView({ behavior: 'smooth' });

        // Update Score Circular Progress
        const scorePath = document.getElementById('scorePath');
        const scoreValue = document.getElementById('scoreValue');
        if (scorePath) scorePath.setAttribute('stroke-dasharray', `${score}, 100`);
        if (scoreValue) scoreValue.textContent = `${score}%`;

        // Update Verdict Badge
        const badge = document.getElementById('verdictBadge');
        if (badge) {
            badge.textContent = score >= 70 ? "STRONG MATCH" : (score >= 40 ? "MEDIUM MATCH" : "POOR MATCH");
            badge.className = "verdict-badge " + (score >= 70 ? "verdict-qualified" : (score >= 40 ? "verdict-weak" : "verdict-unqualified"));
        }

        // Helper to handle String vs Object in keyword arrays
        const getKWName = (kw) => (typeof kw === 'object' ? kw.name : kw);
        const getKWLevel = (kw) => (typeof kw === 'object' ? kw.level : 2);

        // Update Keyword Badges
        document.getElementById('matchedKeywords').innerHTML = (matched || []).map(kw =>
            `<span class="keyword-badge">${getKWName(kw)}</span>`).join('');

        document.getElementById('missingKeywords').innerHTML = (missing || []).map(kw =>
            `<span class="keyword-badge ${getKWLevel(kw) === 3 ? 'must-have' : ''}">${getKWName(kw)}</span>`).join('');

        // Generate Human-Readable Insights
        const coreMissingNames = (missing || [])
            .filter(m => typeof m === 'object' ? m.level === 3 : false)
            .map(m => m.name);

        document.getElementById('insightsList').innerHTML = coreMissingNames.length > 0
            ? `<li><b>Critical Gaps:</b> You are missing core skills for this role: ${coreMissingNames.join(', ')}.</li>`
            : `<li><b>Great Job!</b> Your resume covers the essential skills for this position.</li>`;

        const timeDisplay = document.getElementById('displayTime');
        if (timeDisplay) timeDisplay.textContent = "Time: " + new Date().toLocaleTimeString();
    }

    async function loadHistory() {
        if (!auth || !auth.currentUser) return;

        const historyList = document.getElementById('historyList');
        const placeholder = document.getElementById('historyPlaceholder');
        const user = auth.currentUser;

        // --- SELF-HEALING: Load from Cache first for zero-latency ---
        const cachedData = SystemState.getFromLocal('user_history_' + user.uid);
        if (cachedData) {
            SystemState.updateStatus("Syncing Cloud...", "sync");
            renderHistory(cachedData);
        } else {
            historyList.innerHTML = '<div class="glass" style="padding: 2rem; width: 100%; text-align: center;">Fetching your history...</div>';
        }

        placeholder.classList.add('hidden');

        try {
            if (db) {
                const snapshot = await db.collection("scans")
                    .where("userId", "==", user.uid)
                    .orderBy("timestamp", "desc")
                    .limit(20)
                    .get();

                if (snapshot.empty) {
                    if (!cachedData) {
                        historyList.innerHTML = '';
                        placeholder.classList.remove('hidden');
                        placeholder.innerHTML = `<p>Welcome, ${user.email || user.phoneNumber}! Your history is empty.</p>`;
                    }
                    return;
                }

                const history = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

                // Update Cache & UI
                SystemState.cacheToLocal('user_history_' + user.uid, history);
                renderHistory(history);
                SystemState.updateStatus(SystemState.isCloudActive ? "Cloud Online" : "Virtual Cloud", "online");

            }
        } catch (e) {
            console.error("Error loading user history:", e);
            if (!cachedData) {
                historyList.innerHTML = `<div class="card glass" style="color: var(--error)">Could not load cloud history. Showing offline data.</div>`;
            }
            SystemState.updateStatus("Offline Mode", "offline");
        }
    }

    function renderHistory(history) {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';
        history.forEach(data => {
            let dateStr = "Recent";
            if (data.timestamp) {
                // Handle different timestamp formats (Backend string vs Firebase Timestamp object)
                dateStr = data.timestamp.toDate ? data.timestamp.toDate().toLocaleString() : new Date(data.timestamp).toLocaleString();
            }

            const card = document.createElement('div');
            card.className = 'history-card glass';

            // Construct matched/missing badges (Handle both string and object formats for robustness)
            const matchedHtml = (data.matched || []).slice(0, 5).map(m => {
                const name = typeof m === 'object' ? m.name : m;
                return `<span class="tag matched">${name}</span>`;
            }).join('');

            const missingHtml = (data.missing || []).slice(0, 5).map(m => {
                const name = typeof m === 'object' ? m.name : m;
                return `<span class="tag missing">${name}</span>`;
            }).join('');

            card.innerHTML = `
                <div class="history-card-header">
                    <span class="history-role">${data.job_title}</span>
                    <span class="history-score">${data.score}%</span>
                </div>
                <div class="history-date">${dateStr}</div>
                <div class="verdict-wrapper">
                    <div class="verdict-badge ${data.score >= 70 ? 'verdict-qualified' : (data.score >= 40 ? 'verdict-weak' : 'verdict-unqualified')}">
                        ${data.verdict || 'ANALYZED'}
                    </div>
                </div>
                <div class="history-keywords">
                    <div class="kw-row"><strong>Top Matches:</strong> ${matchedHtml}${data.matched && data.matched.length > 5 ? '...' : ''}</div>
                    <div class="kw-row"><strong>Key Gaps:</strong> ${missingHtml}${data.missing && data.missing.length > 5 ? '...' : ''}</div>
                </div>
            `;
            historyList.appendChild(card);
        });
    }

    async function loadAdminDashboard() {
        if (!db) return;
        const scanList = document.getElementById('adminScanList');

        try {
            // Fetch global scans (admin privileges required in Firestore rules)
            const snap = await db.collection("scans").orderBy("timestamp", "desc").limit(100).get();
            const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));

            // Stats Calculation
            const totalScans = docs.length;
            const uniqueUsers = new Set(docs.map(d => d.userId)).size;
            const avgScore = totalScans > 0 ? Math.round(docs.reduce((acc, d) => acc + (d.score || 0), 0) / totalScans) : 0;

            document.getElementById('statTotalScans').textContent = totalScans;
            document.getElementById('statTotalUsers').textContent = uniqueUsers;
            document.getElementById('statAvgScore').textContent = avgScore + "%";

            // Populate Table
            scanList.innerHTML = `<div class="admin-feed-item" style="font-weight: bold; border-bottom: 2px solid var(--primary); background: rgba(99,102,241,0.1)">
                <span>User Account</span>
                <span>Role Targeted</span>
                <span>Score</span>
                <span>Verdict</span>
            </div>`;

            if (docs.length === 0) {
                scanList.innerHTML += `<div class="loading-state">No global scans recorded yet.</div>`;
                return;
            }

            scanList.innerHTML += docs.map(d => `
                <div class="admin-feed-item">
                    <span class="admin-user">${d.userRef || 'Anonymous User'}</span>
                    <span>${d.job_title || 'Unknown'}</span>
                    <span style="color: var(--primary); font-weight: bold">${d.score}%</span>
                    <span class="tag ${d.score >= 70 ? 'matched' : (d.score >= 40 ? 'weak' : 'missing')}">
                        ${d.score >= 70 ? 'STRONG' : (d.score >= 40 ? 'MEDIUM' : 'POOR')}
                    </span>
                </div>
            `).join('');

        } catch (e) {
            console.error("Admin Dashboard Fetch Error:", e);
            scanList.innerHTML = `<div class="loading-state" style="color: var(--error)">
                <strong>Permission Denied.</strong> <br>
                Only designated administrators can view the global feed.
            </div>`;
        }
    }
});
