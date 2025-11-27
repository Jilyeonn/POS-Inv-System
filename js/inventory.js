import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, get, update, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import {getAuth, onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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
const auth = getAuth(app);

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
});

// ================== ACTIVITY LOGGER ==================
function logActivity(action, details = "") {
  const logsRef = ref(db, "systemLogs");
  const user = auth.currentUser;
  
  // Define options for Philippine Standard Time (PST, UTC+8)
  const options = {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false // Use 24-hour format
  };
  
  // Generate the Manila time string
  const manilaTimestamp = new Date().toLocaleString('en-PH', options);

  const logData = {
    userId: user?.uid || "Unknown",
    email: user?.email || "Unknown",
    action,
    details,
    // Store the formatted Manila time string
    timestamp: manilaTimestamp 
  };

  return push(logsRef, logData);
}

document.addEventListener("DOMContentLoaded", () => {
  const resupplyBtn = document.getElementById("resupplyBtn");
  const inventoryRef = ref(db, "inventory");
  const newItemRef = push(ref(db, "inventory"));
  const autoCode = "ITEM-" + newItemRef.key.substring(0, 6).toUpperCase();
  const resuppliesRef = ref(db, "resupplies");
  const productsRef = ref(db, "products");
  const tbody = document.querySelector("#inventoryTable tbody");
  if (!tbody) console.error("tbody not found: check selector #inventoryTable tbody");
  const addBtn = document.getElementById("addBtn") || document.getElementById("addItemBtn");
  if (!addBtn) console.error("add button not found: expected #addBtn or #addItemBtn");

  // ADD ITEM POPUP 
  const addPopupOverlay = document.createElement("div");
  addPopupOverlay.classList.add("popup-overlay");
  addPopupOverlay.id = "addPopup";
  addPopupOverlay.style.display = "none";

  addPopupOverlay.innerHTML = `
    <div class="popup">
      <h2>Add New Item</h2>
      <form id="addItemForm">

        <input type="text" id="newItem" placeholder="Product Name" required>
        <input type="text" id="newCategory" placeholder="Category" required>
        <input type="number" id="newQuantity" placeholder="Quantity" required>
        <input type="number" id="newPrice" placeholder="Unit Price" step="0.01" required>
        <label style="margin-top:10px;">Expiration Date</label>
        <input type="date" id="newExpiry" required>

        <!-- Image field -->
        <label style="margin-top:10px;">Product Image</label>
        <input type="file" id="newImage" accept="image/*">

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

  addBtn?.addEventListener("click", () => {
    if (addPopupOverlay) {
      addPopupOverlay.style.display = "flex";
      addItemForm?.reset();
    }
  });

  cancelAdd?.addEventListener("click", () => {
    addPopupOverlay.style.display = "none";
    addItemForm.reset();
  });

  addPopupOverlay.addEventListener("click", (e) => {
    if (e.target === addPopupOverlay) addPopupOverlay.style.display = "none";
  });

//  ADD ITEM (NOT POPUP ONLY PROCESS)
addItemForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const item = addItemForm.querySelector("#newItem").value.trim();
  const category = addItemForm.querySelector("#newCategory").value.trim();
  const quantity = Number(addItemForm.querySelector("#newQuantity").value);
  const unitPrice = Number(addItemForm.querySelector("#newPrice").value);
  const expiry = addItemForm.querySelector("#newExpiry").value;
  const file = addItemForm.querySelector("#newImage").files[0];

  if (!item || !category || isNaN(quantity) || isNaN(unitPrice)) {
    alert("Please fill all fields correctly.");
    return;
  }

  let stockStatus = quantity === 0 ? "No Stock" : quantity <= 10 ? "Low Stock" : "In Stock";
  const totalValue = quantity * unitPrice;

  let imageData = "";
  if (file) {
    const reader = new FileReader();
    reader.onload = async () => {
      imageData = reader.result;

      const snap = await get(inventoryRef);
      let nextCode = 1000;
      if (snap.exists()) {
        let maxCode = 1000;
        snap.forEach((child) => {
          const code = Number(child.val().itemCode);
          if (!isNaN(code) && code > maxCode) maxCode = code;
        });
        nextCode = maxCode + 1;
      }

      const itemCode = nextCode;
      const newRef = push(inventoryRef);

      await set(newRef, {
        itemCode,
        item,
        category,
        quantity,
        stockStatus,
        unitPrice,
        totalValue,
        expiry,
        imageUrl: imageData 
      });

      await set(ref(db, `products/${newRef.key}`), {
        name: item,
        price: unitPrice,
        quantity,
        category,
        itemCode,
        imageUrl: imageData
      });

      logActivity("Added Item", `Item: ${item}, Qty: ${quantity}, Price: ${unitPrice}`);

      alert("Item added successfully!");
      addPopupOverlay.style.display = "none";
      addItemForm.reset();
    };
    reader.readAsDataURL(file);
  } else {

    const snap = await get(inventoryRef);
    let nextCode = 1000;
    if (snap.exists()) {
      let maxCode = 1000;
      snap.forEach((child) => {
        const code = Number(child.val().itemCode);
        if (!isNaN(code) && code > maxCode) maxCode = code;
      });
      nextCode = maxCode + 1;
    }

    const itemCode = nextCode;
    const newRef = push(inventoryRef);

    await set(newRef, {
      itemCode,
      item,
      category,
      quantity,
      stockStatus,
      unitPrice,
      totalValue,
      expiry,
      imageUrl: ""
    });


    await set(ref(db, `products/${newRef.key}`), {
      name: item,
      price: unitPrice,
      quantity,
      category,
      itemCode,
      imageUrl: ""
    });

    alert("Item added successfully!");
    addPopupOverlay.style.display = "none";
    addItemForm.reset();
  }
});


//INVENTORY TABLE RENDERING
onValue(inventoryRef, (snapshot) => {
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!snapshot.exists()) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="10" style="text-align:center;">No inventory items</td>`;
    tbody.appendChild(tr);
    return;
  }

  const sortedItems = [];
  snapshot.forEach((childSnap) => {
    sortedItems.push({
      id: childSnap.key,
      ...childSnap.val()
    });
  });

  sortedItems.sort((a, b) => Number(a.itemCode) - Number(b.itemCode)); // Make sure sorting happens

  sortedItems.forEach((data) => {
    const id = data.id;
    const itemCode = data.itemCode ?? "";
    const item = data.item ?? "";
    const category = data.category ?? "";
    const quantity = Number(data.quantity ?? 0);
    const expiry = data.expiry ?? "";
    const unitPrice = Number(data.unitPrice ?? data.price ?? 0);
    const imageUrl = data.imageUrl ?? "";

    let stockStatus = "";
    let stockStyle = "";

    if (quantity === 0) {
      stockStatus = "No Stock";
      stockStyle = "background-color:#ff4d4d; color:#fff; font-weight:bold;";
    } else if (quantity <= 10) {
      stockStatus = "Low Stock";
      stockStyle = "background-color:#f8d7da; color:#721c24; font-weight:bold;";
    } else {
      stockStatus = "In Stock";
      stockStyle = "background-color:#d4edda; color:#155724; font-weight:bold;";
    }

    const totalValue = (quantity * unitPrice).toFixed(2);

    const imgCell = imageUrl
      ? `<td><img src="${imageUrl}" alt="${item}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;"></td>`
      : `<td style="text-align:center;color:#999;font-size:12px;">No image</td>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${itemCode}</td>
      ${imgCell}
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

  attachEditHandlers();
  attachArchiveHandlers();
  checkExpiryWarnings(snapshot);
});


// IMAGE PREVIEW LANG FOR ADD ITEM FORM 
const newImageInput = addItemForm.querySelector("#newImage");

const previewContainer = document.createElement("div");
previewContainer.style.marginTop = "10px";
previewContainer.style.minHeight = "50px";
addItemForm.querySelector("#newImage").insertAdjacentElement("afterend", previewContainer);

newImageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  previewContainer.innerHTML = ""; 

  if (file) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.width = "50px";
    img.style.height = "50px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "4px";
    img.onload = () => URL.revokeObjectURL(img.src); 
    previewContainer.appendChild(img);
  } else {
    previewContainer.textContent = "No image selected";
    previewContainer.style.color = "#999";
    previewContainer.style.fontSize = "12px";
  }
});

  // SEARCH FUNCTIONALITY
  const searchInput = document.getElementById("searchItemInput");
  let allItems = [];

searchInput?.addEventListener("input", (e) => {
  const query = e.target.value.trim().toLowerCase();
  const filtered = allItems.filter(item => 
    (item.item ?? "").toLowerCase().includes(query) ||
    (item.category ?? "").toLowerCase().includes(query) ||
    (String(item.itemCode) ?? "").toLowerCase().includes(query)
  );
  renderTable(filtered);
});

  onValue(inventoryRef, (snapshot) => {
    allItems = [];
    if (!snapshot.exists()) return;
    snapshot.forEach((childSnap) => {
      const data = childSnap.val();
      allItems.push({ id: childSnap.key, ...data });
    });
    renderTable(allItems);
  });

  function renderTable(items) {
  if (!tbody) return;
  tbody.innerHTML = "";

  items.sort((a, b) => Number(a.itemCode) - Number(b.itemCode));

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;">No matching items found.</td></tr>`;
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
    const imageUrl = data.imageUrl ?? "";

    let stockStatus = "";
    let stockStyle = "";

    if (quantity === 0) {
      stockStatus = "No Stock";
      stockStyle = "background-color:#ff4d4d; color:#fff; font-weight:bold;";
    } else if (quantity <= 10) {
      stockStatus = "Low Stock";
      stockStyle = "background-color:#f8d7da; color:#721c24; font-weight:bold;";
    } else {
      stockStatus = "In Stock";
      stockStyle = "background-color:#d4edda; color:#155724; font-weight:bold;";
    }

    const totalValue = (quantity * unitPrice).toFixed(2);

    const imgCell = imageUrl
      ? `<td><img src="${imageUrl}" alt="${item}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;"></td>`
      : `<td style="text-align:center;color:#999;font-size:12px;">No image</td>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${itemCode}</td>
      ${imgCell}
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
  attachArchiveHandlers?.();
}


  // ARCHIVED ITEMS POPUP
const archivePopup = document.getElementById("archivePopup");
const archiveTableBody = document.getElementById("archiveTableBody");
const closeArchiveBtn = document.getElementById("closeArchiveBtn");
const viewArchiveBtn = document.getElementById("viewArchiveBtn");

function openArchivePopup() {
  archivePopup.style.display = "flex";
  loadArchivedItems();
}

closeArchiveBtn.addEventListener("click", () => {
  archivePopup.style.display = "none";
});

archivePopup.addEventListener("click", (e) => {
  if (e.target === archivePopup) archivePopup.style.display = "none";
});

async function deleteArchivedItem(id) {
    if (!confirm("⚠️ WARNING: This will permanently delete the item from the archive. Are you sure?")) {
        return;
    }

    try {
        const archiveRef = ref(db, `archive/${id}`);
        const itemSnap = await get(archiveRef);
        
        if (!itemSnap.exists()) {
            alert("Archived item not found!");
            return;
        }

        const itemData = itemSnap.val();
        await remove(archiveRef); // Permanently delete from Firebase

        logActivity(
            "Permanently Deleted Item",
            `Item Name: ${itemData.item} | Item Code: ${itemData.itemCode} (from Archive)`
        );

        alert("Item permanently deleted successfully!");
        loadArchivedItems(); // Reload the list
    } catch (error) {
        console.error("Failed to delete archived item:", error);
        alert("An error occurred while deleting the item.");
    }
}

// Loads archived items from Firebase (REMINDER)
async function loadArchivedItems() {
  archiveTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Loading...</td></tr>`;
  try {
    const snapshot = await get(ref(db, "archive"));
    if (!snapshot.exists()) {
      archiveTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;">No archived items found.</td></tr>`;
      return;
    }

    archiveTableBody.innerHTML = "";
    snapshot.forEach((child) => {
      const data = child.val();
      const id = child.key;

      const imageCell = data.imageUrl
        ? `<td><img src="${data.imageUrl}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;"></td>`
        : `<td style="text-align:center;color:#999;font-size:12px;">No image</td>`;

      const totalValue = (data.quantity * data.unitPrice).toFixed(2);

      archiveTableBody.innerHTML += `
        <tr>
          <td>${data.itemCode || ""}</td>
          ${imageCell}
          <td>${data.item || ""}</td>
          <td>${data.category || ""}</td>
          <td>${data.quantity || 0}</td>
          <td>${data.unitPrice?.toFixed(2) || "0.00"}</td>
          <td>${totalValue}</td>
          <td>${data.expiry || ""}</td>
          <td>${data.archivedAt ? new Date(data.archivedAt).toLocaleString() : ""}</td>
          <td style="margin-bottom: 10px;">
            <button class="restoreBtn" data-id="${id}" style="background-color: #ede4e4;">Restore</button>
            <button class="deleteArchiveBtn" data-id="${id}" style="background-color: #dc3545; color: white;">Delete</button>
        </td>
          
        </tr>
      `;
    });

    document.querySelectorAll(".deleteArchiveBtn").forEach((btn) => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                deleteArchivedItem(id);
            };
        });

document.querySelectorAll(".restoreBtn").forEach((btn) => {
  btn.onclick = async () => {
    const id = btn.dataset.id;
    if (!confirm("Do you want to restore this item back to inventory?")) return;

    const archiveRef = ref(db, `archive/${id}`);
    const itemSnap = await get(archiveRef);

    if (!itemSnap.exists()) {
      alert("Archived item not found!");
      return;
    }

    const itemData = itemSnap.val();

    const newItemRef = push(ref(db, "inventory"));
    await set(newItemRef, {
      item: itemData.item,
      category: itemData.category,
      quantity: itemData.quantity,
      unitPrice: itemData.unitPrice,
      totalValue: itemData.totalValue,
      expiry: itemData.expiry,
      imageUrl: itemData.imageUrl || "",
      itemCode: 0 
    });

    await set(ref(db, `products/${newItemRef.key}`), {
      name: itemData.item,
      category: itemData.category,
      quantity: itemData.quantity,
      price: itemData.unitPrice,
      imageUrl: itemData.imageUrl || "",
      itemCode: 0 
    });

    await remove(archiveRef);

   logActivity(
  "Restored Item",
  `Item Name: ${itemData.item} | Item Code: ${itemData.itemCode}`
);

    const inventorySnap = await get(ref(db, "inventory"));
    if (inventorySnap.exists()) {
      const items = [];
      inventorySnap.forEach((child) => {
        items.push({ key: child.key, data: child.val() });
      });

      items.sort((a, b) => Number(a.data.itemCode || 0) - Number(b.data.itemCode || 0));

      let newCode = 1000;
      for (const item of items) {
        const invRef = ref(db, `inventory/${item.key}`);
        const prodRef = ref(db, `products/${item.key}`);
        await update(invRef, { itemCode: newCode });
        await update(prodRef, { itemCode: newCode });
        item.data.itemCode = newCode;
        newCode++;
      }

      allItems = items.map(i => ({ id: i.key, ...i.data }));
      allItems.sort((a, b) => a.itemCode - b.itemCode); 
      renderTable(allItems); 
    }
    alert("Item restored successfully!");
    loadArchivedItems

  };
});

  } catch (error) {
    console.error("Failed to load archived items:", error);
    archiveTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:red;">Failed to load archived items.</td></tr>`;
  }
}

