
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyBoZdu6XiF70_x3HwJttP6e639h-5IKWsE",
  authDomain: "vht-naturals.firebaseapp.com",
  projectId: "vht-naturals",
  storageBucket: "vht-naturals.firebasestorage.app",
  messagingSenderId: "436056260553",
  appId: "1:436056260553:web:22b7bab3c602522c26f218",
  measurementId: "G-9HZX3XZJL2"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

  const submit = document.getElementById('submit');
  submit.addEventListener("click", (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        alert("Login successful! Welcome " + user.email);

        window.location.href = "html/dashboard.html";
      })
      .catch((error) => { 
        alert("Error: " + error.message);
      });
  });
