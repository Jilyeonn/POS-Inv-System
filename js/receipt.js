import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onChildAdded, onChildChanged, onChildRemoved, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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
const salesRef = ref(db, "sales");

window.transactions = {};
window.salesRef = salesRef;

// ================== Helpers ==================
function formatCurrency(num) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(num || 0);
}

function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${y}${m}${d}-${rand}`;
}

// ================== Render Table ==================
function renderTable(filter = "") {
  const tbody = document.getElementById("transactionBody");
  const search = filter.toLowerCase();

  const rows = Object.values(window.transactions)
    .filter((tx) => {
      const itemList = tx.items
        ? tx.items.map((it) => `${it.name} (${it.quantity})`).join(", ")
        : "";
      const cash = tx.cashGiven ? formatCurrency(tx.cashGiven) : "";
      const change = tx.change ? formatCurrency(tx.change) : "";
      const total = formatCurrency(tx.total || 0);
      const discount = tx.discountType ? `${tx.discountType} ${tx.discountId || ""}` : "";

      return (
        tx.txnID?.toLowerCase().includes(search) ||
        itemList.toLowerCase().includes(search) ||
        total.toLowerCase().includes(search) ||
        cash.toLowerCase().includes(search) ||
        change.toLowerCase().includes(search) ||
        discount.toLowerCase().includes(search) ||
        new Date(tx.timestamp).toLocaleString().toLowerCase().includes(search)
      );
    })
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((tx) => {
      const itemList = tx.items
        ? tx.items.map((it) => `${it.name} (${it.quantity})`).join(", ")
        : "—";

      const discountInfo =
        tx.discountType && tx.discountRate
          ? `${tx.discountType} (${tx.discountRate}% off)${tx.discountId ? `<br>ID: ${tx.discountId}` : ""}`
          : "—";

      return `
        <tr>
          <td>${tx.txnID || "—"}</td>
          <td>${new Date(tx.timestamp).toLocaleString()}</td>
          <td>${itemList}</td>
          <td>${formatCurrency(tx.total)}</td>
          <td>${tx.cashGiven ? formatCurrency(tx.cashGiven) : "—"}</td>
          <td>${tx.change ? formatCurrency(tx.change) : "—"}</td>
          <td>${discountInfo}</td>
        </tr>`;
    })
    .join("");

  tbody.innerHTML =
    rows ||
    `<tr><td colspan="7" style="text-align:center;">No transactions found</td></tr>`;
}

// ================== Populate Dropdowns ==================
function populateDateDropdowns() {
  const months = new Set();
  const days = new Set();
  const years = new Set();

  Object.values(window.transactions).forEach((tx) => {
    const date = new Date(tx.timestamp);
    months.add(date.getMonth() + 1);
    days.add(date.getDate());
    years.add(date.getFullYear());
  });

  const monthSelect = document.getElementById("monthSelect");
  const daySelect = document.getElementById("daySelect");
  const yearSelect = document.getElementById("yearSelect");

  const addOptions = (select, values) => {
    select.innerHTML = `<option value="">All</option>` +
      Array.from(values)
        .sort((a, b) => a - b)
        .map((v) => `<option value="${v}">${v}</option>`)
        .join("");
  };

  addOptions(monthSelect, months);
  addOptions(daySelect, days);
  addOptions(yearSelect, years);
}

// ================== Firebase Realtime Updates ==================
onChildAdded(salesRef, (snap) => {
  const sale = snap.val();
  sale.id = snap.key;
  sale.timestamp = Number(sale.timestamp) || Date.now();

  if (!sale.txnID) {
    sale.txnID = generateOrderNumber();
    update(ref(db, `sales/${snap.key}`), { txnID: sale.txnID });
  }

  window.transactions[snap.key] = sale;
  renderTable(document.getElementById("searchInput")?.value || "");
  populateDateDropdowns();
});

onChildChanged(salesRef, (snap) => {
  window.transactions[snap.key] = snap.val();
  renderTable(document.getElementById("searchInput")?.value || "");
  populateDateDropdowns();
});

onChildRemoved(salesRef, (snap) => {
  delete window.transactions[snap.key];
  renderTable(document.getElementById("searchInput")?.value || "");
  populateDateDropdowns();
});

// ================== Search Function ==================
document.getElementById("searchInput").addEventListener("input", (e) => {
  const filter = e.target.value.trim();
  renderTable(filter);
});

// ================== PDF Export with Date Filter ==================
document.getElementById("downloadPDF").addEventListener("click", () => {
  const month = document.getElementById("monthSelect").value;
  const day = document.getElementById("daySelect").value;
  const year = document.getElementById("yearSelect").value;

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("⚠️ PDF library not loaded. Check your internet connection.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("landscape");
  const now = new Date().toLocaleString();

  doc.setFontSize(14);
  doc.text("Transaction History Report", 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated on: ${now}`, 14, 22);
  doc.text("VHT Naturals POS & Inventory Management System", 14, 28);

  let txs = Object.values(window.transactions || {});
  if (month || day || year) {
    txs = txs.filter((tx) => {
      const date = new Date(tx.timestamp);
      const matchMonth = month ? date.getMonth() + 1 == month : true;
      const matchDay = day ? date.getDate() == day : true;
      const matchYear = year ? date.getFullYear() == year : true;
      return matchMonth && matchDay && matchYear;
    });
  }

  if (!txs.length) {
    alert("No transactions found for the selected date.");
    return;
  }

  const formatPeso = (amount) =>
    "PHP " + (amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });

  const data = txs
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((tx) => [
      tx.txnID,
      new Date(tx.timestamp).toLocaleString(),
      tx.items
        ? tx.items.map((it) => `${it.name} (${it.quantity})`).join(", ")
        : "—",
      formatPeso(tx.total),
      formatPeso(tx.cashGiven || 0),
      formatPeso(tx.change || 0),
      tx.discountType
        ? `${tx.discountType} (${tx.discountRate || 0}%)
ID: ${tx.discountId || "—"}`
        : "—",
    ]);

  doc.autoTable({
    head: [["Order ID", "Date", "Items", "Total", "Cash Given", "Change", "Discount"]],
    body: data,
    startY: 35,
    styles: { fontSize: 8, cellPadding: 3, valign: "middle" },
    headStyles: { fillColor: [126, 217, 87] },
  });

  doc.save(`Transaction_History_${month || "All"}-${day || "All"}-${year || "All"}.pdf`);
});
