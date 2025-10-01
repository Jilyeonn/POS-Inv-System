import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";


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


 
const productList = document.getElementById("product-list");
const cartList = document.getElementById("cart-list");
const subtotalEl = document.getElementById("subtotal");
const taxEl = document.getElementById("tax");
const totalEl = document.getElementById("total");

let cart = {};

// --- Load Products from Firestore ---
async function loadProducts() {
  const snapshot = await db.collection("products").get();
  productList.innerHTML = "";
  snapshot.forEach(doc => {
    const product = doc.data();
    const div = document.createElement("div");
    div.classList.add("product");
    div.innerHTML = `
      <h4>${product.name}</h4>
      <p>₱${product.price}</p>
      <button onclick="addToCart('${doc.id}', '${product.name}', ${product.price})">Add</button>
    `;
    productList.appendChild(div);
  });
}

// --- Add to Cart ---
function addToCart(id, name, price) {
  if (!cart[id]) {
    cart[id] = { name, price, qty: 0 };
  }
  cart[id].qty++;
  renderCart();
}

// --- Render Cart ---
function renderCart() {
  cartList.innerHTML = "";
  let subtotal = 0;
  Object.keys(cart).forEach(id => {
    const item = cart[id];
    subtotal += item.price * item.qty;
    const row = document.createElement("div");
    row.innerHTML = `
      ${item.name} x ${item.qty} - ₱${(item.price * item.qty).toFixed(2)}
      <button onclick="removeFromCart('${id}')">🗑</button>
    `;
    cartList.appendChild(row);
  });
  let tax = subtotal * 0.12;
  let total = subtotal + tax;
  subtotalEl.textContent = subtotal.toFixed(2);
  taxEl.textContent = tax.toFixed(2);
  totalEl.textContent = total.toFixed(2);
}

// --- Remove Item ---
function removeFromCart(id) {
  delete cart[id];
  renderCart();
}

// --- Confirm Order ---
document.getElementById("confirmOrder").addEventListener("click", async () => {
  if (Object.keys(cart).length === 0) return alert("Cart is empty");

  const order = {
    items: cart,
    createdAt: new Date(),
    subtotal: parseFloat(subtotalEl.textContent),
    tax: parseFloat(taxEl.textContent),
    total: parseFloat(totalEl.textContent)
  };

  await db.collection("orders").add(order);
  alert("Order saved!");
  cart = {};
  renderCart();
});

// Initial Load
loadProducts();