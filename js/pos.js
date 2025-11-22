import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, get, runTransaction, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

// =================== 🔹 DOM ELEMENTS 🔹 ===================
const productList = document.getElementById("product-list");
const cartList = document.getElementById("cart");
const totalEl = document.getElementById("total");
const checkoutBtn = document.getElementById("checkoutBtn");
const salesList = document.getElementById("salesList");
const receiptPopup = document.getElementById("receiptPopup");
const receiptNumberEl = document.getElementById("receiptNumber");
const receiptItemsEl = document.getElementById("receiptItems");
const receiptTotalEl = document.getElementById("receiptTotal");


// 🔹 NEW: Discount input fields
const discountTypeEl = document.getElementById("discountType");
const discountIdEl = document.getElementById("discountId");

if (!productList || !cartList || !totalEl || !checkoutBtn) {
  console.error("POS: required DOM elements are missing.");
}

let cart = {};
let customerCash = 0;

// ========== Helper ==========
function formatCurrency(n) {
  return Number(n).toFixed(2);
}

// ========== Sync Inventory ==========
onValue(ref(db, "inventory"), async (snapshot) => {
  if (!snapshot.exists()) return;
  const inventoryData = snapshot.val();
  for (const [id, item] of Object.entries(inventoryData)) {
    await update(ref(db, `products/${id}`), {
      name: item.name ?? item.item ?? "Unnamed",
      price: parseFloat(item.price ?? item.unitPrice ?? 0),
      quantity: Number(item.quantity ?? 0),
      image: item.image ?? item.imageUrl ?? ""
    });
  }
});

const categoryFilter = document.getElementById("categoryFilter");
const searchBar = document.getElementById("searchBar");

// ================== Load Categories (Auto From DB) ==================
function loadCategories() {
  onValue(ref(db, "products"), (snapshot) => {
    if (!snapshot.exists()) return;

    const categories = new Set();
    snapshot.forEach(child => {
      const p = child.val();
      if (p.category) categories.add(p.category);
    });

    categoryFilter.innerHTML = `<option value="All">All Categories</option>`;
    categories.forEach(cat => {
      categoryFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
  });
}
// ================== Load Products ==================
function loadProducts() {
  onValue(ref(db, "products"), (snapshot) => {
    const products = snapshot.exists() ? snapshot.val() : {};

    // 🔹 Collect categories from product list
    const categories = new Set(["All"]);
    Object.values(products).forEach(p => {
      if (p.category) categories.add(p.category);
    });

    // 🔹 Populate category dropdown (only once)
    if (categoryFilter && categoryFilter.options.length <= 1) {
      categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        categoryFilter.appendChild(opt);
      });
    }

    // 🔹 Render the product list
    const render = () => {
      const selectedCategory = categoryFilter.value;
      const searchQuery = searchBar.value.toLowerCase();

      productList.innerHTML = "";

      const entries = Object.entries(products);
      if (entries.length === 0) {
        productList.innerHTML =
          "<p style='text-align:center; padding: 20px;'>No products available.</p>";
        return;
      }

      entries.forEach(([id, product]) => {
        const price = parseFloat(product.price ?? 0);
        const qtyAvailable = Number(product.quantity ?? 0);
        const name = (product.name ?? product.item ?? "Unnamed").toLowerCase();
        const category = product.category ?? "Uncategorized";

        // 🔹 Category filter
        if (selectedCategory !== "All" && category !== selectedCategory) return;

        // 🔹 Search filter
        if (!name.includes(searchQuery)) return;

        const card = document.createElement("div");
        card.className = "product-card";
        card.innerHTML = `
          
          <div class="product-info">
            <h3>${escapeHtml(product.name ?? "Unnamed")}</h3>
            <div class="product-image" style="text-align:center; margin-bottom:8px;">
  ${
    product.image
      ? `<img src="${product.image}" alt="${escapeHtml(product.name)}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;align-items:center;justify-content:center;">`
      : `<div style="width:100px;height:100px;display:flex;align-items:center;justify-content:center;background:#f0f0f0;color:#999;border-radius:8px;font-size:12px;">No Image</div>`
  }
</div>
            <p>₱${formatCurrency(price)}</p>
            <small>Category: ${category}</small><br>
            <small>Stock: ${qtyAvailable}</small>
          </div>
          <div style="display:flex;gap:8px;justify-content:center;padding-top:8px;">
            <button class="addBtn" data-id="${id}" data-price="${price}" ${
          qtyAvailable <= 0 ? "disabled" : ""
        }>Add to cart</button>
          </div>
        `;

        productList.appendChild(card);
      });

      // 🔹 Re-bind add-to-cart buttons
      document.querySelectorAll(".addBtn").forEach((b) => {
        b.addEventListener("click", async () => {
          await addToCartById(b.dataset.id);
        });
      });
    };

    render(); // initial load

    // 🔹 Live search & category filter
    searchBar.oninput = render;
    categoryFilter.onchange = render;
  });
}

