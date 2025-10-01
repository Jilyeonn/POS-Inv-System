import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, get, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";


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
  const tbody = document.querySelector("#inventoryTable tbody");
  const addBtn = document.getElementById("addItemBtn");
  const resupplyBtn = document.getElementById("resupplyBtn"); 
  const inventoryRef = ref(db, "inventory");
  const resuppliesRef = ref(db, "resupplies"); 

  // 🔹 Add Item Form
  const addItemFormContainer = document.createElement("div");
  addItemFormContainer.id = "addItemFormContainer";
  addItemFormContainer.style.display = "none";
  addItemFormContainer.style.marginTop = "20px";
  addItemFormContainer.innerHTML = `
    <h3>Add New Item</h3>
    <form id="addItemForm">
      <input type="text" id="newCode" placeholder="Item Code" required>
      <input type="text" id="newItem" placeholder="Product Name" required>
      <input type="text" id="newCategory" placeholder="Category" required>
      <input type="number" id="newQuantity" placeholder="Quantity" required>
      <input type="number" id="newPrice" placeholder="Unit Price" step="0.01" required>
      <input type="date" id="newExpiry" required>
      <button type="submit">Add Item</button>
      <button type="button" id="cancelAdd">Cancel</button>
    </form>
  `;
  tbody.parentElement.after(addItemFormContainer);

  function openAddPopup() {
  document.getElementById("addPopup").style.display = "flex";
}

function closeAddPopup() {
  document.getElementById("addPopup").style.display = "none";
  document.getElementById("addItemForm").reset();
}

  // 🔹 Edit Item Popup Modal
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

  const addItemForm = document.getElementById("addItemForm");
  const cancelAdd = document.getElementById("cancelAdd");
  const editItemForm = document.getElementById("editItemForm");
  const cancelEdit = document.getElementById("cancelEdit");

  addBtn.addEventListener("click", () => {
    addItemFormContainer.style.display = "block";
  });

  cancelAdd.addEventListener("click", () => {
    addItemFormContainer.style.display = "none";
    addItemForm.reset();
  });

  cancelEdit.addEventListener("click", () => {
    editModal.style.display = "none";
    editItemForm.reset();
  });

  // 🔹 Load Inventory
 onValue(inventoryRef, (snapshot) => {
  tbody.innerHTML = "";
  snapshot.forEach((childSnap) => {
    const data = childSnap.val();
    const id = childSnap.key;

    const itemCode = data.itemCode ?? "";
    const item = data.item ?? "";
    const category = data.category ?? "";
    const quantity = data.quantity ?? 0;
    const expiry = data.expiry ?? "";
    const unitPrice = data.unitPrice ?? 0;

    // --- Automated stock status ---
    let stockStatus = "";
    let stockStyle = "";
    if (quantity <= 10) {
      stockStatus = "Low Stock";
      stockStyle = "background-color:#f8d7da; color:#721c24; font-weight:bold;"; // light red
    } else {
      stockStatus = "In Stock";
      stockStyle = "background-color:#d4edda; color:#155724; font-weight:bold;"; // light green
    }

    // --- Total value calculation ---
    const totalValue = (quantity * unitPrice).toFixed(2);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${itemCode}</td>
      <td>${item}</td>
      <td>${category}</td>
      <td>${quantity}</td>
      <td style="${stockStyle}">${stockStatus}</td>
      <td>${unitPrice}</td>
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
});


  // 🔹 Add Item
  addItemForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const itemCode = document.getElementById("newCode").value.trim();
    const item = document.getElementById("newItem").value.trim();
    const category = document.getElementById("newCategory").value.trim();
    const quantity = Number(document.getElementById("newQuantity").value.trim());
    const unitPrice = Number(document.getElementById("newPrice").value.trim());
    const expiry = document.getElementById("newExpiry").value;

    if (/\d/.test(category)) {
      alert("Category cannot contain numbers. Please enter a valid category.");
      return;
    }

    const stockStatus = quantity > 0 ? "In Stock" : "Out of Stock";
    const totalValue = quantity * unitPrice;

    try {
      await push(inventoryRef, { 
        itemCode, item, category, quantity, 
        stockStatus, unitPrice, totalValue, expiry 
      });
      addItemFormContainer.style.display = "none";
      addItemForm.reset();
    } catch (e) {
      console.error("Add failed:", e);
      alert("Add failed. Check Firebase config.");
    }
  });

  // 🔹 Resupply Log
  resupplyBtn.addEventListener("click", async () => {
    const today = new Date().toISOString().split("T")[0]; 
    try {
      await push(resuppliesRef, { date: today });
      alert("Resupply logged for " + today);
    } catch (e) {
      console.error("Resupply failed:", e);
      alert("Failed to log resupply.");
    }
  });

  function attachEditHandlers() {
  document.querySelectorAll(".editBtn").forEach((btn) => {
    btn.onclick = () => {
      const row = btn.closest("tr");
      const id = btn.dataset.id;
      const currentQty = row.children[2].textContent;
      const currentPrice = row.children[4] ? row.children[4].textContent : "";

      openPopup(id, currentQty, currentPrice);
    };
  });
}

  // 🔹 Open Edit Popup
  function openPopup(id, currentQty, currentPrice) {
  document.getElementById("editPopup").style.display = "flex";
  document.getElementById("editQuantity").value = currentQty;
  document.getElementById("editPrice").value = currentPrice || "";
  document.getElementById("editForm").dataset.itemId = id; // store the Firebase key
}

function closePopup() {
  document.getElementById("editPopup").style.display = "none";
}

// ================== CLOSE POPUP ================== //
window.closePopup = function () {
  document.getElementById("editPopup").style.display = "none";
  currentEditId = null;
};

// ================== SAVE EDIT ================== //
document.getElementById("editForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = e.target.dataset.itemId;
  const newQty = document.getElementById("editQuantity").value.trim();
  const newPrice = document.getElementById("editPrice").value.trim();

  try {
    // Get current item
    const snapshot = await get(ref(db, `inventory/${id}`));
    if (!snapshot.exists()) {
      alert("Item not found!");
      return;
    }

    const currentData = snapshot.val();

    // Prepare update object (only add fields that are changed)
    const updatedData = {};
    if (newQty !== "") updatedData.quantity = Number(newQty);
    if (newPrice !== "") updatedData.unitPrice = Number(newPrice);

    // If nothing was changed, just close popup
    if (Object.keys(updatedData).length === 0) {
      alert("No changes made.");
      closePopup();
      return;
    }

    // Merge with existing data
    await update(ref(db, `inventory/${id}`), updatedData);

    closePopup();
  } catch (error) {
    console.error("Update failed:", error);
    alert("Failed to update item.");
  }
})



  // 🔹 Delete Item
  function attachDeleteHandlers() {
    document.querySelectorAll(".deleteBtn").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        try {
          await remove(ref(db, `inventory/${id}`));
        } catch (e) {
          console.error("Delete failed:", e);
          alert("Delete failed. Check permissions.");
        }
      };
    });
  }
});


