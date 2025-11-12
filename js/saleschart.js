import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onChildAdded, onChildChanged, onChildRemoved, get, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

// ---------- Config ----------
const SALES_NODE = "sales";
const PRODUCTS_NODE = "products";
const DAYS_TO_SHOW = 30;

let productCategoryMap = {};
let salesList = {};
let salesByDay = {};
let productTotals = {};
let categoryTotals = {};
let currentPeriod = "monthly";

// ---------- DOM ----------
const lastUpdatedEl = document.getElementById('lastUpdated');
const totalTodayEl = document.getElementById('totalToday');
const totalMonthEl = document.getElementById('totalMonth');
const ordersTodayEl = document.getElementById('ordersToday');
const avgTicketEl = document.getElementById('avgTicket');
const transactionTbody = document.querySelector('#transactionHistory tbody');

// ---------- Chart instances ----------
let lineChart, barChart, pieChart;

// ---------- Helpers ----------
function formatCurrency(num) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(num || 0);
}

function dateKey(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

function buildDaysArray(n) {
  const arr = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    arr.push(dateKey(d.getTime()));
  }
  return arr;
}

function ensureDayExists(key) {
  if (!salesByDay[key]) salesByDay[key] = 0;
}

// ---------- Generate Order Number ----------
function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${y}${m}${d}-${rand}`;
}

// ---------- Create Charts ----------
function createCharts() {
  const ctxLine = document.getElementById('lineSales').getContext('2d');
  lineChart = new Chart(ctxLine, {
    type: 'line',
    data: {
      labels: buildDaysArray(DAYS_TO_SHOW),
      datasets: [{
        label: 'Daily Sales',
        data: Array(DAYS_TO_SHOW).fill(0),
        tension: 0.3,
        fill: true,
        borderWidth: 2,
        pointRadius: 3,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { maxRotation: 0 } }, y: { beginAtZero: true } }
    }
  });

  const ctxBar = document.getElementById('barProducts').getContext('2d');
  barChart = new Chart(ctxBar, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Revenue', data: [], borderRadius: 6 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  const ctxPie = document.getElementById('pieCategories').getContext('2d');
  pieChart = new Chart(ctxPie, {
    type: 'pie',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [],
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: 'Category Sales Distribution' }
      }
    }
  });
}

// ---------- Recalculate & Render ----------
function recalcAggregatesAndRender() {
  salesByDay = {};
  productTotals = {};
  categoryTotals = {};
  let totalAll = 0;
  let totalCount = 0;

  for (const id in salesList) {
    const sale = salesList[id];
    const tKey = dateKey(sale.timestamp);
    ensureDayExists(tKey);
    const saleTotal = Number(sale.total) || computeSaleTotalFromItems(sale.items);
    salesByDay[tKey] += saleTotal;
    totalAll += saleTotal;
    totalCount++;

    if (Array.isArray(sale.items)) {
      for (const it of sale.items) {
        const pid = it.productId || it.id || `unknown-${it.name}`;
        const name = it.name || 'Unknown';
        const qty = Number(it.quantity || 1);
        const price = Number(it.price || 0);
        const revenue = price * qty;
        if (!productTotals[pid]) productTotals[pid] = { name, revenue: 0, qty: 0 };
        productTotals[pid].revenue += revenue;
        productTotals[pid].qty += qty;

        const category = it.category || productCategoryMap[pid] || 'Uncategorized';
        if (!categoryTotals[category]) categoryTotals[category] = 0;
        categoryTotals[category] += revenue;
      }
    }
  }

  // Cards
  const todayKey = dateKey(Date.now());
  const monthStart = new Date(); monthStart.setDate(1);
  const monthStartKey = dateKey(monthStart.getTime());
  let totalToday = salesByDay[todayKey] || 0;
  let totalMonth = 0;
  for (const k in salesByDay) if (k >= monthStartKey) totalMonth += salesByDay[k];

  totalTodayEl.textContent = formatCurrency(totalToday);
  totalMonthEl.textContent = formatCurrency(totalMonth);
  ordersTodayEl.textContent = Object.values(salesList).filter(s => dateKey(s.timestamp) === todayKey).length;
  avgTicketEl.textContent = totalCount ? formatCurrency(totalAll / totalCount) : formatCurrency(0);

  // Charts update
  const days = buildDaysArray(currentPeriod === 'weekly' ? 7 : 30);
  const labels = days.map(d => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  const dataPoints = days.map(d => salesByDay[d] || 0);
  lineChart.data.labels = labels;
  lineChart.data.datasets[0].data = dataPoints;
  lineChart.update();

  const topProducts = Object.entries(productTotals)
    .map(([id, v]) => ({ name: v.name, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
  barChart.data.labels = topProducts.map(p => p.name);
  barChart.data.datasets[0].data = topProducts.map(p => p.revenue);
  barChart.update();

  const categories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const labelsPie = categories.map(c => c[0]);
  const dataPie = categories.map(c => c[1]);
  const colors = labelsPie.map((_, i) => `hsl(${(i * 360 / labelsPie.length) % 360}, 70%, 60%)`);
  pieChart.data.labels = labelsPie;
  pieChart.data.datasets[0].data = dataPie;
  pieChart.data.datasets[0].backgroundColor = colors;
  pieChart.update();

  // ✅ Transaction History Table (Recent 5)
  if (transactionTbody) {
    const recentTransactions = Object.values(salesList)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);

    transactionTbody.innerHTML = '';
    if (recentTransactions.length > 0) {
      recentTransactions.forEach(tx => {
        const itemsHTML = tx.items
          ? tx.items.map(it => `${it.name} x${it.quantity}`).join('<br>')
          : '—';

        const row = `
          <tr>
            <td>${tx.txnID || '—'}</td>
            <td>${new Date(tx.timestamp).toLocaleString()}</td>
            <td>${itemsHTML}</td>
            <td>${formatCurrency(tx.total || computeSaleTotalFromItems(tx.items))}</td>
            <td>${formatCurrency(tx.cashGiven || 0)}</td>
            <td>${formatCurrency(tx.change || 0)}</td>
          </tr>`;
        transactionTbody.innerHTML += row;
      });
    } else {
      transactionTbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No recent transactions</td></tr>`;
    }
  }

  lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleString()}`;
}

// ---------- Utilities ----------
function computeSaleTotalFromItems(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((acc, it) =>
    acc + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
}

// ---------- Realtime ----------
function startRealtimeListeners() {
  const salesRef = ref(db, SALES_NODE);

  get(salesRef).then(snapshot => {
    const val = snapshot.val() || {};
    for (const id in val) {
      const s = val[id];
      s.id = s.id || id;
      s.timestamp = Number(s.timestamp) || Date.now();

      // ✅ Ensure txnID exists
      if (!s.txnID) {
        s.txnID = generateOrderNumber();
        update(ref(db, `${SALES_NODE}/${id}`), { txnID: s.txnID });
      }

      salesList[id] = s;
    }
    recalcAggregatesAndRender();
  });

  onChildAdded(salesRef, snap => {
    const s = snap.val();
    s.id = snap.key;
    s.timestamp = Number(s.timestamp) || Date.now();

    if (!s.txnID) {
      s.txnID = generateOrderNumber();
      update(ref(db, `${SALES_NODE}/${snap.key}`), { txnID: s.txnID });
    }

    salesList[snap.key] = s;
    recalcAggregatesAndRender();
  });

  onChildChanged(salesRef, snap => {
    const s = snap.val();
    s.id = snap.key;
    s.timestamp = Number(s.timestamp) || Date.now();
    salesList[snap.key] = s;
    recalcAggregatesAndRender();
  });

  onChildRemoved(salesRef, snap => {
    delete salesList[snap.key];
    recalcAggregatesAndRender();
  });
}

// ---------- Boot ----------
async function boot() {
  await loadProductCategories();
  createCharts();
  startRealtimeListeners();
}

boot();

document.getElementById('salesPeriodSelect').addEventListener('change', (e) => {
  currentPeriod = e.target.value;
  recalcAggregatesAndRender();
});

async function loadProductCategories() {
  const productsRef = ref(db, PRODUCTS_NODE);
  try {
    const snapshot = await get(productsRef);
    const products = snapshot.val() || {};
    for (const pid in products) {
      const p = products[pid];
      if (p.category) productCategoryMap[pid] = p.category;
    }
    console.log("✅ Product categories loaded:", productCategoryMap);
  } catch (err) {
    console.error("Error loading product categories:", err);
  }
}