viewArchiveBtn.addEventListener("click", openArchivePopup);

  // RESUPPLY POPUP 
  const resupplyPopup = document.createElement("div");
  resupplyPopup.classList.add("popup-overlay");
  resupplyPopup.id = "resupplyPopup";
  resupplyPopup.style.display = "none";

  resupplyPopup.innerHTML = `
    <div class="popup" style="margin-top:60px;">
      <h2>Log Resupply</h2>
      <form id="resupplyForm">
        <label for="resupplyItem">Select Item to Resupply</label>
        <select id="resupplyItem" required> <option value="">-- Choose Item --</option> </select>
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

  resupplyItemSelect?.addEventListener("change", async (e) => {
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

  resupplyBtn?.addEventListener("click", async () => {
    await populateResupplyDropdown();
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("resupplyDate").value = today;
    document.getElementById("resupplyNewExpiry").value = today;
    resupplyItemExpiryBox.style.display = "none";
    resupplyPopup.style.display = "flex";
  });

  cancelResupply?.addEventListener("click", () => {
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

      logActivity(
  "Resupply",
  `Item: ${currentData.item}, Added: ${addedQty}, Old Qty: ${oldQty}, New Qty: ${newQty}`
);


      alert(`${addedQty} units added to "${currentData.item}" (new stock: ${newQty})\nNew Expiry: ${newExpiry}`);
      resupplyPopup.style.display = "none";
      resupplyForm.reset();
      resupplyItemExpiryBox.style.display = "none";
    } catch (error) {
      console.error("Resupply update failed:", error);
      alert("Something went wrong updating the inventory.");
    }
  });

// EDIT POPUP 

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
    <h3>Edit</h3>
    <form id="editItemForm">
      <input type="hidden" id="editId">
      <label>Quantity:</label>
      <input type="number" id="editQuantity" required><br><br>
      <label>Unit Price:</label>
      <input type="number" id="editPrice" step="0.01" required><br><br>

      <div id="currentImageDisplay" style="text-align:center; margin-bottom: 15px;"> </div>

      <label for="editImageFile">Change Image:</label>
      <input type="file" id="editImageFile" accept="image/*"><br><br>

      <button type="submit">Update</button>
      <button type="button" id="cancelEdit">Cancel</button>
    </form>
  </div>
  `;
  document.body.appendChild(editModal);

