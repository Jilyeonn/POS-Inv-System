import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

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

const auth = getAuth(app);


// Key used to signal a fresh login to the activity log listener
const LOGGED_IN_FLAG_KEY = "freshLogin"; 

const submit = document.getElementById('submit');

submit.addEventListener("click", (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value.trim(); // Added .trim() for robustness
    const password = document.getElementById('password').value.trim(); // Added .trim() for robustness

    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        
        // 🔥 CRITICAL STEP: Set the flag BEFORE redirection
        sessionStorage.setItem(LOGGED_IN_FLAG_KEY, 'true'); 

        alert("Login successful! Welcome " + user.email);

        window.location.href = "html/dashboard.html";
      })
      .catch((error) => { 
        // OPTIONAL: Ensure the flag is not set if the login fails
        sessionStorage.removeItem(LOGGED_IN_FLAG_KEY);
        
        // Log the detailed error to console for debugging
        console.error("Login Error:", error); 
        
        // Display a user-friendly error
        alert("Incorrect email or password. Please try again.");
      });
});
   // ✅ Reset Password Function
    resetBtn.addEventListener('click', async () => {
      const email = document.getElementById('resetEmail').value.trim();
      if (!email) {
        alert("Please enter your email address.");
        return;
      }

      try {
        await sendPasswordResetEmail(auth, email);
        alert("Password reset link sent to: " + email);
        resetPopup.style.display = 'none';
      } catch (error) {
        alert("Error: " + error.message);
      }
    });