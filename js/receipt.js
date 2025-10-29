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

window.transactions = {}; // ✅ make it global so the next script can see it
window.salesRef = salesRef;

function formatCurrency(num) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(num || 0);
}

function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${y}${m}${d}-${rand}`;
}

function renderTable() {
  const tbody = document.getElementById("transactionBody");
  const rows = Object.values(window.transactions)
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(tx => {
      const itemList = tx.items
        ? tx.items.map(it => `${it.name} (${it.quantity})`).join(", ")
        : "—";
      return `
        <tr>
          <td>${tx.txnID}</td>
          <td>${new Date(tx.timestamp).toLocaleString()}</td>
          <td>${itemList}</td>
          <td>${formatCurrency(tx.total)}</td>

        </tr>`;
    }).join("");

  tbody.innerHTML = rows || `<tr><td colspan="7" style="text-align:center;">No transactions found</td></tr>`;
}

onChildAdded(salesRef, snap => {
  const sale = snap.val();
  sale.id = snap.key;
  sale.timestamp = Number(sale.timestamp) || Date.now();

  if (!sale.txnID) {
    sale.txnID = generateOrderNumber();
    update(ref(db, `sales/${snap.key}`), { txnID: sale.txnID });
  }

  window.transactions[snap.key] = sale;
  renderTable();
});

onChildChanged(salesRef, snap => {
  window.transactions[snap.key] = snap.val();
  renderTable();
});

onChildRemoved(salesRef, snap => {
  delete window.transactions[snap.key];
  renderTable();
});

document.getElementById("downloadPDF").addEventListener("click", () => {
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

  const txs = Object.values(window.transactions || {});
  if (!txs.length) {
    alert("No transactions available to export.");
    return;
  }

  const formatPeso = amount => "PHP " + (amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });

const data = txs
  .sort((a, b) => b.timestamp - a.timestamp)
  .map(tx => [
    tx.txnID,
    new Date(tx.timestamp).toLocaleString(),
    tx.items ? tx.items.map(it => `${it.name} (${it.quantity})`).join(", ") : "—",
    formatPeso(tx.total),
  ]);

  doc.autoTable({
    head: [["Order ID", "Date", "Items", "Total"]],
    body: data,
    startY: 35,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [126, 217 ,87] },
  });

  doc.save("Transaction_History.pdf");
});