const editForm = document.getElementById("editForm");
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
  document.getElementById("editImageFile").value = ""; // Clear file input on open

    const imageDisplay = document.getElementById("currentImageDisplay");
    if (currentImageUrl) {
        imageDisplay.innerHTML = `
            <img src="${currentImageUrl}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px; border: 1px solid #ccc;"><br>
            <small>Current Image</small>
        `;
    } else {
        imageDisplay.innerHTML = `<small>No current image</small>`;
    }
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
        
      // Pass the current image URL to the popup function
      openEditPopup(id, data.quantity, data.unitPrice, data.imageUrl); 
    };
  });
}

  editForm?.addEventListener("submit", async (e) => {
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

const snapshot = await get(ref(db, `inventory/${id}`));
    const currentData = snapshot.val();

    // 🔥 Updated log format
    logActivity(
      "Edited Item",
      `Item Name: ${currentData.item} | New Qty: ${newQty} | New Price: ${newPrice}`
    );

      alert("Item updated successfully!");
      closeEditPopup();
    } catch (error) {
      console.error("Update failed:", error);
      alert(" Failed to update item.");
    }
  });


  //
 // ARCHIVE BUTTON IN ACTIONS
function attachArchiveHandlers() {
  document.querySelectorAll(".deleteBtn").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (!confirm("Are you sure you want to archive this item?")) return;

      const itemRef = ref(db, `inventory/${id}`);
      const productRef = ref(db, `products/${id}`);
      const archiveRef = ref(db, `archive/${id}`);

      const snapshot = await get(itemRef);

      if (!snapshot.exists()) {
        alert("Item not found.");
        return;
      }

      const itemData = snapshot.val();
      itemData.archivedAt = new Date().toISOString();

      // STEP 1: move to archive
      await set(archiveRef, itemData);
      await remove(itemRef);

      // STEP 1B: UPDATE the 'products' node instead of deleting it.
      // This preserves category/price for past sales records in the dashboard.
      // We also set quantity to 0 and isArchived to true to hide it from PoS.
      await update(productRef, {
  isArchived: true, // Flag to indicate it's archived
  quantity: 0,      // Set quantity to 0 to make it unavailable for sale/PoS
  category: itemData.category, // <— CRITICAL: Explicitly ensure the category is saved
  name: itemData.item,
  price: itemData.unitPrice,// Keep the price
      });
      

      logActivity(
  "Archived Item",
  `Item: ${itemData.item}, Code: ${itemData.itemCode}`
);

      // STEP 2: Re-sequence inventory
      const inventorySnap = await get(ref(db, "inventory"));
      if (inventorySnap.exists()) {
        let items = [];

        inventorySnap.forEach(child => {
          const data = child.val();
          items.push({
            key: child.key,
            itemCode: Number(data.itemCode) || 0,
            data: data
          });
        });

        items.sort((a, b) => a.itemCode - b.itemCode);

        let newCode = 1000;
        for (const item of items) {
          await update(ref(db, `inventory/${item.key}`), { itemCode: newCode });
          await update(ref(db, `products/${item.key}`), { itemCode: newCode });
          item.data.itemCode = newCode;
          newCode++;
        }

        if (typeof allItems !== "undefined") {
          allItems = items.map(i => ({
            id: i.key,
            ...i.data
          }));

          allItems.sort((a, b) => a.itemCode - b.itemCode);

          renderTable(allItems); 
        }
      }

      alert("Item archived and item codes re-sequenced correctly.");
    };
  });
}


  // ----------------- STOCK + EXPIRY ALERTS -----------------
  onValue(inventoryRef, (snapshot) => {
    if (!snapshot.exists()) return;

    const lowStockItems = [];
    const noStockItems = [];
    const expiredItems = [];
    const expiryWarnings = [];

    const today = new Date();

    snapshot.forEach((childSnap) => {
      const data = childSnap.val();
      const quantity = Number(data.quantity ?? 0);
      const itemName = data.item ?? "Unnamed Item";
      const expiry = data.expiry;

      if (quantity === 0) {
        noStockItems.push(itemName);
      } else if (quantity <= 10) {
        lowStockItems.push(itemName);
      }

     if (expiry) {
  const expiryDate = new Date(expiry);
  const diffTime = expiryDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // If expired (diffDays < 0)
  if (diffDays <= 0) {
    expiredItems.push(`${itemName} has already EXPIRED.`);
  }

  // If expiring soon (0 to 15 days)
  if (diffDays <= 15 && diffDays >= 1) {
    expiryWarnings.push(`${itemName} will expire in ${diffDays} day(s).`);
  }
}
});

// SHOW ALERTS
if (noStockItems.length > 0) {
  alert("⚠️ The following items have NO STOCK:\n\n" + noStockItems.join("\n"));
}

if (lowStockItems.length > 0) {
  alert("⚠️ The following items are LOW in stock:\n\n" + lowStockItems.join("\n"));
}

if (expiredItems.length > 0) {
  alert("⚠️ EXPIRED ITEMS ⚠️\n\n" + expiredItems.join("\n"));
}

if (expiryWarnings.length > 0) {
  alert("⚠️ EXPIRY WARNING ⚠️\n\n" + expiryWarnings.join("\n"));
}

  }, { onlyOnce: true });

});

