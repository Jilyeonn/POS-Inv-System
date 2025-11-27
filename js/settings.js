import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {getAuth, onAuthStateChanged, signOut} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {getDatabase, ref, push, onValue} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBoZdu6XiF70_x3HwJttP6e639h-5IKWsE",
  authDomain: "vht-naturals.firebaseapp.com",
  databaseURL: "https://vht-naturals-default-rtdb.firebaseio.com",
  projectId: "vht-naturals",
  storageBucket: "vht-naturals.firebasestorage.app",
  messagingSenderId: "436056260553",
  appId: "1:436056260553:web:22b7bab3c602522c26f218"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ============================================================
// ===============      ACTIVITY LOGGER     ===================
// ============================================================
function logActivity(action, details = "") {
  const logsRef = ref(db, "systemLogs");
  const user = auth.currentUser;
  
  // Define options for Philippine Standard Time (PST, UTC+8)
  const options = {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false // Use 24-hour format
  };
  
  // Generate the Manila time string
  const manilaTimestamp = new Date().toLocaleString('en-PH', options);

  const logData = {
    userId: user?.uid || "Unknown",
    email: user?.email || "Unknown",
    action,
    details,
    // Store the formatted Manila time string
    timestamp: manilaTimestamp 
  };

  return push(logsRef, logData);
}

// ============================================================
// ===============   AUTH STATE LISTENER   ====================
// ============================================================
let currentUserEmail = "";
const LOGGED_IN_FLAG_KEY = "freshLogin";

onAuthStateChanged(auth, async (user) => {
  const userSection = document.getElementById("userSection");
  const actionSection = document.getElementById("actionSection");
  const userEmail = document.getElementById("userEmail");


    document.getElementById("userEmail").textContent = user.email;
    document.getElementById("userSection").classList.remove("hidden");

  if (sessionStorage.getItem(LOGGED_IN_FLAG_KEY) === 'true') {

            try {
              
                await logActivity("Login", `User logged in: ${user.email}`);
                console.log("Activity Log: Login successfully recorded.");

            } catch (error) {
                console.error("Activity Log Failed:", error);
            }
            sessionStorage.removeItem(LOGGED_IN_FLAG_KEY);

        } else {
            console.log("User is authenticated, but skipping 'Login' log (already logged or page refresh).");
        }
});


document.getElementById("logoutBtn").addEventListener("click", async () => {
  const user = auth.currentUser;

  if (user) {
    await logActivity("Logout", `User logged out: ${user.email}`);
  }

  await signOut(auth);
  window.location.href = "login.html";
});


const logsTableBody = document.getElementById("logsTableBody");
const logsRef = ref(db, "systemLogs");
const emailSearchInput = document.getElementById("emailSearchInput"); 

// ✅ NEW: Variable to cache the latest full snapshot data
let fullLogsSnapshot = null; 


/**
 * Renders the logs table based on the given snapshot data and current search query.
 * @param {Object} snapshot - The Firebase DataSnapshot containing all system logs.
 */
const renderLogs = (snapshot) => {
    // Determine the current search query
    const searchQuery = (emailSearchInput?.value || "").toLowerCase().trim();
    
    logsTableBody.innerHTML = "";

    if (!snapshot || !snapshot.exists()) {
        logsTableBody.innerHTML =
            `<tr><td colspan="4" style="text-align:center;">No logs</td></tr>`;
        return;
    }

    // Collect all logs into an array
    let logsArray = [];
    snapshot.forEach((child) => {
        logsArray.push(child.val());
    });

    // ✅ FILTER STEP: Filter the array based on the userEmail
    if (searchQuery) {
        logsArray = logsArray.filter(log => {
            const email = (log.email || "").toLowerCase();
            return email.includes(searchQuery);
        });
    }

    // If, after filtering, no logs remain
    if (logsArray.length === 0) {
         logsTableBody.innerHTML =
            `<tr><td colspan="4" style="text-align:center;">No matching logs found for "${searchQuery}"</td></tr>`;
        return;
    }

    // Reverse array so newest is first
    logsArray.reverse();

    // Display logs
    logsArray.forEach((log) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${log.timestamp}</td>
            <td>${log.email}</td>
            <td>${log.action}</td>
            <td>${log.details}</td>
        `;
        logsTableBody.appendChild(tr);
    });
};


// 1. The primary listener: Fetches data and updates the cache.
onValue(logsRef, (snapshot) => {
    // 💾 Cache the snapshot every time the data changes
    fullLogsSnapshot = snapshot; 
    
    // Always render the logs immediately after a change
    renderLogs(fullLogsSnapshot);
});


// 2. The search input listener: Triggers filtering on the cached data.
if (emailSearchInput) {
    emailSearchInput.addEventListener("input", () => {
        // Only attempt to render if we have data cached
        if (fullLogsSnapshot) {
            renderLogs(fullLogsSnapshot);
        }
    });
}
