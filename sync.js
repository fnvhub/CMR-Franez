// ██ SYNC MODULE ██
// Sincroniza state entre LocalStorage y Firestore

// Esperar a que Firebase esté listo
window.addEventListener('firebaseReady', function() {
  initSync();
});

let syncInProgress = false;
const SYNC_COLLECTION = 'appData';
const SYNC_DOC_ID = 'user-data';
const SYNC_INTERVAL = 3000; // Sincronizar cada 3 segundos

function initSync() {
  console.log("🔄 Iniciando sincronización...");
  
  // 1. Cargar datos de Firestore al abrir la app
  loadFromFirebase();
  
  // 2. Escuchar cambios en Firestore en tiempo real
  listenToFirebaseChanges();
  
  // 3. Sincronizar cambios locales periódicamente
  setInterval(syncLocalToFirebase, SYNC_INTERVAL);
  
  console.log("✓ Sincronización iniciada");
}

// Cargar datos de Firestore
function loadFromFirebase() {
  if (!fbUser) {
    console.warn("⚠ Usuario no autenticado aún");
    return;
  }
  
  db.collection(SYNC_COLLECTION).doc(SYNC_DOC_ID).get().then(function(doc) {
    if (doc.exists) {
      const remoteData = doc.data();
      console.log("📥 Datos descargados de Firestore");
      
      // Hacer merge inteligente: los datos remotos más nuevos reemplazan los locales
      mergeStateWithRemote(remoteData);
    } else {
      console.log("📄 Primera vez: no hay datos en Firestore");
    }
  }).catch(function(error) {
    console.error("Error al cargar de Firestore:", error);
  });
}

// Escuchar cambios en Firestore en tiempo real
function listenToFirebaseChanges() {
  if (!fbUser) return;
  
  db.collection(SYNC_COLLECTION).doc(SYNC_DOC_ID).onSnapshot(function(doc) {
    if (doc.exists && !syncInProgress) {
      const remoteData = doc.data();
      console.log("🔔 Cambios detectados en Firestore");
      
      // Solo actualizar si los datos remotos son más nuevos
      mergeStateWithRemote(remoteData);
    }
  }).catch(function(error) {
    console.error("Error al escuchar Firestore:", error);
  });
}

// Merge inteligente de datos
function mergeStateWithRemote(remoteData) {
  if (!state || !remoteData) return;
  
  // Para cada propiedad de state, comparar timestamps
  for (let key in state) {
    if (Array.isArray(state[key]) && Array.isArray(remoteData[key])) {
      // Para arrays: merge por ID
      state[key] = mergeArrays(state[key], remoteData[key]);
    } else if (typeof state[key] === 'object' && state[key] !== null && remoteData[key]) {
      // Para objetos: reemplazar si el remoto es más nuevo
      if (remoteData[key]._ts > (state[key]._ts || 0)) {
        state[key] = remoteData[key];
      }
    } else if (remoteData[key] !== undefined) {
      // Para valores simples: usar el remoto
      state[key] = remoteData[key];
    }
  }
  
  // Guardar localmente y refrescar UI
  saveToLocalStorage();
  console.log("✓ State actualizado con datos remotos");
  
  // Disparar evento para que CMR.js sepa que refrescar UI
  window.dispatchEvent(new CustomEvent('stateUpdated'));
}

// Merge de arrays por ID
function mergeArrays(local, remote) {
  if (!Array.isArray(remote)) return local;
  if (!Array.isArray(local)) return remote;
  
  let merged = local.slice();
  
  remote.forEach(function(rItem) {
    if (!rItem || !rItem.id) return;
    
    let idx = merged.findIndex(function(l) { return l.id === rItem.id; });
    if (idx === -1) {
      // Item nuevo en remoto: agregarlo
      merged.push(rItem);
    } else {
      // Item existe: usar el más nuevo (por timestamp)
      let lTs = merged[idx]._ts || 0;
      let rTs = rItem._ts || 0;
      if (rTs > lTs) {
        merged[idx] = rItem;
      }
    }
  });
  
  return merged;
}

// Sincronizar cambios locales a Firestore
function syncLocalToFirebase() {
  if (!fbUser || !state || syncInProgress) return;
  
  syncInProgress = true;
  
  // Agregar timestamps a los datos
  let dataToSync = JSON.parse(JSON.stringify(state));
  dataToSync._lastSync = new Date().getTime();
  
  db.collection(SYNC_COLLECTION).doc(SYNC_DOC_ID).set(dataToSync, {merge: false})
    .then(function() {
      console.log("📤 Datos sincronizados a Firestore");
      syncInProgress = false;
    })
    .catch(function(error) {
      console.error("Error al sincronizar:", error);
      syncInProgress = false;
      
      // Si no hay conexión, intentar de nuevo en 5 segundos
      if (!navigator.onLine) {
        console.warn("⚠ Sin conexión. Se reintentará al reconectar");
        setTimeout(syncLocalToFirebase, 5000);
      }
    });
}

// Guardar en localStorage
function saveToLocalStorage() {
  if (!state) return;
  try {
    localStorage.setItem('cmrState', JSON.stringify(state));
  } catch (e) {
    console.error("Error al guardar en localStorage:", e);
  }
}

// Cargar desde localStorage
function loadFromLocalStorage() {
  try {
    let saved = localStorage.getItem('cmrState');
    if (saved) {
      let parsed = JSON.parse(saved);
      // Merge con state existente
      for (let key in parsed) {
        state[key] = parsed[key];
      }
      console.log("✓ Datos cargados desde localStorage");
      return true;
    }
  } catch (e) {
    console.error("Error al cargar localStorage:", e);
  }
  return false;
}

// Agregar timestamp a items cuando se crean/modifican
function addTimestamp(obj) {
  if (obj && typeof obj === 'object') {
    obj._ts = new Date().getTime();
  }
  return obj;
}

// Listener para detectar cuando la app recupera conexión
window.addEventListener('online', function() {
  console.log("🌐 Conexión restaurada. Sincronizando...");
  syncLocalToFirebase();
});

window.addEventListener('offline', function() {
  console.log("📵 Sin conexión. Los cambios se guardarán localmente.");
});