if (categoryFilter) {
  categoryFilter.addEventListener("change", () => {
    loadProducts();
  });
}

// ========== Escaping ==========
function escapeHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}



// ========== Cart Logic ==========
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
      cart[id] = { id, name: product.name ?? product.item ?? "Unnamed", price, qty: 0, image: product.image || "" };
    }
    cart[id].qty++;
    renderCart();
  } catch (err) {
    console.error("Add to cart error:", err);
  }
}

// ================== Render Cart ==================
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
          <div style="font-weight:450;">${escapeHtml(it.name)}</div>
          <div style="width:50px;height:50px;">
          ${
            it.image
              ? `<img src="${it.image}" alt="${escapeHtml(it.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">`
              : `<div style="width:100%;height:100%;background:#eee;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;border-radius:4px;">No Image</div>`
          }
        </div>
          <div style="font-size:13px;color:#666;">₱${formatCurrency(it.price)} x ${it.qty} = ₱${formatCurrency(lineTotal)}</div>
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

  totalEl.textContent = formatCurrency(total);

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
}

// ========== NEW: Live Discount + Change Auto-Update + ID Validation ==========
function getCartTotal() {
  return Object.values(cart).reduce((sum, item) => sum + item.price * item.qty, 0);
}

function validateDiscountId(type, id) {
  const digitsOnly = id.replace(/\D/g, "");
  let valid = false;
  let requiredLength = 0;

  if (type === "Senior") {
    requiredLength = 8;
    valid = digitsOnly.length === requiredLength;
  } else if (type === "PWD") {
    requiredLength = 7;
    valid = digitsOnly.length === requiredLength;
  }

  let container = document.querySelector(".discount-id-container");

let errorEl = document.getElementById("discountError");
if (!errorEl) {
  errorEl = document.createElement("div");
  errorEl.id = "discountError";
  errorEl.style.color = "red";
  errorEl.style.fontSize = "13px";

  container.insertAdjacentElement("afterend", errorEl);
}

if (!valid && (type === "Senior" || type === "PWD")) {
  errorEl.textContent = `❌ ${type} ID must be exactly ${requiredLength} digits.`;
} else {
  errorEl.textContent = "";
}

  return valid;
}

function updateTotalWithDiscount() {
  const total = getCartTotal();
  const discountType = discountTypeEl?.value || "None";
  const discountId = discountIdEl?.value?.trim() || "";
  let discountRate = 0;
  let isIdValid = true;

  // 🔹 Validate ID before applying discount
  if (discountType === "Senior" || discountType === "PWD") {
    isIdValid = validateDiscountId(discountType, discountId);
    if (isIdValid) {
      discountRate = 0.20; // 20% off only if ID format is valid
    }
  } else {
    // If no discount selected, remove any error
    const errorEl = document.getElementById("discountError");
    if (errorEl) errorEl.textContent = "";
  }

  const discountedTotal = total - total * discountRate;
  totalEl.textContent = formatCurrency(discountedTotal);


const cashInput = document.getElementById("cashInput");
const changeAmountEl = document.getElementById("changeAmount");


if (cashInput && !cashInput.dataset.changeListenerAttached) {
  cashInput.dataset.changeListenerAttached = "true";
  cashInput.addEventListener("input", () => {
    customerCash = parseFloat(cashInput.value) || 0;
    updateTotalWithDiscount();
  });
}

if (cashInput && changeAmountEl) {
  const cash = parseFloat(cashInput.value) || 0;
  const change = cash - discountedTotal;
  changeAmountEl.textContent = formatCurrency(change >= 0 ? change : 0);
}
}

// 🔹 Ensure discount and change reapply whenever cart changes
const originalRenderCart = renderCart;
renderCart = function() {
  originalRenderCart();
  updateTotalWithDiscount();
};

// 🔹 Update totals and validation when discount fields change
if (discountTypeEl && discountIdEl) {
  discountTypeEl.addEventListener("change", updateTotalWithDiscount);
  discountIdEl.addEventListener("input", updateTotalWithDiscount);
}

// ========== Change Quantity ==========
async function changeQuantity(id, delta) {
  if (!cart[id]) return;
  try {
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
  }
}

