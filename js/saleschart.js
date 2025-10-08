import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onChildAdded, onChildChanged, onChildRemoved, get, query, orderByChild } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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
  
const SALES_NODE = "sales"; // change if your PoS writes sales to another path
const DAYS_TO_SHOW = 30;
const DATE_OPTIONS = { year: 'numeric', month: 'short', day: 'numeric' };

// ---------- DOM elements ----------
const lastUpdatedEl = document.getElementById('lastUpdated');
const totalTodayEl = document.getElementById('totalToday');
const totalMonthEl = document.getElementById('totalMonth');
const ordersTodayEl = document.getElementById('ordersToday');
const avgTicketEl = document.getElementById('avgTicket');
const recentTbody = document.querySelector('#recentTable tbody');

// ---------- In-memory aggregates ----------
let salesList = {}; // saleId -> sale object
let salesByDay = {}; // 'YYYY-MM-DD' -> total
let productTotals = {}; // productId -> {name, revenue, qty}
let categoryTotals = {}; // category -> revenue

// ---------- Chart instances ----------
let lineChart, barChart, pieChart;

function formatCurrency(num) {
  // local currency format (Philippines peso)
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(num);
}

function dateKey(ts) {
  const d = new Date(ts);
  // YYYY-MM-DD
  return d.toISOString().slice(0,10);
}

// initialize empty arrays for last N days
function buildDaysArray(n) {
  const arr = [];
  const today = new Date();
  for (let i = n-1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    arr.push(dateKey(d.getTime()));
  }
  return arr;
}

function ensureDayExists(key) {
  if (!salesByDay[key]) salesByDay[key] = 0;
}

