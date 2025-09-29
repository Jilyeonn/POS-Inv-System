// /js/charts.js  (ES module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getFirestore, setDoc, doc} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js"
// --- Firebase config ---
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
const db = getDatabase(app);

document.addEventListener("DOMContentLoaded", () => {
  const pie1El = document.getElementById("pieChart1");
  const lineEl = document.getElementById("lineChart");
  const pie2El = document.getElementById("pieChart2");

  const colorForIndex = (i, total) => {
    const hue = Math.round((i / Math.max(1, total)) * 360);
    return `hsl(${hue} 65% 50%)`;
  };

  // --- Create charts ---
  const pie1 = new Chart(pie1El, {
    type: "pie",
    data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
    options: { responsive: true }
  });

  const line = new Chart(lineEl, {
    type: "line",
    data: { labels: [], datasets: [{
      label: "Resupplies (this month)",
      data: [],
      borderColor: "#407257",
      backgroundColor: "rgba(64,114,87,0.15)",
      fill: true,
      tension: 0.3
    }]},
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            callback: (val) => Number.isInteger(val) ? val : null
          }
        },
        x: {
          title: { display: true, text: "Date" },
          ticks: {
            callback: function(value) {
              const label = this.getLabelForValue(value);
              return `${new Date().toLocaleString("default", { month: "short" })} ${label}`;
            }
          }
        }
      }
    }
  });

  const pie2 = new Chart(pie2El, {
    type: "pie",
    data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
    options: { responsive: true }
  });

  // --- Listen to inventory for pie charts ---
  const inventoryRef = ref(db, "inventory");
  onValue(inventoryRef, (snapshot) => {
    const data = snapshot.val() || {};

    const supplyLabels = [];
    const supplyQuantities = [];
    const categoryTotals = {};

    Object.values(data).forEach((item) => {
      const name = item.item ?? item.name ?? "Unknown";
      const qty = Number(item.quantity ?? item.qty ?? 0) || 0;
      const cat = item.category ?? "Uncategorized";

      supplyLabels.push(name);
      supplyQuantities.push(qty);
      categoryTotals[cat] = (categoryTotals[cat] || 0) + qty;
    });

    // update pie1
    pie1.data.labels = supplyLabels;
    pie1.data.datasets[0].data = supplyQuantities;
    pie1.data.datasets[0].backgroundColor = supplyLabels.map((_, i) => colorForIndex(i, supplyLabels.length));
    pie1.update();

    // update pie2
    const catLabels = Object.keys(categoryTotals);
    const catValues = Object.values(categoryTotals);
    pie2.data.labels = catLabels;
    pie2.data.datasets[0].data = catValues;
    pie2.data.datasets[0].backgroundColor = catLabels.map((_, i) => colorForIndex(i, catLabels.length));
    pie2.update();
  });

// --- Listen to resupplies for line chart ---
const resuppliesRef = ref(db, "resupplies");
onValue(resuppliesRef, (snapshot) => {
  const data = snapshot.val() || {};
  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();
  const today = now.getDate(); // ✅ only up to today
  const dailyCounts = Array.from({ length: today }, () => 0);

  Object.values(data).forEach((entry) => {
    const dateStr = entry.date ?? entry.resuppliedAt ?? entry.timestamp;
    if (!dateStr) return;

    const d = new Date(dateStr);
    if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
      const day = d.getDate();
      if (day <= today) {
        dailyCounts[day - 1] = (dailyCounts[day - 1] || 0) + 1;
      }
    }
  });

  const dayLabels = Array.from({ length: today }, (_, i) => `${i + 1}`);

  line.data.labels = dayLabels;
  line.data.datasets[0].data = dailyCounts;
  line.options.plugins = {
    tooltip: {
      callbacks: {
        title: (tooltipItems) => {
          const item = tooltipItems[0];
          const day = parseInt(item.label, 10);
          const dateObj = new Date(curYear, curMonth, day);
          return dateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          });
        }
      }
    }
  };
  line.update();
});
});
