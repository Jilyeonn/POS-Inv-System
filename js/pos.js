// pos.js (replace existing POS script)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {getDatabase,ref,push,set,onValue,get,runTransaction,update} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

// DOM elements (make sure these exist in your pos.html)
const productList = document.getElementById("product-list");
const cartList = document.getElementById("cart");
const totalEl = document.getElementById("total");
const checkoutBtn = document.getElementById("checkoutBtn");
const salesList = document.getElementById("salesList");

if (!productList || !cartList || !totalEl || !checkoutBtn) {
  console.error("POS: required DOM elements are missing. Ensure product-list, cart, total, checkoutBtn exist.");
}

// Cart structure: { productId: { id, name, price, qty, image } }
let cart = {};

// Helper: format currency
function formatCurrency(n) {
  return Number(n).toFixed(2);
}

// 1) Load products from /products and render them
function loadProducts() {
  onValue(ref(db, "products"), (snapshot) => {
    productList.innerHTML = "";

    if (!snapshot.exists()) {
      productList.innerHTML = "<p style='text-align:center; padding: 20px;'>No products available.</p>";
      return;
    }

    snapshot.forEach((childSnap) => {
      const product = childSnap.val();
      const id = childSnap.key;

      const price = parseFloat(product.price ?? product.unitPrice ?? 0);
      const qtyAvailable = Number(product.quantity ?? 0);

      const card = document.createElement("div");
      card.className = "product-card";

      // ✅ Removed the <img> line
      card.innerHTML = `
        <div class="product-info">
          <h3>${escapeHtml(product.name ?? product.item ?? "Unnamed")}</h3>
          <p>₱${formatCurrency(price)}</p>
          <small>Stock: ${qtyAvailable}</small>
        </div>
        <div style="display:flex;gap:8px;justify-content:center;padding-top:8px;">
          <button class="addBtn" data-id="${id}" data-price="${price}" ${qtyAvailable <= 0 ? "disabled" : ""}>Add to cart</button>
        </div>
      `;
      productList.appendChild(card);
    });

    // attach add-to-cart handlers
    document.querySelectorAll(".addBtn").forEach((b) => {
      b.addEventListener("click", async (e) => {
        const id = b.dataset.id;
        await addToCartById(id);
      });
    });
  }, (err) => {
    console.error("Error loading products:", err);
  });
}

// escape text for insertion to innerHTML
function escapeHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 2) Add to cart with stock check
async function addToCartById(id) {
  try {
    const prodSnap = await get(ref(db, `products/${id}`));
    const product = prodSnap.exists() ? prodSnap.val() : null;
    if (!product) {
      alert("Product not found.");
      return;
    }
    const price = parseFloat(product.price ?? product.unitPrice ?? 0);
    const available = Number(product.quantity ?? 0);

    const currentQtyInCart = cart[id] ? cart[id].qty : 0;
    if (available <= currentQtyInCart) {
      alert("Not enough stock available.");
      return;
    }

    if (!cart[id]) {
      cart[id] = { id, name: product.name ?? product.item ?? "Unnamed", price, qty: 0, image: product.image || product.imageUrl || "" };
    }
    cart[id].qty++;
    renderCart();
  } catch (err) {
    console.error("Add to cart error:", err);
    alert("Failed to add to cart.");
  }
}

