import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, get, update, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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
  const resupplyBtn = document.getElementById("resupplyBtn");

  const inventoryRef = ref(db, "inventory");
  const resuppliesRef = ref(db, "resupplies");
  const productsRef = ref(db, "products");

const tbody = document.querySelector("#inventoryTable tbody");
if (!tbody) console.error("tbody not found: check selector #inventoryTable tbody");
const addBtn = document.getElementById("addBtn") || document.getElementById("addItemBtn");
if (!addBtn) console.error("add button not found: expected #addBtn or #addItemBtn");

// Start of Add Item Popup Form //
const addPopupOverlay = document.createElement("div");
addPopupOverlay.classList.add("popup-overlay");
addPopupOverlay.id = "addPopup";
addPopupOverlay.style.display = "none";

addPopupOverlay.innerHTML = `
  <div class="popup">
    <h2>Add New Item</h2>
    <form id="addItemForm">
      <input type="text" id="newCode" placeholder="Item Code" required>
      <input type="text" id="newItem" placeholder="Product Name" required>
      <input type="text" id="newCategory" placeholder="Category" required>
      <input type="number" id="newQuantity" placeholder="Quantity" required>
      <input type="number" id="newPrice" placeholder="Unit Price" step="0.01" required>
      <input type="date" id="newExpiry" required>

      <div class="popup-buttons">
        <button type="button" id="cancelAdd" class="cancel-btn">Cancel</button>
        <button type="submit" class="save-btn">Add Item</button>
      </div>
    </form>
  </div>
`;
document.body.appendChild(addPopupOverlay);

const addItemForm = addPopupOverlay.querySelector("#addItemForm");
const cancelAdd = addPopupOverlay.querySelector("#cancelAdd");

addBtn.addEventListener("click", () => {
  console.log("Opening Add popup");
  addPopupOverlay.style.display = "flex";
  addItemForm.reset();
});


cancelAdd.addEventListener("click", () => {
  addPopupOverlay.style.display = "none";
  addItemForm.reset();
});
addPopupOverlay.addEventListener("click", (e) => { if (e.target === addPopupOverlay) addPopupOverlay.style.display = "none"; });

// ---------------- Add item handler ----------------
addItemForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const itemCode = addItemForm.querySelector("#newCode").value.trim();
  const item = addItemForm.querySelector("#newItem").value.trim();
  const category = addItemForm.querySelector("#newCategory").value.trim();
  const quantity = Number(addItemForm.querySelector("#newQuantity").value);
  const unitPrice = Number(addItemForm.querySelector("#newPrice").value);
  const expiry = addItemForm.querySelector("#newExpiry").value;

  if (/\d/.test(category)) {
    alert("Category cannot contain numbers.");
    return;
  }
  if (!itemCode || !item || isNaN(quantity) || isNaN(unitPrice)) {
    alert("Please fill all fields correctly.");
    return;
  }

  const stockStatus = quantity > 0 ? "In Stock" : "Out of Stock";
  const totalValue = quantity * unitPrice;

  try {
    const newRef = push(inventoryRef);
    await set(newRef, {
      itemCode,
      item,
      category,
      quantity,
      stockStatus,
      unitPrice,
      totalValue,
      expiry
    });

    await set(ref(db, `products/${newRef.key}`), {
      name: item,
      price: unitPrice,
      quantity,
      category,
      itemCode
    });

    console.log("Added new item key:", newRef.key);


    alert("Item is added and synced to PoS!");
    addPopupOverlay.style.display = "none";
    addItemForm.reset();

  } catch (err) {
    console.error("Add failed:", err);
    alert("Failed to add item. Check Firebase config/console.");
  }
});

