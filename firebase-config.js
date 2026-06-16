const firebaseConfig = {
    apiKey: "AIzaSyDRLnS3dcieybMTVqgVJtUuf4E5xBC9HXQ",
    authDomain: "k-a-boutique.firebaseapp.com",
    databaseURL: "https://k-a-boutique-default-rtdb.firebaseio.com",
    projectId: "k-a-boutique",
    storageBucket: "k-a-boutique.firebasestorage.app",
    messagingSenderId: "163536158997",
    appId: "1:163536158997:web:d7f6d2c6481196e489691c",
    measurementId: "G-HKZ2KCQWMF"
};

let app, auth, database;

try {
    if (firebase.apps.length) {
        app = firebase.app();
    } else {
        app = firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    database = firebase.database();
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Firebase initialization error:", error);
}

export { app, auth, database };