// 3) Render cart UI
function renderCart() {
  cartList.innerHTML = "";
  let total = 0;

  const ids = Object.keys(cart);
  if (ids.length === 0) {
    cartList.innerHTML = "<p style='text-align:center; color:#666;'>Cart is empty</p>";
    totalEl.textContent = formatCurrency(0);
    return;
  }

  ids.forEach((id) => {
    const it = cart[id];
    const lineTotal = it.price * it.qty;
    total += lineTotal;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;">
        <div>
          <div style="font-weight:600;">${escapeHtml(it.name)}</div>
          <div style="font-size:0.9rem;color:#666;">₱${formatCurrency(it.price)} x ${it.qty} = ₱${formatCurrency(lineTotal)}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <button class="qtyBtn" data-id="${id}" data-delta="-1">−</button>
        <span>${it.qty}</span>
        <button class="qtyBtn" data-id="${id}" data-delta="1">+</button>
        <button class="removeBtn" data-id="${id}" style="margin-left:8px;background:#e74c3c;color:#fff;border:none;padding:6px;border-radius:6px;cursor:pointer;">Remove</button>
      </div>
    `;
    cartList.appendChild(div);
  });

  // attach quantity and remove handlers
  cartList.querySelectorAll(".qtyBtn").forEach(b => {
    b.onclick = async (e) => {
      const id = b.dataset.id;
      const delta = Number(b.dataset.delta);
      await changeQuantity(id, delta);
    };
  });
  cartList.querySelectorAll(".removeBtn").forEach(b => {
    b.onclick = (e) => {
      const id = b.dataset.id;
      delete cart[id];
      renderCart();
    };
  });

  totalEl.textContent = formatCurrency(total);
}

// change item qty after stock check
async function changeQuantity(id, delta) {
  if (!cart[id]) return;
  try {
    // check available
    const prodSnap = await get(ref(db, `products/${id}`));
    const product = prodSnap.exists() ? prodSnap.val() : null;
    const available = Number(product?.quantity ?? 0);
    const newQty = cart[id].qty + delta;
    if (newQty <= 0) {
      delete cart[id];
      renderCart();
      return;
    }
    if (newQty > available) {
      alert("Not enough stock available.");
      return;
    }
    cart[id].qty = newQty;
    renderCart();
  } catch (err) {
    console.error("changeQuantity error:", err);
    alert("Failed to change quantity.");
  }
}

// remove from cart helper (used by inline button handlers if needed)
window.removeFromCart = function (id) {
  delete cart[id];
  renderCart();
};

// 4) Checkout: validate availability, decrement with transactions, save sale
checkoutBtn.addEventListener("click", async () => {
  const items = Object.values(cart);
  if (items.length === 0) {
    alert("Cart is empty!");
    return;
  }

  checkoutBtn.disabled = true;
  checkoutBtn.textContent = "Processing...";

  try {
    // Step 1: Check all stock
    for (const item of items) {
      const productSnap = await get(ref(db, `products/${item.id}/quantity`));
      const available = productSnap.exists() ? productSnap.val() : 0;
      if (available < item.qty) {
        throw new Error(`❌ Not enough stock for ${item.name}. Available: ${available}`);
      }
    }

    // Step 2: Deduct from /products and /inventory
    for (const item of items) {
      const productQtyRef = ref(db, `products/${item.id}/quantity`);
      const inventoryQtyRef = ref(db, `inventory/${item.id}/quantity`);

      await runTransaction(productQtyRef, (currentQty) => Math.max((currentQty ?? 0) - item.qty, 0));
      await runTransaction(inventoryQtyRef, (currentQty) => Math.max((currentQty ?? 0) - item.qty, 0));
    }

    // ✅ Step 3: Log sale (compatible with saleschart.js)
    const total = parseFloat(totalEl.textContent);
    const saleData = {
      id: `sale_${Date.now()}`,
      total,
      timestamp: Date.now(),
      items: items.map((it) => ({
        productId: it.id,
        name: it.name,
        price: it.price,
        quantity: it.qty,
      })),
    };

    await push(ref(db, "sales"), saleData);

    alert("✅ Sale completed successfully! Stock updated and logged in sales.");
    cart = {};
    renderCart();

  } catch (error) {
    console.error("Checkout error:", error);
    alert(error.message || "Checkout failed.");
  } finally {
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = "Checkout";
  }
});

// 5) Live recent sales list
if (salesList) {
  onValue(ref(db, "sales"), (snapshot) => {
    salesList.innerHTML = "";
    if (!snapshot.exists()) return;
    // We'll show newest first
    const entries = [];
    snapshot.forEach(snap => {
      entries.push({ key: snap.key, val: snap.val() });
    });
    entries.reverse().forEach(entry => {
      const s = entry.val;
      const div = document.createElement("div");
      div.className = "sale-entry";
      const date = new Date(s.createdAt ?? Date.now()).toLocaleString();
      div.innerHTML = `<strong>₱${formatCurrency(s.total ?? 0)}</strong><br><small>${date}</small>`;
      salesList.appendChild(div);
    });
  });
}

// initialize
loadProducts();
renderCart();