// ---------- Chart setup ----------
function createCharts() {
  // Line - sales over time
  const ctxLine = document.getElementById('lineSales').getContext('2d');
  lineChart = new Chart(ctxLine, {
    type: 'line',
    data: {
      labels: buildDaysArray(DAYS_TO_SHOW),
      datasets: [{
        label: 'Daily sales',
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

  // Bar - top products
  const ctxBar = document.getElementById('barProducts').getContext('2d');
  barChart = new Chart(ctxBar, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Revenue', data: [], borderRadius: 6 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  // Pie - categories
  const ctxPie = document.getElementById('pieCategories').getContext('2d');
  pieChart = new Chart(ctxPie, {
    type: 'pie',
    data: { labels: [], datasets: [{ data: [] }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

// ---------- Update visual aggregates & UI ----------
function recalcAggregatesAndRender() {
  // reset
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

    // items
    if (Array.isArray(sale.items)) {
      for (const it of sale.items) {
        const pid = it.productId || it.id || it.product || `unknown-${it.name}`;
        const name = it.name || it.productName || 'Unknown';
        const qty = Number(it.quantity || it.qty || 1);
        const price = Number(it.price || it.unitPrice || 0);
        const revenue = price * qty;
        if (!productTotals[pid]) productTotals[pid] = { name, revenue: 0, qty: 0 };
        productTotals[pid].revenue += revenue;
        productTotals[pid].qty += qty;

        const category = it.category || 'Uncategorized';
        if (!categoryTotals[category]) categoryTotals[category] = 0;
        categoryTotals[category] += revenue;
      }
    }
  }

  // Update summary cards
  const todayKey = dateKey(Date.now());
  const monthStart = new Date(); monthStart.setDate(1);
  const monthStartKey = dateKey(monthStart.getTime());
  let totalToday = salesByDay[todayKey] || 0;
  // month total = sum of day keys >= month start
  let totalMonth = 0;
  for (const k in salesByDay) if (k >= monthStartKey) totalMonth += salesByDay[k];

  totalTodayEl.textContent = formatCurrency(totalToday);
  totalMonthEl.textContent = formatCurrency(totalMonth);
  ordersTodayEl.textContent = Object.values(salesList).filter(s => dateKey(s.timestamp) === todayKey).length;
  avgTicketEl.textContent = totalCount ? formatCurrency(totalAll / totalCount) : formatCurrency(0);

  // Update line chart (last N days)
  const days = buildDaysArray(DAYS_TO_SHOW);
  const lineData = days.map(d => salesByDay[d] || 0);
  lineChart.data.labels = days.map(l => new Date(l).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  lineChart.data.datasets[0].data = lineData;
  lineChart.update();

  // Update bar chart (top products by revenue)
  const topProducts = Object.entries(productTotals)
    .map(([id, v]) => ({ id, name: v.name, revenue: v.revenue, qty: v.qty }))
    .sort((a,b) => b.revenue - a.revenue)
    .slice(0, 8);
  barChart.data.labels = topProducts.map(p => p.name);
  barChart.data.datasets[0].data = topProducts.map(p => p.revenue);
  barChart.update();

  // Update pie chart categories
  const categories = Object.entries(categoryTotals).map(([name, revenue]) => ({ name, revenue })).sort((a,b)=>b.revenue-a.revenue);
  pieChart.data.labels = categories.map(c => c.name);
  pieChart.data.datasets[0].data = categories.map(c => c.revenue);
  pieChart.update();

  // Update recent transactions table (sort by timestamp desc)
  const recent = Object.values(salesList).sort((a,b)=>b.timestamp - a.timestamp).slice(0,10);
  recentTbody.innerHTML = '';
  for (const s of recent) {
    const tr = document.createElement('tr');
    const time = new Date(s.timestamp).toLocaleString();
    const itemsText = (s.items || []).map(it => `${it.name || it.productName || 'Item'} x${it.quantity||it.qty||1}`).join(', ');
    const totalVal = Number(s.total) || computeSaleTotalFromItems(s.items);
    tr.innerHTML = `<td>${time}</td><td>${s.id || '—'}</td><td>${itemsText}</td><td>${formatCurrency(totalVal)}</td>`;
    recentTbody.appendChild(tr);
  }

  lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleString()}`;
}

function computeSaleTotalFromItems(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((acc,it) => acc + (Number(it.price || it.unitPrice || 0) * Number(it.quantity || it.qty || 1)), 0);
}

// ---------- Realtime listeners ----------
function startRealtimeListeners() {
  const salesRef = ref(db, SALES_NODE);

  // initial load: we also fetch existing data to avoid race conditions (optional)
  get(salesRef).then(snapshot => {
    const val = snapshot.val() || {};
    for (const id in val) {
      const s = val[id];
      s.id = s.id || id;
      s.timestamp = Number(s.timestamp) || Date.now();
      salesList[id] = s;
    }
    recalcAggregatesAndRender();
  }).catch(err => {
    console.error('Initial fetch error', err);
  });

  // child added
  onChildAdded(salesRef, (snap) => {
    const id = snap.key;
    const s = snap.val();
    s.id = s.id || id;
    s.timestamp = Number(s.timestamp) || Date.now();
    salesList[id] = s;
    recalcAggregatesAndRender();
  });

  // child changed
  onChildChanged(salesRef, (snap) => {
    const id = snap.key;
    const s = snap.val();
    s.id = s.id || id;
    s.timestamp = Number(s.timestamp) || Date.now();
    salesList[id] = s;
    recalcAggregatesAndRender();
  });

  // child removed
  onChildRemoved(salesRef, (snap) => {
    const id = snap.key;
    delete salesList[id];
    recalcAggregatesAndRender();
  });
}

// ---------- Boot ----------
function boot() {
  createCharts();
  startRealtimeListeners();
}

boot();

// ---------- Optional: helper to simulate a sale (for local testing) ----------
window.__simulateSale = function(sim) {
  // sim: { id, timestamp, total, items: [{productId,name,category,price,quantity}] }
  const k = sim.id || `test_${Date.now()}`;
  const path = `${SALES_NODE}/${k}`;
  const refPath = ref(db, path);
  // write with compat API
  ref(db, path).set(sim).then(()=>console.log('sim written')).catch(e=>console.error(e));
};