//To load inventory after every add item.//
onValue(inventoryRef, (snapshot) => {
  console.log("onValue snapshot changed");
  if (!tbody) {
    console.error("tbody missing when onValue fired");
    return;
  }

  tbody.innerHTML = "";

  if (!snapshot.exists()) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="9" style="text-align:center;">No inventory items</td>`;
    tbody.appendChild(tr);
    return;
  }
  snapshot.forEach((childSnap) => {
    const data = childSnap.val();
    const id = childSnap.key;
    const itemCode = data.itemCode ?? "";
    const item = data.item ?? "";
    const category = data.category ?? "";
    const quantity = Number(data.quantity ?? 0);
    const expiry = data.expiry ?? "";
    const unitPrice = typeof data.unitPrice !== "undefined" ? Number(data.unitPrice) : (typeof data.price !== "undefined" ? Number(data.price) : 0);

    let stockStatus = "";
    let stockStyle = "";
    if (quantity <= 10) {
      stockStatus = "Low Stock";
      stockStyle = "background-color:#f8d7da; color:#721c24; font-weight:bold;";
    } else {
      stockStatus = "In Stock";
      stockStyle = "background-color:#d4edda; color:#155724; font-weight:bold;";
    }

    const totalValue = (quantity * unitPrice).toFixed(2);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${itemCode}</td>
      <td>${item}</td>
      <td>${category}</td>
      <td>${quantity}</td>
      <td style="${stockStyle}">${stockStatus}</td>
      <td>${Number(unitPrice).toFixed(2)}</td>
      <td>${totalValue}</td>
      <td>${expiry}</td>
      <td>
        <button class="editBtn" data-id="${id}"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="deleteBtn" data-id="${id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  attachEditHandlers();
  attachDeleteHandlers();
}, (err) => {
  console.error("onValue error:", err);
});

// ================== 🔹 SEARCH FUNCTIONALITY ================== //
const searchInput = document.getElementById("searchItemInput");
let allItems = []; // will hold all inventory items for filtering

// Store items when inventory loads
onValue(inventoryRef, (snapshot) => {
  console.log("onValue snapshot changed");
  if (!tbody) return;

  allItems = []; // reset the array
  tbody.innerHTML = "";

  if (!snapshot.exists()) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="9" style="text-align:center;">No inventory items</td>`;
    tbody.appendChild(tr);
    return;
  }

  snapshot.forEach((childSnap) => {
    const data = childSnap.val();
    allItems.push({ id: childSnap.key, ...data });
  });

  renderTable(allItems); // render initially
}, (err) => {
  console.error("onValue error:", err);
});

