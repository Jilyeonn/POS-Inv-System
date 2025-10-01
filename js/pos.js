import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// 🔹 Firebase Config
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

const cartEl = document.getElementById("cart");
const totalEl = document.getElementById("total");
const ordersList = document.getElementById("ordersList");

let cart = {};

// --- Add to Cart (triggered by buttons in HTML)
window.addToCart = function(name, price) {
  if (!cart[name]) {
    cart[name] = { name, price, qty: 0 };
  }
  cart[name].qty++;
  renderCart();
};

// --- Render Cart
function renderCart() {
  cartEl.innerHTML = "";
  let total = 0;

  Object.values(cart).forEach(item => {
    total += item.price * item.qty;

    const row = document.createElement("div");
    row.classList.add("cart-item");
    row.innerHTML = `
      ${item.name} x ${item.qty} - ₱${(item.price * item.qty).toFixed(2)}
      <button class="remove-btn" onclick="removeFromCart('${item.name}')">🗑</button>
    `;
    cartEl.appendChild(row);
  });

  totalEl.textContent = total.toFixed(2);
}

// --- Remove Item
window.removeFromCart = function(name) {
  delete cart[name];
  renderCart();
};

// --- Confirm Purchase
window.submitOrder = function() {
  if (Object.keys(cart).length === 0) return alert("Cart is empty");

  const newOrderRef = push(ref(db, "orders"));
  set(newOrderRef, {
    items: cart,
    total: parseFloat(totalEl.textContent),
    createdAt: Date.now()
  });

  alert("Order saved!");
  cart = {};
  renderCart();
};

// --- Realtime Orders List
onValue(ref(db, "orders"), snapshot => {
  ordersList.innerHTML = "";
  snapshot.forEach(orderSnap => {
    const order = orderSnap.val();
    const div = document.createElement("div");
    div.classList.add("order-card");
    div.innerHTML = `
      <strong>Order:</strong> ₱${order.total.toFixed(2)} <br>
      <small>${new Date(order.createdAt).toLocaleString()}</small>
    `;
    ordersList.appendChild(div);
  });
});