// ========== Checkout ==========
checkoutBtn.addEventListener("click", async () => {
  const items = Object.values(cart);
  if (items.length === 0) {
    alert("Cart is empty!");
    return;
  }

  const total = Object.values(cart).reduce((sum, it) => sum + it.price * it.qty, 0);
  const discountType = discountTypeEl?.value || "None";
  const discountId = discountIdEl?.value?.trim() || "";
  let discountRate = 0;

  if ((discountType === "Senior" || discountType === "PWD") && discountId !== "") {
    discountRate = 0.20; // 20% off
  }

  const discountedTotal = total - total * discountRate;

  if (customerCash < discountedTotal) {
    alert("Not enough cash given!");
    return;
  }

  checkoutBtn.disabled = true;
  checkoutBtn.textContent = "Processing...";

  try {
    for (const item of items) {
      const productSnap = await get(ref(db, `products/${item.id}/quantity`));
      const available = productSnap.exists() ? productSnap.val() : 0;
      if (available < item.qty) throw new Error(`Not enough stock for ${item.name}.`);
    }

    for (const item of items) {
      const productQtyRef = ref(db, `products/${item.id}/quantity`);
      const inventoryQtyRef = ref(db, `inventory/${item.id}/quantity`);
      await runTransaction(productQtyRef, (q) => Math.max((q ?? 0) - item.qty, 0));
      await runTransaction(inventoryQtyRef, (q) => Math.max((q ?? 0) - item.qty, 0));
    }

    // 🔹 VAT-Inclusive Calculation
    const vatRate = 0.12;
    const vatAmount = discountedTotal * (vatRate / (1 + vatRate));
    const netOfVAT = discountedTotal - vatAmount;

    const orderNumber = generateOrderNumber();
    const saleData = {
      id: `sale_${Date.now()}`,
      orderNumber,
      total: discountedTotal,
      vatInclusive: true,
      vatRate: vatRate * 100,
      vatAmount,
      netOfVAT,
      discountType,
      discountId,
      discountRate: discountRate * 100,
      originalTotal: total,
      cashGiven: customerCash,
      change: customerCash - discountedTotal,
      timestamp: Date.now(),
      items: items.map(it => ({
        productId: it.id,
        name: it.name,
        price: it.price,
        quantity: it.qty,
      })),
    };

    await push(ref(db, "sales"), saleData);
    showReceipt(saleData);
    cart = {};
    customerCash = 0;
    renderCart();
  } catch (error) {
    console.error("Checkout error:", error);
    alert(error.message || "Checkout failed.");
  } finally {
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = "Checkout";
  }
});

// ========== Receipt ==========
function generateOrderNumber() {
  const d = new Date();
  return `ORD-${d.getFullYear().toString().slice(-2)}${(d.getMonth()+1)
    .toString().padStart(2,"0")}${d.getDate().toString().padStart(2,"0")}-${d.getHours()}${d.getMinutes()}${d.getSeconds()}`;
}

function showReceipt(order) {
  if (!receiptPopup) return;

  const rows = order.items
    .map(
      (i) =>
        `<tr>
          <td style="text-align:center;">${i.name}</td>
          <td style="text-align:center;">${i.quantity}</td>
          <td style="text-align:center;">₱${formatCurrency(i.price)}</td>
        </tr>`
    )
    .join("");

  receiptNumberEl.textContent = order.orderNumber;
  receiptItemsEl.innerHTML = `
  ${rows}
    <tr><td colspan="2" style="text-align:right;font-weight:600;">Subtotal (Net of VAT):</td>
        <td style="text-align:center;">₱${formatCurrency(order.netOfVAT)}</td></tr>
    <tr><td colspan="2" style="text-align:right;">VAT(${order.vatRate}%):</td>
        <td style="text-align:center;">₱${formatCurrency(order.vatAmount)}</td></tr>
    <tr><td colspan="2" style="text-align:right;">Discount (${order.discountType}):</td>
        <td style="text-align:center;">${order.discountRate > 0 ? `-${order.discountRate}%` : "None"}</td></tr>
    <tr><td colspan="2" style="text-align:right;">ID Number:</td>
        <td style="text-align:center;">${order.discountId || "N/A"}</td></tr>
    <tr><td colspan="2" style="text-align:right;">Cash Given:</td>
        <td style="text-align:center;">₱${formatCurrency(order.cashGiven)}</td></tr>
    <tr><td colspan="2" style="text-align:right;">Change:</td>
        <td style="text-align:center;">₱${formatCurrency(order.change)}</td></tr>
  `;

  receiptTotalEl.textContent = formatCurrency(order.total);
  receiptPopup.style.display = "flex";
}

window.closeReceipt = function () {
  if (receiptPopup) receiptPopup.style.display = "none";
};

// ========== Live Sales ==========
if (salesList) {
  onValue(ref(db, "sales"), (snapshot) => {
    salesList.innerHTML = "";
    if (!snapshot.exists()) return;
    const entries = [];
    snapshot.forEach(snap => {
      entries.push({ key: snap.key, val: snap.val() });
    });
    entries.reverse().forEach(entry => {
      const s = entry.val;
      const date = new Date(s.timestamp ?? Date.now()).toLocaleString();
      const div = document.createElement("div");
      div.className = "sale-entry";
      div.innerHTML = `<strong>₱${formatCurrency(s.total ?? 0)}</strong><br><small>${date}</small>`;
      salesList.appendChild(div);
    });
  });
}

loadCategories();
loadProducts();
renderCart();