// Function to render inventory rows
function renderTable(items) {
  tbody.innerHTML = "";

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No matching items found.</td></tr>`;
    return;
  }

  items.forEach((data) => {
    const id = data.id;
    const itemCode = data.itemCode ?? "";
    const item = data.item ?? "";
    const category = data.category ?? "";
    const quantity = Number(data.quantity ?? 0);
    const expiry = data.expiry ?? "";
    const unitPrice = Number(data.unitPrice ?? data.price ?? 0);

    const stockStatus = quantity <= 10 ? "Low Stock" : "In Stock";
    const stockStyle =
      quantity <= 10
        ? "background-color:#f8d7da; color:#721c24; font-weight:bold;"
        : "background-color:#d4edda; color:#155724; font-weight:bold;";

    const totalValue = (quantity * unitPrice).toFixed(2);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${itemCode}</td>
      <td>${item}</td>
      <td>${category}</td>
      <td>${quantity}</td>
      <td style="${stockStyle}">${stockStatus}</td>
      <td>${unitPrice.toFixed(2)}</td>
      <td>${totalValue}</td>
      <td>${expiry}</td>
      <td>
        <button class="editBtn" data-id="${id}"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="deleteBtn" data-id="${id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  attachEditHandlers?.();
  attachDeleteHandlers?.();
}

// Filter when typing in the search box //
searchInput.addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = allItems.filter((data) =>
    (data.itemCode && data.itemCode.toLowerCase().includes(term)) ||
    (data.item && data.item.toLowerCase().includes(term)) ||
    (data.category && data.category.toLowerCase().includes(term))
  );
  renderTable(filtered);
});

  
// Start of Resupply Popup Form //
const resupplyPopup = document.createElement("div");
resupplyPopup.classList.add("popup-overlay");
resupplyPopup.id = "resupplyPopup";
resupplyPopup.style.display = "none";

resupplyPopup.innerHTML = `
  <div class="popup" style="margin-top:60px;">
    <h2>Log Resupply</h2>
    <form id="resupplyForm">
      <label for="resupplyItem">Select Item to Resupply</label>
      <select id="resupplyItem" required>
        <option value="">-- Choose Item --</option>
      </select>
      <!-- Current expiry display -->
      <div id="resupplyItemExpiryBox" style="display:none; background:#f8f8f8; padding:8px; margin:8px 0; border-radius:8px;">
        <p><strong>Current Expiry:</strong> <span id="resupplyItemExpiry">—</span></p>
      </div>
      <label for="resupplyQuantity">Quantity to Add</label>
      <input type="number" id="resupplyQuantity" placeholder="Enter quantity" required min="1">
      <label for="resupplyDate">Resupply Date</label>
      <input type="date" id="resupplyDate" required>
      <label for="resupplyNewExpiry">New Expiry Date</label>
      <input type="date" id="resupplyNewExpiry" required>
      <div class="popup-buttons">
        <button type="button" id="cancelResupply" class="cancel-btn">Cancel</button>
        <button type="submit" class="save-btn">Save</button>
      </div>
    </form>
  </div>
`;
document.body.appendChild(resupplyPopup);

const resupplyForm = resupplyPopup.querySelector("#resupplyForm");
const cancelResupply = resupplyPopup.querySelector("#cancelResupply");
const resupplyItemSelect = resupplyPopup.querySelector("#resupplyItem");
const resupplyItemExpiry = document.getElementById("resupplyItemExpiry");
const resupplyItemExpiryBox = document.getElementById("resupplyItemExpiryBox");

// Dropdown for choosing which item to resupply //
async function populateResupplyDropdown() {
  resupplyItemSelect.innerHTML = `<option value="">-- Choose Item Code --</option>`;
  try {
    const snapshot = await get(inventoryRef);
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        const data = child.val();
        const id = child.key;
        const code = data.itemCode ?? "NoCode";
        const name = data.item ?? "Unnamed";
        const option = document.createElement("option");
        option.value = id; 
        option.textContent = `${code} - ${name}`;
        resupplyItemSelect.appendChild(option);
      });
    }
  } catch (err) {
    console.error("Error loading items:", err);
  }
}

// Show current expiry when item changes 
resupplyItemSelect.addEventListener("change", async (e) => {
  const selectedId = e.target.value;
  if (!selectedId) {
    resupplyItemExpiryBox.style.display = "none";
    return;
  }

  try {
    const itemSnap = await get(ref(db, `inventory/${selectedId}`));
    if (itemSnap.exists()) {
      const itemData = itemSnap.val();
      resupplyItemExpiry.textContent = itemData.expiry || "—";
      resupplyItemExpiryBox.style.display = "block";
      document.getElementById("resupplyNewExpiry").value = itemData.expiry || "";
    } else {
      resupplyItemExpiryBox.style.display = "none";
    }
  } catch (err) {
    console.error("Error fetching expiry:", err);
  }
});

// Opens the Resupply Popup //
resupplyBtn.addEventListener("click", async () => {
  await populateResupplyDropdown();
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("resupplyDate").value = today;
  document.getElementById("resupplyNewExpiry").value = today;
  resupplyItemExpiryBox.style.display = "none";
  resupplyPopup.style.display = "flex";
});

cancelResupply.addEventListener("click", () => {
  resupplyPopup.style.display = "none";
  resupplyForm.reset();
  resupplyItemExpiryBox.style.display = "none";
});


resupplyPopup.addEventListener("click", (e) => {
  if (e.target === resupplyPopup) resupplyPopup.style.display = "none";
});

resupplyForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const selectedItemId = document.getElementById("resupplyItem").value;
  const addedQty = Number(document.getElementById("resupplyQuantity").value);
  const date = document.getElementById("resupplyDate").value;
  const newExpiry = document.getElementById("resupplyNewExpiry").value;

  if (!selectedItemId) {
    alert("⚠️ Please select an item to resupply.");
    return;
  }
  if (isNaN(addedQty) || addedQty <= 0) {
    alert("⚠️ Please enter a valid quantity.");
    return;
  }

  try {
    const itemRef = ref(db, `inventory/${selectedItemId}`);
    const itemSnap = await get(itemRef);

    if (!itemSnap.exists()) {
      alert("Item not found in inventory!");
      return;
    }

    const currentData = itemSnap.val();
    const oldQty = currentData.quantity || 0;
    const newQty = oldQty + addedQty;
    const totalValue = newQty * (currentData.unitPrice || 0);
    const stockStatus = newQty <= 10 ? "Low Stock" : "In Stock";

    await update(itemRef, {
      quantity: newQty,
      totalValue,
      stockStatus,
      expiry: newExpiry,
    });

    await push(ref(db, "resupplies"), {
      itemId: selectedItemId,
      itemCode: currentData.itemCode,
      itemName: currentData.item,
      quantityAdded: addedQty,
      previousQuantity: oldQty,
      newQuantity: newQty,
      previousExpiry: currentData.expiry || "",
      newExpiry,
      date,
    });

    alert(`${addedQty} units added to "${currentData.item}" (new stock: ${newQty})\nNew Expiry: ${newExpiry}`);
    resupplyPopup.style.display = "none";
    resupplyForm.reset();
    resupplyItemExpiryBox.style.display = "none";
  } catch (error) {
    console.error("Resupply update failed:", error);
    alert("Something went wrong updating the inventory.");
  }
});

// Start of Edit Popup //

  const editModal = document.createElement("div");
  editModal.id = "editModal";
  editModal.style.display = "none";
  editModal.style.position = "fixed";
  editModal.style.top = "0";
  editModal.style.left = "0";
  editModal.style.width = "100%";
  editModal.style.height = "100%";
  editModal.style.background = "rgba(0,0,0,0.5)";
  editModal.style.justifyContent = "center";
  editModal.style.alignItems = "center";
  editModal.innerHTML = `
  <div style="background:white;padding:20px;border-radius:10px;min-width:300px;">
    <h3>Edit Item</h3>
    <form id="editItemForm">
      <input type="hidden" id="editId">
      <label>Quantity:</label>
      <input type="number" id="editQuantity" required><br><br>
      <label>Unit Price:</label>
      <input type="number" id="editPrice" step="0.01" required><br><br>
      <button type="submit">Update</button>
      <button type="button" id="cancelEdit">Cancel</button>
    </form>
  </div>
  `;
  document.body.appendChild(editModal);

const editItemForm = document.getElementById("editItemForm");
const cancelEdit = document.getElementById("cancel-btn");

cancelEdit.addEventListener("click", () => {
  editModal.style.display = "none";
  closeEditPopup();
});

function openEditPopup(id, currentQty, currentPrice) {
  document.getElementById("editPopup").style.display = "flex";
  document.getElementById("editQuantity").value = currentQty;
  document.getElementById("editPrice").value = currentPrice || "";
  document.getElementById("editForm").dataset.itemId = id; 
}

function closeEditPopup() {
  document.getElementById("editPopup").style.display = "none";
  editItemForm.reset();
}

function attachEditHandlers() {
  document.querySelectorAll(".editBtn").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const snapshot = await get(ref(db, `inventory/${id}`));
      if (!snapshot.exists()) return;
      const data = snapshot.val();
      openEditPopup(id, data.quantity, data.unitPrice);
    };
  });
}

document.getElementById("editForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = e.target.dataset.itemId;
  const newQty = document.getElementById("editQuantity").value.trim();
  const newPrice = document.getElementById("editPrice").value.trim();

  if (!newQty || !newPrice) {
    alert("Please fill out both fields.");
    return;
  }

  try {
    await update(ref(db, `inventory/${id}`), {
      quantity: Number(newQty),
      unitPrice: Number(newPrice),
      totalValue: Number(newQty) * Number(newPrice),
    });
    await update(ref(db, `products/${id}`), {
      quantity: Number(newQty),
      price: Number(newPrice),
    });

    alert("✅ Item updated successfully!");
    closeEditPopup();
  } catch (error) {
    console.error("Update failed:", error);
    alert("❌ Failed to update item.");
  }
});
  
// Deletes the Item //
  function attachDeleteHandlers() {
    document.querySelectorAll(".deleteBtn").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        if (!confirm("Are you sure you want to delete this item?")) return;

        await remove(ref(db, `inventory/${id}`));
        await remove(ref(db, `products/${id}`)); // 🔹 remove from PoS as well
        alert("Item has been deleted from inventory and PoS.");
      };
    });
  }
});

