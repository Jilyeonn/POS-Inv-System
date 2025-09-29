import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

  const addItemFormContainer = document.createElement("div");
  addItemFormContainer.id = "addItemFormContainer";
  addItemFormContainer.style.display = "none";
  addItemFormContainer.style.marginTop = "20px";
  addItemFormContainer.innerHTML = `
    <h3>Add New Item</h3>
    <form id="addItemForm">
      <input type="text" id="newItem" placeholder="Item Name" required>
      <input type="text" id="newCategory" placeholder="Category" required>
      <input type="number" id="newQuantity" placeholder="Quantity" required>
      <input type="date" id="newExpiry" required>
      <button type="submit">Add Item</button>
      <button type="button" id="cancelAdd">Cancel</button>
    </form>
  `;
  tbody.parentElement.after(addItemFormContainer);

  const addItemForm = document.getElementById("addItemForm");
  const cancelAdd = document.getElementById("cancelAdd");

  addBtn.addEventListener("click", () => {
    addItemFormContainer.style.display = "block";
  });

  cancelAdd.addEventListener("click", () => {
    addItemFormContainer.style.display = "none";
    addItemForm.reset();
  });

  onValue(inventoryRef, (snapshot) => {
    tbody.innerHTML = "";
    snapshot.forEach((childSnap) => {
      const data = childSnap.val();
      const id = childSnap.key;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${data.item ?? ""}</td>
        <td>${data.category ?? ""}</td>
        <td>${data.quantity ?? ""}</td>
        <td>${data.expiry ?? ""}</td>
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

  addItemForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const item = document.getElementById("newItem").value.trim();
    const category = document.getElementById("newCategory").value.trim();
    const quantity = document.getElementById("newQuantity").value.trim();
    const expiry = document.getElementById("newExpiry").value;

    if (/\d/.test(category)) {
      alert("Category cannot contain numbers. Please enter a valid category.");
      return;
    }

    try {
      await push(inventoryRef, { item, category, quantity: Number(quantity), expiry });
      addItemFormContainer.style.display = "none";
      addItemForm.reset();
    } catch (e) {
      console.error("Add failed:", e);
      alert("Add failed. Check Firebase config.");
    }
  });

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
      btn.onclick = async () => {
        const row = btn.closest("tr");
        const id = btn.dataset.id;
        const currentQty = row.children[2].textContent;
        const newQty = prompt("Enter new quantity:", currentQty);
        if (!newQty || isNaN(newQty)) return alert("Please enter a valid number");

        try {
          await set(ref(db, `inventory/${id}/quantity`), Number(newQty));
        } catch (e) {
          console.error("Edit failed:", e);
          alert("Failed to update quantity");
        }
      };
    });
  }

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
