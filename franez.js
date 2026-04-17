var state = {
  clientes:[],productos:[],ofertas:[],
  pedidos:[
    {clienteId:'',ofertaId:'',lineas:[],portes:'auto',dtoActual:0,notas:''},
    {clienteId:'',ofertaId:'',lineas:[],portes:'auto',dtoActual:0,notas:''},
    {clienteId:'',ofertaId:'',lineas:[],portes:'auto',dtoActual:0,notas:''}
  ],
  historial:[],stock:{},delegado:'',campanas:[],
  config:{umbralUnidades:12,umbralPedidos:2,margenMinDto:3},
  rutaDia:{fecha:'',clientes:[]},
  acumuladoMensual:{}
};
var currentOrder=0;
var cbCliente,cbProducto,cbIACliente;
var iaResultado=null;
var filtroClientes='todos';
var filtroEscalado='todos';

// ██ BLOQUE:ESTADO-GLOBAL-FIN ██

// ██ BLOQUE:UTILIDADES-INICIO ██
function uid(){return 'id_'+Date.now()+'_'+Math.floor(Math.random()*99999);}
function fm(v){v=parseFloat(v)||0;return v.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+'\u00a0\u20ac';}
function fmPlain(v){v=parseFloat(v)||0;return v.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' EUR';}
function fmNum(v){v=parseFloat(v)||0;return v.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});}
function cleanPrice(s){
  if(!s) return 0;
  s=String(s).trim().replace(/[^\d,\.]/g,'').trim();
  if(!s) return 0;
  var hasComma=s.indexOf(',')>-1,hasPoint=s.indexOf('.')>-1;
  if(hasComma&&hasPoint){if(s.lastIndexOf(',')>s.lastIndexOf('.')){s=s.replace(/\./g,'').replace(',','.');}else{s=s.replace(/,/g,'');}}
  else if(hasComma){var parts=s.split(',');if(parts.length===2&&parts[1].length>=1&&parts[1].length<=2){s=s.replace(',','.');}else{s=s.replace(/,/g,'');}}
  else if(hasPoint){var partsP=s.split('.');if(partsP.length===2&&partsP[1].length===3){s=s.replace(/\./g,'');}}
  return parseFloat(s)||0;
}
function parseContrato(str){
  if(!str) return null;
  var m;
  if(m=str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)){return new Date(+m[3],+m[2]-1,+m[1]);}
  if(m=str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)){return new Date(+m[1],+m[2]-1,+m[3]);}
  return null;
}
function formatContratoDisplay(str){var d=parseContrato(str);if(!d) return str||'';return ('0'+d.getDate()).slice(-2)+'/'+ ('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();}
function todayStr(){var d=new Date();return ('0'+d.getDate()).slice(-2)+'/'+ ('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();}
function nowStr(){var d=new Date();return todayStr()+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
function genRef(){return 'PED-'+Date.now().toString(36).toUpperCase();}
function detectSep(line){var sc=(line.match(/;/g)||[]).length,cc=(line.match(/,/g)||[]).length;return sc>=cc?';':',';}
function escH(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function sortProductos(arr){return arr.slice().sort(function(a,b){var oa=a.orden?a.orden.trim().toUpperCase():'ZZZZ',ob=b.orden?b.orden.trim().toUpperCase():'ZZZZ';if(oa!==ob) return oa<ob?-1:1;return (a.nombre||'').localeCompare(b.nombre||'','es');});}
function sortClientes(arr){return arr.slice().sort(function(a,b){var ca=(a.compra||'').toUpperCase()==='SI'?0:1,cb=(b.compra||'').toUpperCase()==='SI'?0:1;if(ca!==cb) return ca-cb;return (a.nombreCompleto||'').localeCompare(b.nombreCompleto||'','es');});}
function isProductoSinStock(id){return state.stock[id]===true;}
function getClienteById(id){return state.clientes.find(function(c){return c.id===id;})||null;}
function getProductoById(id){return state.productos.find(function(p){return p.id===id;})||null;}
function getOfertaById(id){return state.ofertas.find(function(o){return o.id===id;})||null;}
// Normalizar campo compra
function normalizarCompra(val){
  if(!val) return 'NO';
  return val.trim().toUpperCase().startsWith('S') ? 'SI' : 'NO';
}
var TRAMOS=[
  {min:0,max:1499.99,dto:30,obj:0,rfa:0,p1:50,sig:50},
  {min:1500,max:3499.99,dto:34,obj:3500,rfa:2,p1:120,sig:50},
  {min:3500,max:4999.99,dto:36,obj:5000,rfa:2,p1:400,sig:120},
  {min:5000,max:9999.99,dto:38,obj:10000,rfa:2,p1:400,sig:120},
  {min:10000,max:14999.99,dto:40,obj:15000,rfa:2,p1:800,sig:150},
  {min:15000,max:19999.99,dto:42,obj:20000,rfa:2,p1:800,sig:150},
  {min:20000,max:29999.99,dto:44,obj:30000,rfa:1,p1:1500,sig:300}
];
function getTramoByDto(dto){var t=TRAMOS[0];for(var i=0;i<TRAMOS.length;i++){if(dto>=TRAMOS[i].dto) t=TRAMOS[i];}return t;}
function getTramoByVol(vol){var t=TRAMOS[0];for(var i=0;i<TRAMOS.length;i++){if(vol>=TRAMOS[i].min) t=TRAMOS[i];}return t;}

// ██ BLOQUE:UTILIDADES-FIN ██

// ██ BLOQUE:TOAST-INICIO ██
function toast(msg,type){
  type=type||'ok';
  var c=document.getElementById('toast-container');
  var el=document.createElement('div');
  el.className='toast '+type;
  el.textContent=msg;
  c.appendChild(el);
  setTimeout(function(){if(el.parentNode) el.parentNode.removeChild(el);},3200);
}

// ██ BLOQUE:TOAST-FIN ██

// ██ BLOQUE:LOCAL-STORAGE-INICIO ██
function mergeById(local, remote) {
  if (!Array.isArray(remote)) return local;
  if (!Array.isArray(local)) return remote;
  var merged = local.slice();
  remote.forEach(function(rItem) {
    if (!rItem || !rItem.id) return;
    var idx = merged.findIndex(function(l) { return l.id === rItem.id; });
    if (idx === -1) {
      merged.push(rItem);
    } else {
      var lTs = merged[idx]._ts || 0;
      var rTs = rItem._ts || 0;
      if (rTs > lTs) merged[idx] = rItem;
    }
  });
  return merged;
}
function saveState(){
  var now = Date.now();
  localStorage.setItem('clientes',JSON.stringify(state.clientes));
  localStorage.setItem('productos',JSON.stringify(state.productos));
  localStorage.setItem('ofertas',JSON.stringify(state.ofertas));
  localStorage.setItem('pedidos',JSON.stringify(state.pedidos));
  localStorage.setItem('historial',JSON.stringify(state.historial));
  localStorage.setItem('stock',JSON.stringify(state.stock));
  localStorage.setItem('delegado',state.delegado||'');
  localStorage.setItem('campanas',JSON.stringify(state.campanas));
  localStorage.setItem('config',JSON.stringify(state.config));
  localStorage.setItem('acumuladoMensual',JSON.stringify(state.acumuladoMensual||{}));
  localStorage.setItem('franez_ts', now);
  // Subir a Firebase si está disponible
  if (window._fbDb && window._fbSet && window._fbRef) {
    try {
      var payload = {
        clientes: state.clientes,
        productos: state.productos,
        ofertas: state.ofertas,
        historial: state.historial,
        stock: state.stock,
        delegado: state.delegado||'',
        campanas: state.campanas,
        config: state.config,
        acumuladoMensual: state.acumuladoMensual||{},
        _ts: now
      };
      window._fbSet(window._fbRef(window._fbDb, 'franez'), payload);
    } catch(e) { console.warn('Firebase saveState error:', e); }
  }
}
function savePedidos(){
  localStorage.setItem('pedidos',JSON.stringify(state.pedidos));
  if (window._fbDb && window._fbSet && window._fbRef) {
    try { window._fbSet(window._fbRef(window._fbDb, 'franez/pedidos'), state.pedidos); } catch(e){}
  }
}
function loadState(){
  function tryParse(key,def){try{var v=localStorage.getItem(key);return v?JSON.parse(v):def;}catch(e){return def;}}
  // Intentar merge con Firebase al arrancar
  if (window._fbDb && window._fbGet && window._fbRef) {
    window._fbGet(window._fbRef(window._fbDb, 'franez')).then(function(snapshot) {
      if (!snapshot.exists()) return;
      var remote = snapshot.val();
      var localTs = parseInt(localStorage.getItem('franez_ts')||'0');
      var remoteTs = remote._ts || 0;
      if (remoteTs <= localTs) return; // local es más reciente, no hacer nada
      // Remote es más reciente: merge por ID en colecciones, replace en el resto
      if (remote.clientes) state.clientes = mergeById(state.clientes, remote.clientes);
      if (remote.productos) state.productos = mergeById(state.productos, remote.productos);
      if (remote.ofertas) state.ofertas = mergeById(state.ofertas, remote.ofertas);
      if (remote.historial) state.historial = mergeById(state.historial, remote.historial);
      if (remote.campanas) state.campanas = mergeById(state.campanas, remote.campanas);
      if (remote.stock) state.stock = Object.assign({}, state.stock, remote.stock);
      if (remote.delegado) state.delegado = remote.delegado;
      if (remote.config) state.config = Object.assign({}, state.config, remote.config);
      if (remote.acumuladoMensual) state.acumuladoMensual = Object.assign({}, state.acumuladoMensual, remote.acumuladoMensual);
      localStorage.setItem('franez_ts', remoteTs);
      // Guardar merged en localStorage
      localStorage.setItem('clientes',JSON.stringify(state.clientes));
      localStorage.setItem('productos',JSON.stringify(state.productos));
      localStorage.setItem('ofertas',JSON.stringify(state.ofertas));
      localStorage.setItem('historial',JSON.stringify(state.historial));
      localStorage.setItem('campanas',JSON.stringify(state.campanas));
      localStorage.setItem('stock',JSON.stringify(state.stock));
      localStorage.setItem('delegado',state.delegado||'');
      localStorage.setItem('config',JSON.stringify(state.config));
      localStorage.setItem('acumuladoMensual',JSON.stringify(state.acumuladoMensual));
      // Refrescar UI con datos mergeados
      renderClientesList && renderClientesList();
      renderHistorial && renderHistorial();
      renderStats && renderStats();
      toast('✓ Sincronizado con la nube');
    }).catch(function(e){ console.warn('Firebase loadState error:', e); });
  }
  state.clientes=tryParse('clientes',[]);
  state.productos=tryParse('productos',[]);
  state.ofertas=tryParse('ofertas',[]);
  var p=tryParse('pedidos',[]);
  if(!Array.isArray(p)||p.length<3){
    state.pedidos=[{clienteId:'',ofertaId:'',lineas:[],portes:'auto',dtoActual:0,notas:''},{clienteId:'',ofertaId:'',lineas:[],portes:'auto',dtoActual:0,notas:''},{clienteId:'',ofertaId:'',lineas:[],portes:'auto',dtoActual:0,notas:''}];
  } else {
    state.pedidos=p;
    for(var i=0;i<3;i++){if(!state.pedidos[i]) state.pedidos[i]={clienteId:'',ofertaId:'',lineas:[],portes:'auto',dtoActual:0,notas:''};}
  }
  state.historial=tryParse('historial',[]);
  state.stock=tryParse('stock',{});
  state.delegado=localStorage.getItem('delegado')||'';
  state.campanas=tryParse('campanas',[]);
  (function(){
    var hoy=new Date(),cutoff=10*24*60*60*1000;
    state.campanas=state.campanas.filter(function(camp){
      if(!camp.campanaFin) return true;
      var p=camp.campanaFin.split('-');
      if(p.length!==3) return true;
      var fin=new Date(+p[0],+p[1]-1,+p[2]);
      return (hoy-fin)<cutoff;
    });
  })();
  var cfgDef={umbralUnidades:12,umbralPedidos:2,margenMinDto:3};
  state.config=Object.assign({},cfgDef,tryParse('config',{}));
  state.acumuladoMensual=tryParse('acumuladoMensual',{});
}

// ██ BLOQUE:LOCAL-STORAGE-FIN ██

// ██ BLOQUE:NAVEGACION-INICIO ██
function showPanel(name,btn){
  document.querySelectorAll('.panel').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.nav-btn').forEach(function(b){b.classList.remove('active');});
  document.getElementById('panel-'+name).classList.add('active');
  if(btn) btn.classList.add('active');
  // Mostrar/ocultar barra inferior solo en pedidos
  var barra=document.getElementById('barra-pedido');
  if(name==='pedidos'){barra.classList.add('visible');}else{barra.classList.remove('visible');}
  if(name==='clientes'){
    renderClientesList();
    setTimeout(initProdHabInput,100);
    // Rellenar datalist de zonas
    var dl=document.getElementById('zonas-datalist');
    if(dl){
      var zonas=getZonasDisponibles();
      dl.innerHTML=zonas.map(function(z){return '<option value="'+z+'">';}).join('');
    }
  }
  if(name==='productos') renderProductosList();
  if(name==='ofertas') renderOfertasList();
  if(name==='stock') renderStockList();
  if(name==='escalado') renderEscalado();
  if(name==='historial') renderHistorial();
  if(name==='ajustes'){renderStats();var d=document.getElementById('ajuste-delegado');if(d) d.value=state.delegado;renderZonasList();}
  if(name==='ia') initIAPanel();
  if(name==='campanas') renderCampanas();
  if(name==='visitas'){loadRuta();initVisitasPanel();}
}

// ██ BLOQUE:NAVEGACION-FIN ██

// ██ BLOQUE:COMBOBOX-MOTOR-INICIO ██
function makeCombobox(inputId,listId,valId,getData,onSelect,getLabel,getSub){
  var inp=document.getElementById(inputId);
  var list=document.getElementById(listId);
  var hid=document.getElementById(valId);
  var activeIdx=-1,prevVal='';
  function getItems(q){var data=getData();if(!q) return data;var ql=q.toLowerCase();return data.filter(function(d){return getLabel(d).toLowerCase().indexOf(ql)>-1;});}
  function render(items){
    list.innerHTML='';
    if(!items.length){list.innerHTML='<div class="cb-empty">Sin resultados</div>';list.classList.add('open');activeIdx=-1;return;}
    items.forEach(function(item,i){
      var div=document.createElement('div');
      div.className='cb-item';
      div.setAttribute('data-idx',i);
      var lbl=escH(getLabel(item));
      var sub=getSub?getSub(item):'';
      var stock=(item.id&&isProductoSinStock(item.id))?' <span style="color:var(--red);font-size:11px">SIN STOCK</span>':'';
      div.innerHTML='<div>'+lbl+stock+'</div>'+(sub?'<div class="cb-item-sub">'+escH(sub)+'</div>':'');
      div.addEventListener('mousedown',function(e){e.preventDefault();selectItem(item);});
      list.appendChild(div);
    });
    list.classList.add('open');activeIdx=-1;
  }
  function setActive(idx,items){
    var els=list.querySelectorAll('.cb-item');
    els.forEach(function(el){el.classList.remove('active');});
    if(idx>=0&&idx<els.length){els[idx].classList.add('active');els[idx].scrollIntoView({block:'nearest'});}
    activeIdx=idx;
  }
  function selectItem(item){
    inp.value=getLabel(item);hid.value=item.id;prevVal=inp.value;
    list.classList.remove('open');activeIdx=-1;
    if(onSelect) onSelect(item.id,item);
  }
  inp.addEventListener('focus',function(){prevVal=inp.value;render(getItems(inp.value));});
  inp.addEventListener('input',function(){hid.value='';render(getItems(inp.value));});
  inp.addEventListener('keydown',function(e){
    var items=getItems(inp.value);
    var els=list.querySelectorAll('.cb-item');
    if(e.key==='ArrowDown'){e.preventDefault();setActive(Math.min(activeIdx+1,els.length-1),items);}
    else if(e.key==='ArrowUp'){e.preventDefault();setActive(Math.max(activeIdx-1,0),items);}
    else if(e.key==='Enter'){e.preventDefault();if(activeIdx>=0&&items[activeIdx]){selectItem(items[activeIdx]);}else if(items.length>0){selectItem(items[0]);}}
    else if(e.key==='Escape'){list.classList.remove('open');inp.value=prevVal;hid.value='';}
    else if(e.key==='Tab'){if(activeIdx>=0&&items[activeIdx]){selectItem(items[activeIdx]);}else if(items.length>0){selectItem(items[0]);}list.classList.remove('open');}
  });
  inp.addEventListener('blur',function(){setTimeout(function(){list.classList.remove('open');},150);});
  return {
    setValue:function(id){if(!id){inp.value='';hid.value='';prevVal='';return;}var item=getData().find(function(d){return d.id===id;});if(item){inp.value=getLabel(item);hid.value=id;prevVal=inp.value;}},
    clear:function(){inp.value='';hid.value='';prevVal='';}
  };
}

// ██ BLOQUE:COMBOBOX-MOTOR-FIN ██

// ██ BLOQUE:INICIALIZAR-COMBOBOXES-INICIO ██
function initComboboxes(){
  cbCliente=makeCombobox('cb-cliente-input','cb-cliente-list','cb-cliente-val',
    function(){return sortClientes(state.clientes);},
    function(id){onClienteChange(id);},
    function(c){return c.nombreCompleto;},
    function(c){return c.nombreComercial||c.localidad||'';}
  );
  cbProducto=makeCombobox('cb-producto-input','cb-producto-list','cb-producto-val',
    function(){return sortProductos(state.productos);},
    function(id){onProductoSelected(id);},
    function(p){return p.nombre;},
    function(p){return (p.pvp?fmPlain(p.pvp):'')+(p.orden?' ['+p.orden+']':'');}
  );
  cbIACliente=makeCombobox('cb-ia-cliente-input','cb-ia-cliente-list','cb-ia-cliente-val',
    function(){return sortClientes(state.clientes);},
    function(id){onIAClienteChange(id);},
    function(c){return c.nombreCompleto;},
    function(c){return c.nombreComercial||c.localidad||'';}
  );
  var btnAnadir=document.getElementById('btn-anadir');
  btnAnadir.addEventListener('keydown',function(e){
    if(e.key==='Enter'){e.preventDefault();addLinea();setTimeout(function(){document.getElementById('cb-producto-input').focus();},50);}
  });
}

// ██ BLOQUE:INICIALIZAR-COMBOBOXES-FIN ██

// ██ BLOQUE:PEDIDOS-INICIO ██
function switchOrder(idx){
  currentOrder=idx;
  document.querySelectorAll('.order-tab').forEach(function(t,i){t.classList.toggle('active',i===idx);});
  renderCurrentOrder();
}
function renderCurrentOrder(){
  var p=state.pedidos[currentOrder];
  cbCliente.setValue(p.clienteId);
  cbProducto.clear();
  document.getElementById('cb-producto-val').value='';
  document.getElementById('inp-uds').value='1';
  document.getElementById('inp-dto').value=p.dtoActual||'';
  document.getElementById('sel-oferta').value=p.ofertaId||'';
  document.getElementById('sel-portes').value=p.portes||'auto';
  document.getElementById('notas-pedido').value=p.notas||'';
  document.getElementById('stock-aviso-pedido').style.display='none';
  updateBadges();renderLineas();renderSummary();renderOfertaCounter();checkAlerts();updateClientPreview();
}
function onClienteChange(id){
  var p=state.pedidos[currentOrder];p.clienteId=id;
  var c=getClienteById(id);
  if(c&&!p.ofertaId){p.dtoActual=parseFloat(c.descuento)||0;document.getElementById('inp-dto').value=p.dtoActual;}
  savePedidos();updateBadges();renderSummary();checkAlerts();updateClientPreview();mostrarAvisosAcumulados(id);
}
function onOfertaChange(){
  var p=state.pedidos[currentOrder];
  var v=document.getElementById('sel-oferta').value;p.ofertaId=v;
  if(v){var o=getOfertaById(v);if(o){p.dtoActual=parseFloat(o.descuento)||0;document.getElementById('inp-dto').value=p.dtoActual;}}
  else{var c=getClienteById(p.clienteId);if(c){p.dtoActual=parseFloat(c.descuento)||0;document.getElementById('inp-dto').value=p.dtoActual;}}
  savePedidos();updateBadges();renderSummary();renderOfertaCounter();
}
function onProductoSelected(id){
  if(!id) return;
  var prod=getProductoById(id);if(!prod) return;
  var aviso=document.getElementById('stock-aviso-pedido');
  if(isProductoSinStock(id)){aviso.style.display='block';aviso.textContent='\u26a0 '+prod.nombre+' est\u00e1 marcado SIN STOCK';}
  else{aviso.style.display='none';}
  mostrarAvisoCampLinea(id);
}
function onNotasChange(){state.pedidos[currentOrder].notas=document.getElementById('notas-pedido').value;savePedidos();}
function onPortesChange(){var v=document.getElementById('sel-portes').value;state.pedidos[currentOrder].portes=v;savePedidos();renderSummary();}
function addLinea(){
  var prodId=document.getElementById('cb-producto-val').value;
  if(!prodId){toast('Selecciona un producto primero','err');document.getElementById('cb-producto-input').focus();return;}
  var prod=getProductoById(prodId);if(!prod){toast('Producto no encontrado','err');return;}
  var uds=parseInt(document.getElementById('inp-uds').value)||1;
  var dto=parseFloat(document.getElementById('inp-dto').value)||0;
  if(uds<1) uds=1;
  var p=state.pedidos[currentOrder];
  // Aviso producto duplicado
  var yaExiste=p.lineas.some(function(l){return l.prodId===prodId;});
  if(yaExiste){if(!confirm('\u26a0 '+prod.nombre+' ya est\u00e1 en el pedido.\n\u00bfA\u00f1adir otra l\u00ednea igualmente?')) return;}
  p.lineas.push({id:uid(),prodId:prodId,nombre:prod.nombre,pvp:prod.pvp,costo:prod.costo,dto:dto,uds:uds,notas:[]});
  savePedidos();renderLineas();renderSummary();renderOfertaCounter();
  cbProducto.clear();
  document.getElementById('stock-aviso-pedido').style.display='none';
  var avl=document.getElementById('aviso-camp-linea');if(avl) avl.classList.add('hidden');
  document.getElementById('inp-uds').value='1';
}
function updateLineaUds(idx,v){
  var linea=state.pedidos[currentOrder].lineas[idx];if(!linea) return;
  var n=parseInt(v)||1;if(n<1) n=1;
  linea.uds=n;
  savePedidos();renderSummary();renderOfertaCounter();
  // Re-render solo la celda total de esa fila sin re-renderizar toda la tabla
  var filas=document.getElementById('lines-tbody').querySelectorAll('tr');
  if(filas[idx]){
    var pvpSinIva=linea.pvp/1.10;var neto=pvpSinIva*(1-linea.dto/100);
    var total=neto*linea.uds;
    var celdas=filas[idx].querySelectorAll('td');
    if(celdas[6]) celdas[6].textContent=fmNum(total);
  }
}
function updateLineaDto(idx,v){
  var linea=state.pedidos[currentOrder].lineas[idx];if(!linea) return;
  linea.dto=parseFloat(v)||0;
  savePedidos();renderSummary();
  var filas=document.getElementById('lines-tbody').querySelectorAll('tr');
  if(filas[idx]){
    var pvpSinIva=linea.pvp/1.10;var neto=pvpSinIva*(1-linea.dto/100);
    var total=neto*linea.uds;
    var celdas=filas[idx].querySelectorAll('td');
    if(celdas[5]) celdas[5].textContent=fmNum(neto);
    if(celdas[6]) celdas[6].textContent=fmNum(total);
  }
}
function removeLinea(idx){
  state.pedidos[currentOrder].lineas.splice(idx,1);
  savePedidos();renderLineas();renderSummary();renderOfertaCounter();
}
function addNotaLinea(idx){
  var linea=state.pedidos[currentOrder].lineas[idx];if(!linea) return;
  if(!linea.notas) linea.notas=[];
  linea.notas.push({id:uid(),texto:''});
  savePedidos();renderLineas();
  // Focus en la nueva nota
  setTimeout(function(){
    var inputs=document.querySelectorAll('.nota-linea-input[data-linea="'+idx+'"]');
    if(inputs.length) inputs[inputs.length-1].focus();
  },50);
}
function updateNotaLinea(lineaIdx,notaIdx,val){
  var linea=state.pedidos[currentOrder].lineas[lineaIdx];if(!linea||!linea.notas) return;
  if(linea.notas[notaIdx]) linea.notas[notaIdx].texto=val;
  savePedidos();
}
function removeNotaLinea(lineaIdx,notaIdx){
  var linea=state.pedidos[currentOrder].lineas[lineaIdx];if(!linea||!linea.notas) return;
  linea.notas.splice(notaIdx,1);
  savePedidos();renderLineas();
}
function renderLineas(){
  var p=state.pedidos[currentOrder];
  var tbody=document.getElementById('lines-tbody');
  var empty=document.getElementById('lines-empty');
  var count=document.getElementById('lines-count');
  if(!p.lineas.length){tbody.innerHTML='';empty.style.display='block';count.textContent='';return;}
  empty.style.display='none';
  count.textContent='('+p.lineas.length+' l\u00ednea'+(p.lineas.length!==1?'s':'')+')';
  var html='';
  p.lineas.forEach(function(l,i){
    var pvpSinIva=l.pvp/1.10;var neto=pvpSinIva*(1-l.dto/100);
    var total=neto*l.uds;
    var prod=getProductoById(l.prodId);
    var envase=prod&&prod.unidades?prod.unidades:'';
    html+='<tr>'+
      '<td>'+escH(l.nombre)+
        ' <button onclick="addNotaLinea('+i+')" style="background:var(--slate2);color:var(--text2);border:none;border-radius:4px;width:20px;height:20px;font-size:13px;cursor:pointer;vertical-align:middle;line-height:1" title="A\u00f1adir nota">+</button>'+
      '</td>'+
      '<td><input type="number" value="'+l.uds+'" min="1" style="width:65px;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:6px;font-size:13px" '+
        'onchange="updateLineaUds('+i+',this.value)" onblur="updateLineaUds('+i+',this.value)" oninput="updateLineaUds('+i+',this.value)"></td>'+
      '<td style="font-size:12px;color:var(--text3);text-align:center">'+escH(String(envase))+'</td>'+
      '<td>'+fmNum(l.pvp)+'</td>'+
      '<td><input type="number" value="'+l.dto+'" min="0" max="99" style="width:58px;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:6px;font-size:13px" '+
        'onchange="updateLineaDto('+i+',this.value)" onblur="updateLineaDto('+i+',this.value)" oninput="updateLineaDto('+i+',this.value)"></td>'+
      '<td>'+fmNum(neto)+'</td>'+
      '<td style="font-weight:700;color:var(--cobalt-light)">'+fmNum(total)+'</td>'+
      '<td><button onclick="removeLinea('+i+')" style="background:var(--red);color:#fff;border:none;border-radius:6px;width:32px;height:32px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center" title="Eliminar">&times;</button></td>'+
    '</tr>';
    // Sublíneas de nota
    if(l.notas&&l.notas.length){
      l.notas.forEach(function(nota,ni){
        html+='<tr style="background:rgba(255,255,255,0.03)">'+
          '<td colspan="7" style="padding:3px 8px 3px 28px">'+
            '<div style="display:flex;align-items:center;gap:6px">'+
              '<span style="color:var(--text3);font-size:12px">\u21b3</span>'+
              '<input type="text" class="nota-linea-input" data-linea="'+i+'" value="'+escH(nota.texto)+'" placeholder="Nota aclaratoria..." '+
                'style="flex:1;background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text2);font-size:13px;padding:2px 4px;font-style:italic" '+
                'onchange="updateNotaLinea('+i+','+ni+',this.value)" onblur="updateNotaLinea('+i+','+ni+',this.value)">'+
              '<button onclick="removeNotaLinea('+i+','+ni+')" style="background:transparent;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:0 4px" title="Eliminar nota">&times;</button>'+
            '</div>'+
          '</td>'+
        '</tr>';
      });
    }
    // Entregas fraccionadas inline
    (function(){
      var nombre=(l.nombre||'').toUpperCase();
      var esPhilus=nombre.indexOf('PHILUS')>-1;
      var uds=parseInt(l.uds)||0;
      var aplica=(esPhilus&&uds>=48)||(!esPhilus&&uds>=12);
      if(!aplica) return;
      if(!p.entregasOverride) p.entregasOverride={};
      var key='linea_'+i;
      var ov=p.entregasOverride[key];
      var e1=ov&&ov.uds===uds?ov.e1:Math.floor(uds/2);
      var e2=uds-e1;
      html+='<tr style="background:rgba(37,99,235,0.07)">'+
        '<td colspan="8" style="padding:4px 8px 6px 28px">'+
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+
            '<span style="color:#60a5fa;font-size:12px;font-weight:700">\uD83D\uDCE6 2 env\u00edos:</span>'+
            '<input type="number" min="1" max="'+(uds-1)+'" value="'+e1+'" '+
              'style="width:52px;background:var(--slate2);border:1px solid #3b82f6;color:#fff;padding:3px 6px;border-radius:6px;font-size:13px;text-align:center" '+
              'oninput="updateEntregaOverride(\''+key+'\','+uds+',this.value,\'ent2-'+key+'\')" '+
              'onchange="updateEntregaOverride(\''+key+'\','+uds+',this.value,\'ent2-'+key+'\')" '+
              'title="Primer env\u00edo">'+
            '<span style="color:#60a5fa;font-size:13px;font-weight:700">+</span>'+
            '<span id="ent2-'+key+'" style="font-size:13px;font-weight:700;color:#93c5fd;min-width:24px;text-align:center">'+e2+'</span>'+
            '<span style="color:#60a5fa;font-size:12px">uds</span>'+
          '</div>'+
        '</td>'+
      '</tr>';
    })();
  });
  tbody.innerHTML=html;
}
function calcPedido(){
  var p=state.pedidos[currentOrder];
  var base=0,beneficio=0,totalUds=0;
  p.lineas.forEach(function(l){
    var pvpSinIva=l.pvp/1.10;var neto=pvpSinIva*(1-l.dto/100);
    base+=neto*l.uds;beneficio+=(pvpSinIva-neto)*l.uds;totalUds+=l.uds;
  });
  var iva=base*0.10,re=base*0.014,total=base+iva+re;
  var c=getClienteById(p.clienteId);
  var dtoC=c?parseFloat(c.descuento)||0:0;
  var umbral=(dtoC<=35)?50:120;
  var portesAuto=base>=umbral?'PAGADOS':'DEBIDOS';
  var portesReal=p.portes==='auto'?portesAuto:(p.portes==='pagados'?'PAGADOS':'DEBIDOS');
  return {base:base,iva:iva,re:re,total:total,beneficio:beneficio,totalUds:totalUds,umbral:umbral,portesAuto:portesAuto,portesReal:portesReal,pct:Math.min(base/umbral,1)};
}
function renderSummary(){
  var c=calcPedido();
  document.getElementById('sum-base').textContent=fmNum(c.base)+' \u20ac';
  document.getElementById('sum-iva').textContent=fmNum(c.iva)+' \u20ac';
  document.getElementById('sum-re').textContent=fmNum(c.re)+' \u20ac';
  document.getElementById('sum-beneficio').textContent=fmNum(c.beneficio)+' \u20ac';
  document.getElementById('sum-total').textContent=fmNum(c.total)+' \u20ac';
  document.getElementById('sum-uds').textContent=c.totalUds;
  var sp=document.getElementById('sum-portes');
  sp.textContent=c.portesReal;sp.style.color=c.portesReal==='PAGADOS'?'#22c55e':'#f97316';
  var info=document.getElementById('portes-info-text');
  if(c.portesReal==='PAGADOS'){info.textContent='\u2713 Portes PAGADOS';info.style.color='#22c55e';}
  else{info.textContent='Portes DEBIDOS';info.style.color='#f97316';}
  document.getElementById('portes-bar').style.width=(c.pct*100)+'%';
  var umbral=document.getElementById('portes-umbral-text');
  if(c.portesReal==='PAGADOS'){umbral.textContent='\u2713 Umbral superado ('+fmPlain(c.umbral)+')';}
  else{umbral.textContent='Faltan '+fmPlain(c.umbral-c.base)+' para portes pagados (umbral: '+fmPlain(c.umbral)+')';}
  document.getElementById('portes-beneficio').textContent='Beneficio est.: '+fmPlain(c.beneficio);
  // Entregas fraccionadas
  renderEntregasFraccionadas();
  // Actualizar barra inferior
  updateBarraInferior(c);
}
function renderEntregasFraccionadas(){
  var divEnt=document.getElementById('sum-entregas');
  if(!divEnt) return;
  var p=state.pedidos[currentOrder];
  if(!p||!p.lineas||!p.lineas.length){divEnt.classList.add('hidden');divEnt.innerHTML='';return;}
  // Inicializar overrides de entregas si no existen
  if(!p.entregasOverride) p.entregasOverride={};
  var lineasFrac=[];
  p.lineas.forEach(function(l,idx){
    var prod=getProductoById(l.prodId);
    var nombre=(l.nombre||'').toUpperCase();
    var esPhilus=nombre.indexOf('PHILUS')>-1;
    var uds=parseInt(l.uds)||0;
    var aplica=(esPhilus&&uds>=48)||(!esPhilus&&uds>=12);
    if(aplica){
      var mitadDef=Math.floor(uds/2);
      var resto=uds-mitadDef;
      var key='linea_'+idx;
      // Si hay override guardado y sigue siendo coherente, usarlo
      var ov=p.entregasOverride[key];
      var e1=ov&&ov.uds===uds?ov.e1:mitadDef;
      var e2=uds-e1;
      lineasFrac.push({idx:idx,nombre:l.nombre,uds:uds,e1:e1,e2:e2,key:key});
    }
  });
  if(!lineasFrac.length){divEnt.classList.add('hidden');divEnt.innerHTML='';return;}
  divEnt.classList.remove('hidden');
  var html='<div style="font-weight:700;margin-bottom:8px;font-size:13px">\uD83D\uDCE6 Entregas fraccionadas</div>';
  var p2=state.pedidos[currentOrder];
  lineasFrac.forEach(function(lf){
    var ov2=(p2.entregasOverride&&p2.entregasOverride[lf.key])||{};
    var f1=ov2.f1||'';var f2=ov2.f2||'';
    var fechaInfo='';
    if(f1) fechaInfo+='<div style="font-size:11px;color:var(--text3);margin-top:2px">\uD83D\uDCC5 Env\u00edo 1: <strong style="color:var(--cobalt-light)">'+f1+'</strong></div>';
    if(f2) fechaInfo+='<div style="font-size:11px;color:var(--text3)">\uD83D\uDCC5 Env\u00edo 2: <strong style="color:var(--cobalt-light)">'+f2+'</strong></div>';
    var btnColor=f1?'#1d4ed8':'var(--slate3)';
    html+='<div style="margin-bottom:8px;font-size:13px">'+
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+
        '<span style="flex:1;min-width:120px;color:var(--text)">'+escH(lf.nombre)+'</span>'+
        '<span style="color:var(--text2)">'+lf.uds+' uds &rarr;</span>'+
        '<input type="number" min="1" max="'+(lf.uds-1)+'" value="'+lf.e1+'" '+
          'style="width:58px;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:6px;font-size:13px;text-align:center" '+
          'onchange="updateEntregaOverride(\''+lf.key+'\','+lf.uds+',this.value)" '+
          'oninput="updateEntregaOverride(\''+lf.key+'\','+lf.uds+',this.value)">'+
        '<span style="color:var(--text3)">+</span>'+
        '<span id="ent-e2-'+lf.key+'" style="min-width:32px;text-align:center;font-weight:700;color:var(--cobalt-light)">'+lf.e2+'</span>'+
        '<span style="color:var(--text2)">uds</span>'+
        '<button onclick="abrirModalFechasEntrega(\''+lf.key+'\','+lf.uds+',\''+lf.nombre+'\')" '+
          'style="background:'+btnColor+';color:#fff;border:none;border-radius:6px;padding:3px 8px;font-size:12px;cursor:pointer;white-space:nowrap" '+
          'title="Establecer fechas de env\u00edo">\uD83D\uDCC5'+(f1?' \u2713':'')+'</button>'+
      '</div>'+
      fechaInfo+
    '</div>';
  });
  divEnt.innerHTML=html;
}
function updateEntregaOverride(key,totalUds,val,spanId){
  var p=state.pedidos[currentOrder];
  if(!p.entregasOverride) p.entregasOverride={};
  var e1=parseInt(val)||1;
  if(e1<1) e1=1;
  if(e1>=totalUds) e1=totalUds-1;
  var e2=totalUds-e1;
  var ov=p.entregasOverride[key]||{};
  p.entregasOverride[key]={uds:totalUds,e1:e1,f1:ov.f1||'',f2:ov.f2||''};
  savePedidos();
  var sp=document.getElementById(spanId||('ent-e2-'+key));
  if(sp) sp.textContent=e2;
}
function abrirModalFechasEntrega(key,totalUds,nombreLinea){
  var p=state.pedidos[currentOrder];
  if(!p.entregasOverride) p.entregasOverride={};
  var ov=p.entregasOverride[key]||{};
  var f1=ov.f1||'';
  var f2=ov.f2||'';
  mostrarMiniModal(
    '<div style="padding:16px">'+
    '<div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:12px">📦 Fechas de entrega — '+escH(nombreLinea)+'</div>'+
    '<label style="font-size:12px;color:var(--text3);font-weight:600;display:block;margin-bottom:4px">1er envío</label>'+
    '<input type="date" id="mm-ef-f1" value="'+f1+'" style="width:100%;min-height:44px;margin-bottom:12px;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:8px;font-size:15px" oninput="mmEntregaF1Change()">'+
    '<label style="font-size:12px;color:var(--text3);font-weight:600;display:block;margin-bottom:4px">2º envío</label>'+
    '<input type="date" id="mm-ef-f2" value="'+f2+'" style="width:100%;min-height:44px;margin-bottom:16px;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:8px;font-size:15px">'+
    '<div style="display:flex;gap:8px">'+
    '<button class="btn btn-primary btn-sm" style="flex:1" onclick="guardarFechasEntrega(\''+key+'\','+totalUds+')">Guardar</button>'+
    '<button class="btn btn-ghost btn-sm" style="flex:1" onclick="cerrarMiniModal()">Cancelar</button>'+
    '</div></div>'
  );
}
function mmEntregaF1Change(){
  var f1=document.getElementById('mm-ef-f1');
  var f2=document.getElementById('mm-ef-f2');
  if(!f1||!f2) return;
  if(f1.value&&!f2.dataset.editada){
    var d=new Date(f1.value);
    d.setMonth(d.getMonth()+3);
    f2.value=d.toISOString().split('T')[0];
  }
  f2.addEventListener('input',function(){f2.dataset.editada='1';},{once:true});
}
function guardarFechasEntrega(key,totalUds){
  var f1El=document.getElementById('mm-ef-f1');
  var f2El=document.getElementById('mm-ef-f2');
  if(!f1El||!f2El) return;
  var p=state.pedidos[currentOrder];
  if(!p.entregasOverride) p.entregasOverride={};
  var ov=p.entregasOverride[key]||{};
  ov.f1=f1El.value;
  ov.f2=f2El.value;
  if(!ov.uds) ov.uds=totalUds;
  if(!ov.e1) ov.e1=Math.floor(totalUds/2);
  p.entregasOverride[key]=ov;
  savePedidos();
  cerrarMiniModal();
  renderEntregasFraccionadas();
  toast('Fechas guardadas ✓');
}
function updateBarraInferior(c){
  if(!c) c=calcPedido();
  var p=state.pedidos[currentOrder];
  var nLineas=p.lineas.length;
  document.getElementById('barra-lineas').textContent=nLineas;
  document.getElementById('barra-total').textContent=fmNum(c.total)+' \u20ac';
  var bp=document.getElementById('barra-portes');
  bp.textContent=c.portesReal;
  bp.style.color=c.portesReal==='PAGADOS'?'#22c55e':'#f97316';
}
function updateBadges(){
  var p=state.pedidos[currentOrder];
  var c=getClienteById(p.clienteId);
  var dtoC=c?parseFloat(c.descuento)||0:0;
  document.getElementById('badge-dto-cliente').textContent=c?dtoC+'%':'-';
  document.getElementById('badge-dto-activo').textContent=p.dtoActual+'%';
  var bc=document.getElementById('badge-contrato');
  if(c&&c.contrato){bc.textContent=formatContratoDisplay(c.contrato);}else{bc.textContent='Sin contrato';}
}
function updateClientPreview(){
  var p=state.pedidos[currentOrder];
  var c=getClienteById(p.clienteId);
  var prev=document.getElementById('client-preview');
  var content=document.getElementById('client-preview-content');
  if(!c){prev.classList.add('hidden');return;}
  prev.classList.remove('hidden');
  var parts=[];
  if(c.nombreComercial) parts.push('<span style="font-weight:600;color:var(--text)">'+escH(c.nombreComercial)+'</span>');
  if(c.localidad) parts.push(escH(c.localidad));
  if(c.telefono) parts.push('\ud83d\udcde '+escH(c.telefono));
  if(c.movil) parts.push('\ud83d\udcf1 '+escH(c.movil));
  if(c.email) parts.push(escH(c.email));
  content.innerHTML=parts.join(' &bull; ');
}
function renderOfertaCounter(){
  var p=state.pedidos[currentOrder];
  var div=document.getElementById('oferta-counter');
  if(!p.ofertaId){div.classList.add('hidden');return;}
  var o=getOfertaById(p.ofertaId);if(!o){div.classList.add('hidden');return;}
  var totalUds=0;p.lineas.forEach(function(l){totalUds+=l.uds;});
  var obj=parseInt(o.udsObjetivo)||0;
  if(!obj){var m=o.nombre.match(/\d+/);if(m) obj=parseInt(m[0]);}
  div.classList.remove('hidden');
  if(obj>0){var ok=totalUds>=obj;div.style.color=ok?'#22c55e':'var(--cobalt-light)';div.textContent='Oferta: '+escH(o.nombre)+' \u2014 '+totalUds+' / '+obj+' uds'+(ok?' \u2713':'');}
  else{div.textContent='Oferta: '+escH(o.nombre)+' \u2014 '+totalUds+' uds';}
}
function refreshOfertaSelect(){
  var sel=document.getElementById('sel-oferta');var val=sel.value;
  sel.innerHTML='<option value="">-- Sin oferta --</option>';
  state.ofertas.forEach(function(o){var opt=document.createElement('option');opt.value=o.id;opt.textContent=o.nombre+(o.descuento?' ('+o.descuento+'%)':'');sel.appendChild(opt);});
  sel.value=val||'';
}
function checkAlerts(){
  var now=new Date(),day=now.getDay(),month=now.getMonth()+1,date=now.getDate();
  var divP=document.getElementById('alert-probioticos');
  var sprg=(month>3||(month===3&&date>=21))&&(month<10||(month===10&&date<=30));
  if(day===5&&sprg){divP.classList.remove('hidden');document.getElementById('alert-probioticos-text').textContent='\u26a0 Viernes de Probi\u00f3ticos: El env\u00edo hoy es bajo tu responsabilidad.';}
  else{divP.classList.add('hidden');}
  var p=state.pedidos[currentOrder];var c=getClienteById(p.clienteId);
  var divC=document.getElementById('alert-contrato');
  if(c&&c.contrato){
    var fc=parseContrato(c.contrato);
    if(fc){
      var diff=Math.floor((fc-now)/(1000*60*60*24));
      if(diff<0){divC.classList.add('hidden');mostrarModalContrato(c,Math.abs(diff));}
      else if(diff===0){divC.classList.add('hidden');mostrarModalContrato(c,0);}
      else if(diff<=60){divC.classList.remove('hidden');divC.className='alert alert-orange';document.getElementById('alert-contrato-text').textContent='Contrato vence en '+diff+' d\u00edas ('+formatContratoDisplay(c.contrato)+')';}
      else{divC.classList.add('hidden');}
    } else{divC.classList.add('hidden');}
  } else{divC.classList.add('hidden');}
}
function mostrarModalContrato(c,diasVencido){
  var modal=document.getElementById('modal-contrato');var body=document.getElementById('modal-contrato-body');
  if(diasVencido===0){body.innerHTML='<strong style="color:#fca5a5">'+escH(c.nombreCompleto)+'</strong><br>El contrato vence <strong>HOY</strong> ('+formatContratoDisplay(c.contrato)+').<br><br>Revisa las condiciones antes de confirmar el pedido.';}
  else{body.innerHTML='<strong style="color:#fca5a5">'+escH(c.nombreCompleto)+'</strong><br>El contrato lleva <strong>'+diasVencido+' d\u00edas vencido</strong> ('+formatContratoDisplay(c.contrato)+').<br><br>Revisa las condiciones antes de confirmar el pedido.';}
  modal.classList.remove('hidden');
}
function cerrarModalContrato(){document.getElementById('modal-contrato').classList.add('hidden');}
function vaciarPedido(){
  if(!confirm('Vaciar el pedido actual?')) return;
  var p=state.pedidos[currentOrder];
  p.clienteId='';p.ofertaId='';p.lineas=[];p.portes='auto';p.dtoActual=0;p.notas='';
  var chk=document.getElementById('chk-prueba');if(chk) chk.checked=false;
  var dp=document.getElementById('ia-pendientes');if(dp) dp.classList.add('hidden');
  savePedidos();renderCurrentOrder();toast('Pedido vaciado');
}
function updateStockBadge(){
  var n=Object.values(state.stock).filter(function(v){return v===true;}).length;
  var badge=document.getElementById('stock-badge');
  if(n>0){badge.textContent=n;badge.classList.remove('hidden');}else{badge.classList.add('hidden');}
}

// ██ BLOQUE:PEDIDOS-FIN ██

// ██ BLOQUE:GUARDAR-HISTORIAL-INICIO ██
function guardarEnHistorial(){
  var p=state.pedidos[currentOrder];
  if(!p.clienteId||!p.lineas.length){toast('Necesitas cliente y l\u00edneas para guardar','err');return;}
  var chkPrueba=document.getElementById('chk-prueba');
  if(chkPrueba&&chkPrueba.checked){toast('Pedido de prueba \u2014 no guardado en historial','ok');return;}
  var c=calcPedido();var cliObj=getClienteById(p.clienteId);var oObj=getOfertaById(p.ofertaId);
  var entry={fecha:nowStr(),ref:genRef(),clienteId:p.clienteId,clienteNombre:cliObj?cliObj.nombreCompleto:'',ofertaNombre:oObj?oObj.nombre:'',totalUds:c.totalUds,total:c.total,dto:p.dtoActual,portes:c.portesReal,notas:p.notas,pedido:JSON.parse(JSON.stringify(p))};
  if(state.historial.length){var last=state.historial[0];if(last.clienteId===entry.clienteId&&JSON.stringify(last.pedido.lineas)===JSON.stringify(p.lineas)){toast('Pedido id\u00e9ntico al \u00faltimo, no se guard\u00f3','err');return;}}
  state.historial.unshift(entry);
  if(state.historial.length>20) state.historial.pop();
  if(cliObj) cliObj.ultimoPedido=todayStr();
  // Acumulado mensual
  var mesKey=(function(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2);})();
  if(!state.acumuladoMensual[mesKey]) state.acumuladoMensual[mesKey]={total:0,uds:0,pedidos:0,tienda:0,medico:0};
  state.acumuladoMensual[mesKey].total+=c.total;
  state.acumuladoMensual[mesKey].uds+=c.totalUds;
  state.acumuladoMensual[mesKey].pedidos+=1;
  // Contador 50/50: tienda=herbolario+farmacia, médico=resto
  (function(){
    var esp=(cliObj&&cliObj.especialidad||'').toLowerCase();
    var esTienda=esp.indexOf('herbolario')>-1||esp.indexOf('farmacia')>-1||esp.indexOf('herbol')>-1||esp.indexOf('farm')>-1;
    if(esTienda) state.acumuladoMensual[mesKey].tienda=(state.acumuladoMensual[mesKey].tienda||0)+1;
    else state.acumuladoMensual[mesKey].medico=(state.acumuladoMensual[mesKey].medico||0)+1;
  })();
  saveState();toast('Pedido guardado en historial \u2713');
}

// ██ BLOQUE:GUARDAR-HISTORIAL-FIN ██

// ██ BLOQUE:COMPARTIR-PDF-INICIO ██
function buildNdFromCurrentOrder(){
  var p=state.pedidos[currentOrder];var c=calcPedido();
  return {pedido:p,calculo:c,cliente:getClienteById(p.clienteId)||{},oferta:getOfertaById(p.ofertaId)||{},delegado:state.delegado,fecha:nowStr(),ref:genRef()};
}
function verificarPedidoAntesDePDF(callback){
  var p=state.pedidos[currentOrder];
  if(!p.clienteId||!p.lineas.length){callback();return;}
  // Comprobar si hay líneas con timestamp antiguo o cliente distinto al último historial
  var last=state.historial[0];
  if(last&&last.clienteId!==p.clienteId&&last.pedido&&last.pedido.lineas){
    // Ver si alguna línea del pedido actual coincide con el último pedido guardado
    var lineasActuales=p.lineas.map(function(l){return l.prodId;});
    var lineasUltimo=last.pedido.lineas.map(function(l){return l.prodId;});
    var coincidencias=lineasActuales.filter(function(id){return lineasUltimo.indexOf(id)>-1;});
    if(coincidencias.length>0){
      var cliActual=getClienteById(p.clienteId);
      var cliUltimo=last.clienteNombre;
      mostrarMiniModal(
        '<div style="padding:16px">'+
        '<div style="font-size:22px;text-align:center;margin-bottom:8px">⚠️</div>'+
        '<div style="font-weight:700;font-size:14px;color:#fca5a5;margin-bottom:10px;text-align:center">Posible pedido sin vaciar</div>'+
        '<div style="font-size:13px;color:var(--text2);margin-bottom:14px;line-height:1.6">'+
          'El pedido actual es de <strong style="color:#fff">'+(cliActual?cliActual.nombreCompleto:'?')+'</strong> '+
          'pero tiene <strong>'+coincidencias.length+' producto'+(coincidencias.length>1?'s':'')+' en común</strong> con el último pedido guardado de <strong style="color:#f97316">'+escH(cliUltimo)+'</strong>.<br><br>'+
          '¿Estás seguro de que el pedido es correcto?'+
        '</div>'+
        '<div style="display:flex;flex-direction:column;gap:8px">'+
        '<button class="btn btn-primary" onclick="cerrarMiniModal();pendingPDFCallback()">✓ Sí, el pedido es correcto</button>'+
        '<button class="btn btn-danger btn-sm" onclick="cerrarMiniModal();vaciarPedido()">🗑 Vaciar y empezar de cero</button>'+
        '<button class="btn btn-ghost btn-sm" onclick="cerrarMiniModal()">Cancelar</button>'+
        '</div></div>'
      );
      window.pendingPDFCallback=callback;
      return;
    }
  }
  callback();
}
function compartirNota(){
  verificarPedidoAntesDePDF(function(){
    guardarEnHistorial();var nd=buildNdFromCurrentOrder();
    if(!nd.pedido.lineas.length){toast('Sin l\u00edneas en el pedido','err');return;}
    try{
      var pdfStr=buildPDF(nd);var blob=pdfToBlob(pdfStr);var fname=formatFName(nd);
      var file=new File([blob],fname,{type:'application/pdf'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){navigator.share({files:[file],title:'Pedido de '+(nd.cliente&&nd.cliente.nombreCompleto?nd.cliente.nombreCompleto:nd.cliente.nombreComercial||'cliente')}).catch(function(){});}
      else{var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fname;a.click();}
    }catch(e){toast('Error generando PDF: '+e.message,'err');}
  });
}
function imprimirPedido(){
  verificarPedidoAntesDePDF(function(){
    guardarEnHistorial();var nd=buildNdFromCurrentOrder();
    if(!nd.pedido.lineas.length){toast('Sin l\u00edneas','err');return;}
    document.getElementById('print-area').innerHTML=buildPrintHtml(nd);window.print();
  });
}
function formatFName(nd){
  var d=new Date(),y=d.getFullYear(),m=('0'+(d.getMonth()+1)).slice(-2),day=('0'+d.getDate()).slice(-2);
  var cli=nd.cliente.nombreCompleto||nd.cliente.nombreComercial||'Pedido';
  return y+'_'+m+'_'+day+' '+cli.replace(/[^a-zA-Z0-9\u00e0-\u00fc\s]/g,'').trim()+'.pdf';
}

// ██ BLOQUE:COMPARTIR-PDF-FIN ██

// ██ BLOQUE:PDF-NATIVO-INICIO ██
function buildPDF(nd){
  var p=nd.pedido,c=nd.calculo,cli=nd.cliente,o=nd.oferta;
  var cs=[],offsets=[],pdfParts=[];
  function e(s){return s?String(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[\x00-\x08\x0b\x0e-\x1f]/g,'').substring(0,200):'';}
  function latinEncode(s){return String(s||'').replace(/\u00e1/g,'\xe1').replace(/\u00e9/g,'\xe9').replace(/\u00ed/g,'\xed').replace(/\u00f3/g,'\xf3').replace(/\u00fa/g,'\xfa').replace(/\u00c1/g,'\xc1').replace(/\u00c9/g,'\xc9').replace(/\u00cd/g,'\xcd').replace(/\u00d3/g,'\xd3').replace(/\u00da/g,'\xda').replace(/\u00f1/g,'\xf1').replace(/\u00d1/g,'\xd1').replace(/\u00fc/g,'\xfc').replace(/\u00dc/g,'\xdc').replace(/[^\x00-\xff]/g,'?');}
  function pe(s){return e(latinEncode(s||''));}
  var y=800,lh=16,ml=50,mr=545;
  function text(x,yy,str,size,bold){cs.push('BT /'+(bold?'F2':'F1')+' '+size+' Tf '+x+' '+yy+' Td ('+pe(str)+') Tj ET');}
  function line(x1,y1,x2,y2){cs.push(x1+' '+y1+' m '+x2+' '+y2+' l S');}
  function fillRect(x,yy,w,h,r,g,b){cs.push(r+' '+g+' '+b+' rg '+x+' '+yy+' '+w+' '+h+' re f 0 0 0 rg');}
  text(200,y,'NOTA DE PEDIDO',18,true);y-=22;
  text(180,y,nd.fecha+' | '+nd.ref,9,false);y-=20;
  cs.push('0.8 w');line(ml,y,mr,y);y-=14;
  fillRect(ml,y,mr-ml,16,0.22,0.39,0.92);y-=12;
  cs.push('1 1 1 rg');text(ml+4,y+2,'CLIENTE',9,true);cs.push('0 0 0 rg');y-=4;
  function field(lbl,val){if(!val) return;text(ml,y,lbl+':',9,true);text(ml+100,y,String(val),9,false);y-=lh;}
  field('Nombre',cli.nombreCompleto);field('N.Comercial',cli.nombreComercial);field('NIF/CIF',cli.nif);
  if(cli.cp||cli.localidad) field('Localidad',(cli.cp?cli.cp+' ':'')+cli.localidad+(cli.provincia?', '+cli.provincia:''));
  field('Tel\u00e9fono',cli.telefono);field('M\u00f3vil',cli.movil);field('Email',cli.email);
  field('Especialidad',cli.especialidad);field('Delegado',nd.delegado);
  if(cli.notas) field('Notas',cli.notas.substring(0,80));
  y-=6;
  if(o.nombre){text(ml,y,'Oferta: '+o.nombre+(o.descuento?' ('+o.descuento+'%)':''),10,true);y-=lh;}
  else if(p.dtoActual){text(ml,y,'Descuento aplicado: '+p.dtoActual+'%',10,true);y-=lh;}
  y-=4;
  fillRect(ml,y,mr-ml,16,0.22,0.39,0.92);y-=12;
  cs.push('1 1 1 rg');text(ml+4,y+2,'PRODUCTOS',9,true);cs.push('0 0 0 rg');y-=6;
  var cols=[ml,ml+200,ml+250,ml+300,ml+360,ml+420];
  fillRect(ml,y-2,mr-ml,14,0.88,0.90,0.95);y-=10;
  ['Descripci\u00f3n','Cant','PVP','Dto%','Neto/U','Total'].forEach(function(h,i){text(cols[i],y,h,8,true);});y-=lh;
  var alt=false;
  p.lineas.forEach(function(l){
    if(y<80){cs.push('showpage');y=780;}
    if(alt) fillRect(ml,y-2,mr-ml,14,0.95,0.96,0.98);alt=!alt;
    var pvpSinIva=l.pvp/1.10;var neto=pvpSinIva*(1-l.dto/100),tot=neto*l.uds;
    text(cols[0],y,l.nombre.substring(0,32),8,false);text(cols[1],y,String(l.uds),8,false);
    text(cols[2],y,fmNum(l.pvp),8,false);text(cols[3],y,l.dto+'%',8,false);
    text(cols[4],y,fmNum(neto),8,false);text(cols[5],y,fmNum(tot),8,false);y-=lh;
    // Sublíneas de nota
    if(l.notas&&l.notas.length){
      l.notas.forEach(function(nota){
        if(!nota.texto) return;
        if(y<80){cs.push('showpage');y=780;}
        cs.push('0.5 0.5 0.5 rg');
        text(cols[0]+12,y,'\u21b3 '+nota.texto.substring(0,60),7,false);
        cs.push('0 0 0 rg');
        y-=12;
      });
    }
  });
  y-=6;
  if(p.notas){
    cs.push('0.5 w');line(ml,y,mr,y);y-=14;
    var notaTexto='Observaciones: '+p.notas;
    var fontSize=11,charsPerLine=85;
    if(notaTexto.length>85&&notaTexto.length<=170){fontSize=9;charsPerLine=105;}
    else if(notaTexto.length>170){fontSize=8;charsPerLine=120;}
    var palabras=notaTexto.split(' '),lineaActual='',lineas=[];
    palabras.forEach(function(pal){
      if((lineaActual+' '+pal).trim().length>charsPerLine){lineas.push(lineaActual.trim());lineaActual=pal;}
      else{lineaActual=(lineaActual+' '+pal).trim();}
    });
    if(lineaActual) lineas.push(lineaActual.trim());
    lineas.forEach(function(ln,i){text(ml,y,ln,fontSize,i===0);y-=(fontSize+4);});
    y-=4;
  }
  cs.push('0.5 w');line(ml,y,mr,y);y-=12;
  text(350,y,'Base Imponible:',9,true);text(480,y,fmNum(nd.calculo.base)+' EUR',9,false);y-=lh;
  text(350,y,'IVA (10%):',9,true);text(480,y,fmNum(nd.calculo.iva)+' EUR',9,false);y-=lh;
  text(350,y,'R.E. (1,4%):',9,true);text(480,y,fmNum(nd.calculo.re)+' EUR',9,false);y-=lh;
  cs.push('0.5 w');line(350,y,mr,y);y-=12;
  text(350,y,'TOTAL:',11,true);text(460,y,fmNum(nd.calculo.total)+' EUR',11,true);y-=lh+4;
  text(ml,y,'Portes: '+nd.calculo.portesReal+' | Total unidades: '+nd.calculo.totalUds,9,false);
  var sc=cs.join('\n');
  pdfParts.push('%PDF-1.4\n');offsets.push(pdfParts.join('').length);
  pdfParts.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');offsets.push(pdfParts.join('').length);
  pdfParts.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');offsets.push(pdfParts.join('').length);
  pdfParts.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n');
  offsets.push(pdfParts.join('').length);
  pdfParts.push('4 0 obj\n<< /Length '+sc.length+' >>\nstream\n'+sc+'\nendstream\nendobj\n');offsets.push(pdfParts.join('').length);
  pdfParts.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');offsets.push(pdfParts.join('').length);
  pdfParts.push('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');
  var xrefOff=pdfParts.join('').length;
  pdfParts.push('xref\n0 7\n0000000000 65535 f \n');
  offsets.forEach(function(o){pdfParts.push(('0000000000'+o).slice(-10)+' 00000 n \n');});
  pdfParts.push('trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n'+xrefOff+'\n%%EOF');
  return pdfParts.join('');
}
function pdfToBlob(pdfStr){var bytes=new Uint8Array(pdfStr.length);for(var i=0;i<pdfStr.length;i++) bytes[i]=pdfStr.charCodeAt(i)&0xff;return new Blob([bytes],{type:'application/pdf'});}
function buildPrintHtml(nd){
  var p=nd.pedido,c=nd.calculo,cli=nd.cliente,o=nd.oferta;var rows='';
  p.lineas.forEach(function(l,i){
    var pvpSinIva=l.pvp/1.10;var neto=pvpSinIva*(1-l.dto/100);
    rows+='<tr style="background:'+(i%2?'#f5f7fa':'#fff')+'"><td>'+escH(l.nombre)+'</td><td>'+l.uds+'</td><td>'+fmNum(l.pvp)+'</td><td>'+l.dto+'%</td><td>'+fmNum(neto)+'</td><td>'+fmNum(neto*l.uds)+'</td></tr>';
    if(l.notas&&l.notas.length){
      l.notas.forEach(function(nota){
        if(!nota.texto) return;
        rows+='<tr style="background:'+(i%2?'#f5f7fa':'#fff')+'"><td colspan="6" style="padding-left:24px;font-size:8pt;color:#666;font-style:italic">\u21b3 '+escH(nota.texto)+'</td></tr>';
      });
    }
  });
  return '<div class="print-title">NOTA DE PEDIDO</div><div class="print-ref">'+escH(nd.fecha)+' | '+escH(nd.ref)+'</div>'+
    '<div class="print-section"><div class="print-section-title">CLIENTE</div>'+
    (cli.nombreCompleto?'<div class="print-field"><span class="print-field-label">Nombre:</span><span>'+escH(cli.nombreCompleto)+'</span></div>':'')+
    (cli.nombreComercial?'<div class="print-field"><span class="print-field-label">N.Comercial:</span><span>'+escH(cli.nombreComercial)+'</span></div>':'')+
    (cli.nif?'<div class="print-field"><span class="print-field-label">NIF/CIF:</span><span>'+escH(cli.nif)+'</span></div>':'')+
    ((cli.cp||cli.localidad)?'<div class="print-field"><span class="print-field-label">Localidad:</span><span>'+escH((cli.cp||'')+' '+(cli.localidad||'')+' '+(cli.provincia||''))+'</span></div>':'')+
    (cli.telefono?'<div class="print-field"><span class="print-field-label">Tel\u00e9fono:</span><span>'+escH(cli.telefono)+'</span></div>':'')+
    (cli.movil?'<div class="print-field"><span class="print-field-label">M\u00f3vil:</span><span>'+escH(cli.movil)+'</span></div>':'')+
    (nd.delegado?'<div class="print-field"><span class="print-field-label">Delegado:</span><span>'+escH(nd.delegado)+'</span></div>':'')+
    '</div>'+
    (o.nombre||p.dtoActual?'<div class="print-section"><div class="print-section-title">DESCUENTO</div><div class="print-field">'+(o.nombre?escH(o.nombre)+' ':'')+p.dtoActual+'%</div></div>':'')+
    '<div class="print-section"><div class="print-section-title">PRODUCTOS</div><table class="print-table"><thead><tr><th>Descripci\u00f3n</th><th>Cant</th><th>PVP</th><th>Dto%</th><th>Neto/U</th><th>Total</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    (function(){
      if(!p.entregasOverride) return '';
      var lineasFracPrint=[];
      p.lineas.forEach(function(l,idx){
        var nombre=(l.nombre||'').toUpperCase();
        var esPhilus=nombre.indexOf('PHILUS')>-1;
        var uds=parseInt(l.uds)||0;
        var aplica=(esPhilus&&uds>=48)||(!esPhilus&&uds>=12);
        if(!aplica) return;
        var key='linea_'+idx;
        var ov=p.entregasOverride[key];
        if(!ov) return;
        var e1=ov.e1||Math.floor(uds/2);
        var e2=uds-e1;
        lineasFracPrint.push({nombre:l.nombre,uds:uds,e1:e1,e2:e2,f1:ov.f1||'',f2:ov.f2||''});
      });
      if(!lineasFracPrint.length) return '';
      var rows2=lineasFracPrint.map(function(lf){
        return '<tr><td>'+escH(lf.nombre)+'</td>'+
          '<td style="text-align:center">1º envío</td>'+
          '<td style="text-align:center">'+lf.e1+' uds</td>'+
          '<td style="text-align:center">'+(lf.f1||'—')+'</td></tr>'+
          '<tr><td></td>'+
          '<td style="text-align:center">2º envío</td>'+
          '<td style="text-align:center">'+lf.e2+' uds</td>'+
          '<td style="text-align:center">'+(lf.f2||'—')+'</td></tr>';
      }).join('');
      return '<div class="print-section"><div class="print-section-title">ENTREGAS FRACCIONADAS</div>'+
        '<table class="print-table"><thead><tr><th>Producto</th><th>Envío</th><th>Unidades</th><th>Fecha prevista</th></tr></thead>'+
        '<tbody>'+rows2+'</tbody></table></div>';
    })()+
    (p.notas?'<div class="print-obs"><div class="print-obs-title">Observaciones</div>'+escH(p.notas)+'</div>':'+')+
    '<div class="print-totals"><table><tr><td>Base Imponible:</td><td>'+fmNum(c.base)+' EUR</td></tr><tr><td>IVA (10%):</td><td>'+fmNum(c.iva)+' EUR</td></tr><tr><td>R.E. (1,4%):</td><td>'+fmNum(c.re)+' EUR</td></tr><tr class="print-total-final"><td>TOTAL:</td><td>'+fmNum(c.total)+' EUR</td></tr></table></div>'+
    '<div class="print-footer"><span>Portes: '+c.portesReal+'</span><span>Total unidades: '+c.totalUds+'</span></div>';
}

// ██ BLOQUE:PDF-NATIVO-FIN ██

// ██ BLOQUE:CLIENTES-INICIO ██
function setFiltroClientes(filtro,btn){
  filtroClientes=filtro;
  document.querySelectorAll('#panel-clientes .cli-filtro-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  renderClientesList();
}
function saveCliente(){
  var nombre=document.getElementById('cli-nombre').value.trim();
  if(!nombre){toast('El nombre es obligatorio','err');return;}
  var editId=document.getElementById('cli-editing-id').value;
  var compraVal=document.getElementById('cli-compra').value||'NO';
  var obj={
    id:editId||uid(),nombreCompleto:nombre,
    nombreComercial:document.getElementById('cli-comercial').value.trim(),
    nif:document.getElementById('cli-nif').value.trim(),
    especialidad:document.getElementById('cli-especialidad').value.trim(),
    direccion:document.getElementById('cli-direccion').value.trim(),
    cp:document.getElementById('cli-cp').value.trim(),
    localidad:document.getElementById('cli-localidad').value.trim(),
    provincia:document.getElementById('cli-provincia').value.trim(),
    telefono:document.getElementById('cli-telefono').value.trim(),
    movil:document.getElementById('cli-movil').value.trim(),
    email:document.getElementById('cli-email').value.trim(),
    descuento:parseFloat(document.getElementById('cli-descuento').value)||0,
    contrato:document.getElementById('cli-contrato').value,
    compra:compraVal,
    volumenExterno:parseFloat(document.getElementById('cli-volumen-externo').value)||0,
    notas:document.getElementById('cli-notas').value.trim(),
    productosHabituales:(document.getElementById('cli-prod-hab-ids').value||'').split(',').filter(function(x){return x.trim()!=='[]';}),
    tipoVisita:document.getElementById('cli-tipo-visita').value||'',
    zonaVisita:document.getElementById('cli-zona-visita').value.trim(),
    diasVisita:parseInt(document.getElementById('cli-dias-visita').value)||null,
    ultimaVisita:''
  };
  obj._ts = new Date().getTime();
  if(editId){
    var existing=state.clientes.find(function(c){return c.id===editId;});
    if(existing){obj.ultimoPedido=existing.ultimoPedido||'';obj.ultimaVisita=existing.ultimaVisita||'';}
  } else {obj.ultimoPedido='';}
  if(editId){
    var idx=state.clientes.findIndex(function(c){return c.id===editId;});
    if(idx>=0) state.clientes[idx]=obj;
  } else {state.clientes.push(obj);}
  saveState();clearClientForm();renderClientesList();toast('Cliente guardado \u2713');
}
function clearClientForm(){
  ['cli-nombre','cli-comercial','cli-nif','cli-especialidad','cli-direccion','cli-cp','cli-localidad','cli-provincia','cli-telefono','cli-movil','cli-email','cli-descuento','cli-contrato','cli-notas','cli-volumen-externo'].forEach(function(id){var el=document.getElementById(id);if(el) el.value='';});
  var sc=document.getElementById('cli-compra');if(sc) sc.value='NO';
  var stv=document.getElementById('cli-tipo-visita');if(stv) stv.value='';
  var szv=document.getElementById('cli-zona-visita');if(szv) szv.value='';
  var sdv=document.getElementById('cli-dias-visita');if(sdv) sdv.value='';
  document.getElementById('cli-editing-id').value='';
  document.getElementById('cli-prod-hab-ids').value='';
  document.getElementById('cli-prod-hab-list').innerHTML='';
  if(document.getElementById('cli-productos-habituales')) document.getElementById('cli-productos-habituales').value='';
  document.getElementById('client-form-title').textContent='Nuevo Cliente';
  document.getElementById('btn-cancel-cli').style.display='none';
}
function editCliente(id){
  var c=getClienteById(id);if(!c) return;
  document.getElementById('cli-nombre').value=c.nombreCompleto||'';
  document.getElementById('cli-comercial').value=c.nombreComercial||'';
  document.getElementById('cli-nif').value=c.nif||'';
  document.getElementById('cli-especialidad').value=c.especialidad||'';
  document.getElementById('cli-direccion').value=c.direccion||'';
  document.getElementById('cli-cp').value=c.cp||'';
  document.getElementById('cli-localidad').value=c.localidad||'';
  document.getElementById('cli-provincia').value=c.provincia||'';
  document.getElementById('cli-telefono').value=c.telefono||'';
  document.getElementById('cli-movil').value=c.movil||'';
  document.getElementById('cli-email').value=c.email||'';
  document.getElementById('cli-descuento').value=c.descuento||'';
  document.getElementById('cli-contrato').value=c.contrato||'';
  document.getElementById('cli-volumen-externo').value=c.volumenExterno||'';
  document.getElementById('cli-notas').value=c.notas||'';
  var sc=document.getElementById('cli-compra');if(sc) sc.value=(c.compra||'NO');
  var stv=document.getElementById('cli-tipo-visita');if(stv) stv.value=(c.tipoVisita||'');
  var szv=document.getElementById('cli-zona-visita');if(szv) szv.value=(c.zonaVisita||'');
  var sdv=document.getElementById('cli-dias-visita');if(sdv) sdv.value=(c.diasVisita||'');
  document.getElementById('cli-prod-hab-ids').value=(c.productosHabituales||[]).join(',');
  renderProdHabList(c.productosHabituales||[]);
  document.getElementById('cli-editing-id').value=id;
  document.getElementById('client-form-title').textContent='Editar Cliente';
  document.getElementById('btn-cancel-cli').style.display='inline-flex';
  document.getElementById('cli-nombre').scrollIntoView({behavior:'smooth'});
}
function deleteCliente(id){
  if(!confirm('Eliminar este cliente?')) return;
  state.clientes=state.clientes.filter(function(c){return c.id!==id;});
  saveState();renderClientesList();toast('Cliente eliminado');
}
function renderClientesList(){
  var q=(document.getElementById('cli-search').value||'').toLowerCase();
  var arr=sortClientes(state.clientes).filter(function(c){
    if(filtroClientes==='compran'&&(c.compra||'').toUpperCase()!=='SI') return false;
    if(filtroClientes==='nocompran'&&(c.compra||'').toUpperCase()==='SI') return false;
    if(!q) return true;
    return (c.nombreCompleto||'').toLowerCase().indexOf(q)>-1||(c.nombreComercial||'').toLowerCase().indexOf(q)>-1||(c.telefono||'').toLowerCase().indexOf(q)>-1||(c.movil||'').toLowerCase().indexOf(q)>-1||(c.direccion||'').toLowerCase().indexOf(q)>-1||(c.localidad||'').toLowerCase().indexOf(q)>-1;
  });
  document.getElementById('clientes-count').textContent='('+arr.length+')';
  var container=document.getElementById('clientes-list');
  if(!arr.length){container.innerHTML='<div style="text-align:center;padding:24px;color:var(--text3)">'+(q?'Sin resultados para \u00ab'+escH(q)+'\u00bb':'Sin clientes en este filtro')+'</div>';return;}
  container.innerHTML='';
  arr.forEach(function(c){
    var matchInfo='';
    if(q){
      var matches=[];
      if((c.telefono||'').toLowerCase().indexOf(q)>-1) matches.push('\ud83d\udcde '+escH(c.telefono));
      if((c.movil||'').toLowerCase().indexOf(q)>-1) matches.push('\ud83d\udcf1 '+escH(c.movil));
      if((c.direccion||'').toLowerCase().indexOf(q)>-1) matches.push('\ud83d\udccd '+escH(c.direccion));
      if((c.localidad||'').toLowerCase().indexOf(q)>-1&&(c.nombreCompleto||'').toLowerCase().indexOf(q)<0&&(c.nombreComercial||'').toLowerCase().indexOf(q)<0) matches.push(escH(c.localidad));
      if(matches.length) matchInfo='<div style="font-size:11px;color:var(--cobalt-light);margin-top:3px">'+matches.join(' &bull; ')+'</div>';
    }
    var div=document.createElement('div');div.className='client-item';
    div.innerHTML='<div style="flex:1"><div class="item-name">'+escH(c.nombreCompleto)+'</div>'+
      '<div class="item-sub">'+(c.nombreComercial?escH(c.nombreComercial)+' &bull; ':'')+escH(c.localidad||'')+' &bull; '+c.descuento+'%'+(c.ultimoPedido?' &bull; '+c.ultimoPedido:'')+(c.compra==='SI'?' &bull; <span style="color:#22c55e;font-size:11px;font-weight:700">Compra</span>':'')+'</div>'+
      matchInfo+'</div>'+
      '<div class="item-actions">'+
        '<button class="btn btn-ghost btn-sm btn-copiar-cli" title="Copiar nombre">&#128203; Copiar</button>'+
        '<button class="btn btn-ghost btn-sm btn-editar-cli">Editar</button>'+
        '<button class="btn btn-danger btn-sm btn-del-cli">\u00d7</button>'+
      '</div>';
    div.querySelector('.btn-copiar-cli').addEventListener('click',function(){copiarNombreCliente(c.id);});
    div.querySelector('.btn-editar-cli').addEventListener('click',function(){editCliente(c.id);});
    div.querySelector('.btn-del-cli').addEventListener('click',function(){deleteCliente(c.id);});
    container.appendChild(div);
  });
}
function copiarNombreCliente(id){
  var c=getClienteById(id);if(!c) return;
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(c.nombreCompleto).then(function(){toast('Copiado: '+c.nombreCompleto+' \u2713');}).catch(function(){copiarFallback(c.nombreCompleto);});}
  else{copiarFallback(c.nombreCompleto);}
}
function copiarFallback(texto){
  var ta=document.createElement('textarea');ta.value=texto;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');toast('Copiado: '+texto+' \u2713');}catch(e){toast('No se pudo copiar','err');}
  document.body.removeChild(ta);
}

// ██ BLOQUE:CLIENTES-FIN ██

// ██ BLOQUE:IMPORT-CSV-CLIENTES-INICIO ██
function importClientesCSV(e){
  var file=e.target.files[0];if(!file) return;
  var reader=new FileReader();
  reader.onload=function(ev){
    var lines=ev.target.result.split('\n');
    var creados=0,actualizados=0;
    lines.forEach(function(raw){
      var line=raw.trim();if(!line) return;
      var sep=detectSep(line);
      var cols=line.split(sep).map(function(s){return s.trim().replace(/^"+|"+$/g,'');});
      if(!cols[0]||cols[0].toUpperCase().indexOf('NOMBRE')>-1) return;
      var nombreCSV=cols[0].trim();if(!nombreCSV) return;
      var compra=normalizarCompra(cols[10]);
      var nota=(cols[11]||'')+(cols[12]?' | '+cols[12]:'');
      // Buscar existente por nombre (case-insensitive, trim)
      var nombreLow=nombreCSV.toLowerCase();
      var existingIdx=state.clientes.findIndex(function(c){return (c.nombreCompleto||'').trim().toLowerCase()===nombreLow;});
      if(existingIdx>=0){
        // Upsert: actualizar campos de empresa, respetar campos de app
        var ex=state.clientes[existingIdx];
        ex.nombreComercial=cols[1]||ex.nombreComercial||'';
        ex.direccion=cols[2]||ex.direccion||'';
        ex.cp=cols[3]||ex.cp||'';
        ex.localidad=cols[4]||ex.localidad||'';
        ex.provincia=cols[5]||ex.provincia||'';
        ex.telefono=cols[6]||ex.telefono||'';
        ex.movil=cols[7]||ex.movil||'';
        ex.email=cols[8]||ex.email||'';
        ex.especialidad=cols[9]||ex.especialidad||'';
        ex.compra=compra;
        ex.descuento=parseFloat(cols[13])||ex.descuento||0;
        ex.contrato=cols[14]||ex.contrato||'';
        // NO tocar: ultimoPedido, productosHabituales, notas, volumenExterno, id
        actualizados++;
      } else {
        // Crear nuevo completo
        state.clientes.push({
          id:uid(),nombreCompleto:nombreCSV,
          nombreComercial:cols[1]||'',direccion:cols[2]||'',cp:cols[3]||'',
          localidad:cols[4]||'',provincia:cols[5]||'',telefono:cols[6]||'',
          movil:cols[7]||'',email:cols[8]||'',especialidad:cols[9]||'',
          nif:'',compra:compra,descuento:parseFloat(cols[13])||0,
          contrato:cols[14]||'',notas:nota.trim(),volumenExterno:0,
          ultimoPedido:'',productosHabituales:[]
        });
        creados++;
      }
    });
    saveState();renderClientesList();
    toast(creados+' creados, '+actualizados+' actualizados \u2713');
  };
  reader.readAsText(file,'windows-1252');
  e.target.value='';
}

// ██ BLOQUE:IMPORT-CSV-CLIENTES-FIN ██

// ██ BLOQUE:PRODUCTOS-INICIO ██
function autocalcCosto(pvpVal){
  var editId=document.getElementById('prod-editing-id').value;
  if(editId) return; // solo en nuevo producto
  var pvp=parseFloat(pvpVal)||0;
  var costoEl=document.getElementById('prod-costo');
  if(pvp>0) costoEl.value=((pvp/1.10)*0.70).toFixed(2);
  else costoEl.value='';
}
function saveProducto(){
  var nombre=document.getElementById('prod-nombre').value.trim();
  if(!nombre){toast('El nombre es obligatorio','err');return;}
  var editId=document.getElementById('prod-editing-id').value;
  var obj={id:editId||uid(),nombre:nombre,pvp:cleanPrice(document.getElementById('prod-pvp').value),costo:cleanPrice(document.getElementById('prod-costo').value),unidades:parseInt(document.getElementById('prod-uds').value)||1,orden:document.getElementById('prod-orden').value.trim().toUpperCase(),ref:document.getElementById('prod-ref').value.trim()};
  if(editId){var idx=state.productos.findIndex(function(p){return p.id===editId;});if(idx>=0) state.productos[idx]=obj;}
  else{state.productos.push(obj);}
  saveState();clearProductoForm();renderProductosList();toast('Producto guardado \u2713');
}
function clearProductoForm(){
  ['prod-nombre','prod-pvp','prod-costo','prod-uds','prod-orden','prod-ref'].forEach(function(id){var el=document.getElementById(id);if(el) el.value='';});
  document.getElementById('prod-editing-id').value='';
  document.getElementById('prod-form-title').textContent='Nuevo Producto';
  document.getElementById('btn-cancel-prod').style.display='none';
}
function editProducto(id){
  var p=getProductoById(id);if(!p) return;
  document.getElementById('prod-nombre').value=p.nombre||'';document.getElementById('prod-pvp').value=p.pvp||'';
  document.getElementById('prod-costo').value=p.costo||'';document.getElementById('prod-uds').value=p.unidades||'';
  document.getElementById('prod-orden').value=p.orden||'';document.getElementById('prod-ref').value=p.ref||'';
  document.getElementById('prod-editing-id').value=id;
  document.getElementById('prod-form-title').textContent='Editar Producto';
  document.getElementById('btn-cancel-prod').style.display='inline-flex';
  document.getElementById('prod-nombre').scrollIntoView({behavior:'smooth'});
}
function deleteProducto(id){if(!confirm('Eliminar este producto?')) return;state.productos=state.productos.filter(function(p){return p.id!==id;});saveState();renderProductosList();toast('Producto eliminado');}
function renderProductosList(){
  var q=(document.getElementById('prod-search').value||'').toLowerCase();
  var arr=sortProductos(state.productos).filter(function(p){if(!q) return true;return (p.nombre||'').toLowerCase().indexOf(q)>-1||(p.orden||'').toLowerCase().indexOf(q)>-1;});
  document.getElementById('productos-count').textContent='('+arr.length+')';
  if(!arr.length){document.getElementById('productos-list').innerHTML='<div style="text-align:center;padding:24px;color:var(--text3)">Sin productos</div>';return;}
  var html='';
  arr.forEach(function(p){
    var sinStock=isProductoSinStock(p.id);
    html+='<div class="product-item"><div><div class="item-name">'+escH(p.nombre)+(sinStock?' <span style="background:var(--red);color:#fff;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700">SIN STOCK</span>':'')+'</div>'+
      '<div class="item-sub">'+(p.orden?'<span style="background:var(--cobalt);color:#fff;border-radius:4px;padding:1px 6px;font-size:11px;margin-right:4px">'+escH(p.orden)+'</span>':'')+fmPlain(p.pvp)+'</div></div>'+
      '<div class="item-actions"><button class="btn btn-ghost btn-sm" onclick="editProducto(\''+p.id+'\')">Editar</button><button class="btn btn-danger btn-sm" onclick="deleteProducto(\''+p.id+'\')">&times;</button></div></div>';
  });
  document.getElementById('productos-list').innerHTML=html;
}
function importProductosCSV(e){
  var file=e.target.files[0];if(!file) return;
  var reader=new FileReader();
  reader.onload=function(ev){
    var lines=ev.target.result.split('\n');var creados=0,actualizados=0;
    lines.forEach(function(raw){
      var line=raw.trim();if(!line) return;
      var cols=line.split(';').map(function(s){return s.trim().replace(/^"+|"+$/g,'').replace(/\s*€\s*/g,'').trim();});
      if(!cols[0]||cols[0].toUpperCase().indexOf('PRODUCTO')>-1) return;
      var nombreCSV=cols[0].trim();if(!nombreCSV) return;
      var nombreLow=nombreCSV.toLowerCase();
      var existingIdx=state.productos.findIndex(function(p){return (p.nombre||'').trim().toLowerCase()===nombreLow;});
      if(existingIdx>=0){
        // Upsert: actualizar pvp, costo, unidades, orden — respetar ref y lo demás
        var ex=state.productos[existingIdx];
        if(cols[1]) ex.pvp=cleanPrice(cols[1]);
        if(cols[2]) ex.costo=cleanPrice(cols[2]);
        if(cols[3]) ex.unidades=parseInt(cols[3])||ex.unidades||1;
        if(cols[4]) ex.orden=cols[4].toUpperCase();
        actualizados++;
      } else {
        state.productos.push({id:uid(),nombre:nombreCSV,pvp:cleanPrice(cols[1]),costo:cleanPrice(cols[2]),unidades:parseInt(cols[3])||1,orden:(cols[4]||'').toUpperCase(),ref:''});
        creados++;
      }
    });
    saveState();renderProductosList();toast(creados+' creados, '+actualizados+' actualizados \u2713');
  };
  reader.readAsText(file,'windows-1252');e.target.value='';
}

// ██ BLOQUE:PRODUCTOS-FIN ██

// ██ BLOQUE:OFERTAS-INICIO ██
function saveOferta(){
  var nombre=document.getElementById('ofer-nombre').value.trim();if(!nombre){toast('El nombre es obligatorio','err');return;}
  var editId=document.getElementById('ofer-editing-id').value;
  var obj={id:editId||uid(),nombre:nombre,descuento:parseFloat(document.getElementById('ofer-descuento').value)||0,udsObjetivo:parseInt(document.getElementById('ofer-uds').value)||0};
  if(editId){var idx=state.ofertas.findIndex(function(o){return o.id===editId;});if(idx>=0) state.ofertas[idx]=obj;}else{state.ofertas.push(obj);}
  saveState();refreshOfertaSelect();clearOfertaForm();renderOfertasList();toast('Oferta guardada \u2713');
}
function clearOfertaForm(){['ofer-nombre','ofer-descuento','ofer-uds'].forEach(function(id){var el=document.getElementById(id);if(el) el.value='';});document.getElementById('ofer-editing-id').value='';document.getElementById('oferta-form-title').textContent='Nueva Oferta';document.getElementById('btn-cancel-ofer').style.display='none';}
function editOferta(id){var o=getOfertaById(id);if(!o) return;document.getElementById('ofer-nombre').value=o.nombre||'';document.getElementById('ofer-descuento').value=o.descuento||'';document.getElementById('ofer-uds').value=o.udsObjetivo||'';document.getElementById('ofer-editing-id').value=id;document.getElementById('oferta-form-title').textContent='Editar Oferta';document.getElementById('btn-cancel-ofer').style.display='inline-flex';}
function deleteOferta(id){if(!confirm('Eliminar esta oferta?')) return;state.ofertas=state.ofertas.filter(function(o){return o.id!==id;});saveState();refreshOfertaSelect();renderOfertasList();toast('Oferta eliminada');}
function renderOfertasList(){
  var arr=state.ofertas;document.getElementById('ofertas-count').textContent='('+arr.length+')';
  if(!arr.length){document.getElementById('ofertas-list').innerHTML='<div style="text-align:center;padding:24px;color:var(--text3)">Sin ofertas</div>';return;}
  var html='';arr.forEach(function(o){html+='<div class="offer-item"><div><div class="item-name">'+escH(o.nombre)+'</div><div class="item-sub">'+o.descuento+'% &bull; '+(o.udsObjetivo?o.udsObjetivo+' uds':'auto')+'</div></div><div class="item-actions"><button class="btn btn-ghost btn-sm" onclick="editOferta(\''+o.id+'\')">Editar</button><button class="btn btn-danger btn-sm" onclick="deleteOferta(\''+o.id+'\')">&times;</button></div></div>';});
  document.getElementById('ofertas-list').innerHTML=html;
}
function importOfertasCSV(e){
  var file=e.target.files[0];if(!file) return;
  var reader=new FileReader();
  reader.onload=function(ev){
    var lines=ev.target.result.split('\n');var count=0;
    lines.forEach(function(raw){var line=raw.trim();if(!line) return;var sep=detectSep(line);var cols=line.split(sep).map(function(s){return s.trim();});if(!cols[0]||cols[0].toUpperCase().indexOf('NOMBRE')>-1) return;state.ofertas.push({id:uid(),nombre:cols[0],descuento:parseFloat(cols[1])||0,udsObjetivo:0});count++;});
    saveState();refreshOfertaSelect();renderOfertasList();toast(count+' ofertas importadas \u2713');
  };
  reader.readAsText(file,'windows-1252');e.target.value='';
}

// ██ BLOQUE:OFERTAS-FIN ██

// ██ BLOQUE:STOCK-INICIO ██
function renderStockList(){
  var q=(document.getElementById('stock-search').value||'').toLowerCase();
  var arr=sortProductos(state.productos).filter(function(p){if(!q) return true;return (p.nombre||'').toLowerCase().indexOf(q)>-1;});
  var sinStock=Object.values(state.stock).filter(function(v){return v;}).length;
  document.getElementById('stock-count-title').textContent=sinStock?' ('+sinStock+' sin stock)':'';
  if(!arr.length){document.getElementById('stock-list').innerHTML='<div style="text-align:center;padding:24px;color:var(--text3)">Sin productos</div>';return;}
  var html='';
  arr.forEach(function(p){var sinS=isProductoSinStock(p.id);html+='<div class="stock-item"><div><div style="font-weight:600">'+escH(p.nombre)+'</div><div style="font-size:12px;color:var(--text2)">'+(p.orden?escH(p.orden)+' &bull; ':'')+fmPlain(p.pvp)+'</div></div><button class="stock-toggle '+(sinS?'nostock':'ok')+'" onclick="toggleStock(\''+p.id+'\')">'+(sinS?'\u2717 SIN STOCK':'\u2713 OK')+'</button></div>';});
  document.getElementById('stock-list').innerHTML=html;
}
function toggleStock(id){if(state.stock[id]){delete state.stock[id];}else{state.stock[id]=true;}localStorage.setItem('stock',JSON.stringify(state.stock));renderStockList();updateStockBadge();actualizarBadgeCamp();}

// ██ BLOQUE:STOCK-FIN ██

// ██ BLOQUE:ESCALADO-INICIO ██
function setFiltroEscalado(filtro,btn){
  filtroEscalado=filtro;
  document.querySelectorAll('#panel-escalado .cli-filtro-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  renderEscalado();
}
function renderEscalado(){
  var q=(document.getElementById('esc-search').value||'').toLowerCase();
  var arr=sortClientes(state.clientes).filter(function(c){
    if(filtroEscalado==='compran'&&(c.compra||'').toUpperCase()!=='SI') return false;
    if(filtroEscalado==='nocompran'&&(c.compra||'').toUpperCase()==='SI') return false;
    if(!q) return true;
    return (c.nombreCompleto||'').toLowerCase().indexOf(q)>-1;
  });
  if(!arr.length){document.getElementById('escalado-clientes').innerHTML='<div style="text-align:center;padding:24px;color:var(--text3)">Sin clientes</div>';return;}
  var volMap={};state.historial.forEach(function(h){volMap[h.clienteId]=(volMap[h.clienteId]||0)+(h.total||0);});
  var html='';
  arr.forEach(function(c){
    var vol=(volMap[c.id]||0)+(parseFloat(c.volumenExterno)||0);
    var tramo=getTramoByVol(vol),tramoCli=getTramoByDto(parseFloat(c.descuento)||0);
    var pct=tramo.obj?Math.min(vol/tramo.obj,1):1;
    var pctCls=pct>=1?'prog-green':pct>=0.75?'prog-yellow':'prog-red';
    var nPedidos=state.historial.filter(function(h){return h.clienteId===c.id;}).length;
    var minPed=nPedidos?tramo.sig:tramo.p1;
    html+='<div class="cli-esc-card">'+
      '<div class="cli-esc-name">'+escH(c.nombreCompleto)+' <span class="tramo-badge">Tramo '+TRAMOS.indexOf(tramoCli)+1+' &bull; '+c.descuento+'%</span></div>'+
      '<div class="cli-esc-row"><span class="cli-esc-label">Volumen acumulado:</span><span style="font-weight:700">'+fmPlain(vol)+'</span></div>'+
      (tramo.obj?'<div class="cli-esc-row"><span class="cli-esc-label">Obj. ejercicio:</span><span style="font-weight:600">'+(pct>=1?'<span style="color:#22c55e">\u2713 Superado ('+fmPlain(vol)+')</span>':'Faltan '+fmPlain(tramo.obj-vol))+'</span>'+
      '<div class="prog-wrap"><div class="prog-bar '+pctCls+'" style="width:'+(pct*100)+'%"></div></div></div>':'')+
      (tramo.rfa?'<div class="cli-esc-row"><span class="cli-esc-label">RFA '+tramo.rfa+'%:</span><span style="font-weight:600">'+(vol>=tramo.obj?'<span style="color:#22c55e">\u2713 Alcanzado</span>':'Faltan '+fmPlain(tramo.obj-vol))+'</span></div>':'')+
      '<div class="cli-esc-row"><span class="cli-esc-label">M&iacute;nimo pedido:</span><span style="font-weight:600">'+fmPlain(minPed)+'</span></div>'+
      (c.ultimoPedido?'<div class="cli-esc-row"><span class="cli-esc-label">&Uacute;ltimo pedido:</span><span>'+c.ultimoPedido+'</span></div>':'')+
    '</div>';
  });
  document.getElementById('escalado-clientes').innerHTML=html;
}

// ██ BLOQUE:ESCALADO-FIN ██

// ██ BLOQUE:HISTORIAL-INICIO ██
function copiarPromptGemini(){
  var ahora=new Date();
  var h=ahora.getHours(),m=ahora.getMinutes();
  // Antes de las 17:30 → pedidos de hoy; después de las 17:30 → pedidos desde ayer 17:30
  var desde=new Date();
  if(h<17||(h===17&&m<30)){
    desde.setHours(0,0,0,0); // desde las 00:00 de hoy
  } else {
    desde.setDate(desde.getDate()-1);
    desde.setHours(17,30,0,0); // desde las 17:30 de ayer
  }
  // Filtrar historial del periodo
  var pedidosDia=state.historial.filter(function(h){
    // Parsear fecha del historial "DD/MM/YYYY HH:MM"
    var partes=h.fecha?h.fecha.split(' '):[];
    if(!partes.length) return false;
    var fecha=partes[0].split('/');
    var hora=partes[1]?partes[1].split(':'):[0,0];
    if(fecha.length<3) return false;
    var d=new Date(+fecha[2],+fecha[1]-1,+fecha[0],+hora[0],+hora[1]);
    return d>=desde;
  });
  if(!pedidosDia.length){
    toast('No hay pedidos en el periodo actual para incluir en el prompt','err');
    return;
  }
  var listaClientes=pedidosDia.map(function(p,i){
    return (i+1)+'. '+p.clienteNombre;
  }).join('\n');
  var prompt='Accede a mi Gmail (fran.nutergia@gmail.com) y haz lo siguiente:\n\n'+
    'Tengo estos pedidos enviados hoy:\n'+listaClientes+'\n\n'+
    'Para cada cliente de la lista, busca si existe en mi bandeja de entrada un correo de pedidos@nutergia.es con asunto "RE: Pedido de [nombre del cliente]" que contenga "oido cocina" en el cuerpo (en cualquier variante de may\u00fasculas, min\u00fasculas o acentos).\n\n'+
    'Dev\u00faelveme dos listas:\n'+
    '\u2717 PENDIENTES \u2014 clientes sin confirmaci\u00f3n\n'+
    '\u2713 CONFIRMADOS \u2014 clientes con confirmaci\u00f3n recibida';
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(prompt).then(function(){
      toast('Prompt copiado al portapapeles \u2713 \u2014 P\u00e9galo en Gemini');
    }).catch(function(){copiarFallback(prompt);});
  } else {
    copiarFallback(prompt);
  }
}
function renderHistorial(){
  var arr=state.historial;document.getElementById('hist-count').textContent='('+arr.length+' de 20)';
  if(!arr.length){document.getElementById('historial-content').innerHTML='<div style="text-align:center;padding:24px;color:var(--text3)">Sin historial a\u00fan</div>';return;}
  var html='<div style="overflow-x:auto"><table class="hist-table"><thead><tr><th>Fecha</th><th>Ref</th><th>Cliente</th><th>Oferta</th><th>Uds</th><th>Total</th><th>Portes</th><th>L\u00edneas</th><th>Acciones</th></tr></thead><tbody>';
  arr.forEach(function(h,i){
    var lineasStr='';if(h.pedido&&h.pedido.lineas){h.pedido.lineas.slice(0,3).forEach(function(l){lineasStr+=escH(l.nombre.substring(0,20))+'<br>';});if(h.pedido.lineas.length>3) lineasStr+='...';}
    html+='<tr><td>'+escH(h.fecha)+'</td><td style="font-size:11px;color:var(--text2)">'+escH(h.ref)+'</td><td>'+escH(h.clienteNombre)+'</td><td>'+escH(h.ofertaNombre||'-')+'</td><td>'+h.totalUds+'</td><td style="font-weight:600">'+fmNum(h.total)+' &euro;</td><td style="color:'+(h.portes==='PAGADOS'?'#22c55e':'#f97316')+'">'+h.portes+'</td><td style="font-size:11px">'+lineasStr+'</td>'+
    '<td><div style="display:flex;gap:4px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" onclick="cargarDesdeHistorial('+i+',0)">&rarr;P1</button><button class="btn btn-ghost btn-sm" onclick="cargarDesdeHistorial('+i+',1)">&rarr;P2</button><button class="btn btn-ghost btn-sm" onclick="cargarDesdeHistorial('+i+',2)">&rarr;P3</button></div></td></tr>';
  });
  html+='</tbody></table></div>';document.getElementById('historial-content').innerHTML=html;
}
function cargarDesdeHistorial(hidx,slot){
  var h=state.historial[hidx];if(!h||!h.pedido) return;
  var p=state.pedidos[slot];
  if(p.lineas&&p.lineas.length){if(!confirm('El Pedido '+(slot+1)+' tiene datos. \u00bfSobrescribir?')) return;}
  state.pedidos[slot]=JSON.parse(JSON.stringify(h.pedido));savePedidos();
  currentOrder=slot;
  document.querySelectorAll('.order-tab').forEach(function(t,i){t.classList.toggle('active',i===slot);});
  showPanel('pedidos',document.querySelectorAll('.nav-btn')[0]);
  document.querySelectorAll('.nav-btn').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.nav-btn')[0].classList.add('active');
  renderCurrentOrder();toast('Pedido cargado en slot '+(slot+1));
}

// ██ BLOQUE:HISTORIAL-FIN ██

// ██ BLOQUE:PRODUCTOS-HABITUALES-INICIO ██
function renderProdHabList(ids){
  var div=document.getElementById('cli-prod-hab-list');if(!div) return;
  div.innerHTML='';
  (ids||[]).forEach(function(id){
    var p=getProductoById(id);if(!p) return;
    var tag=document.createElement('div');
    tag.style.cssText='display:inline-flex;align-items:center;gap:6px;background:var(--cobalt);color:#fff;border-radius:20px;padding:4px 10px;font-size:12px;font-weight:600';
    tag.innerHTML=escH(p.nombre)+' <button style="background:none;border:none;color:#fff;cursor:pointer;font-size:14px;padding:0;line-height:1" data-id="'+id+'">&times;</button>';
    tag.querySelector('button').addEventListener('click',function(){removeProdHab(id);});
    div.appendChild(tag);
  });
}
function removeProdHab(id){var ids=(document.getElementById('cli-prod-hab-ids').value||'').split(',').filter(function(x){return x&&x!==id;});document.getElementById('cli-prod-hab-ids').value=ids.join(',');renderProdHabList(ids);}
function addProdHab(id){
  var current=(document.getElementById('cli-prod-hab-ids').value||'').split(',').filter(function(x){return x;});
  if(current.indexOf(id)>-1){toast('Ya est\u00e1 a\u00f1adido','err');return;}
  current.push(id);document.getElementById('cli-prod-hab-ids').value=current.join(',');renderProdHabList(current);
  document.getElementById('cli-productos-habituales').value='';
}
function initProdHabInput(){
  var inp=document.getElementById('cli-productos-habituales');if(!inp) return;
  inp.addEventListener('input',function(){
    var q=inp.value.toLowerCase();if(!q) return;
    var matches=sortProductos(state.productos).filter(function(p){return p.nombre.toLowerCase().indexOf(q)>-1;}).slice(0,6);
    var existingDrop=document.getElementById('cli-prod-hab-drop');if(existingDrop) existingDrop.remove();
    if(!matches.length) return;
    var drop=document.createElement('div');drop.id='cli-prod-hab-drop';
    drop.style.cssText='background:var(--slate);border:1px solid var(--cobalt-light);border-radius:8px;margin-top:4px;overflow:hidden;z-index:50';
    matches.forEach(function(p){
      var item=document.createElement('div');item.style.cssText='padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)';
      item.textContent=p.nombre;
      item.addEventListener('mousedown',function(e){e.preventDefault();addProdHab(p.id);drop.remove();});
      item.addEventListener('mouseover',function(){item.style.background='var(--cobalt)';item.style.color='#fff';});
      item.addEventListener('mouseout',function(){item.style.background='';item.style.color='';});
      drop.appendChild(item);
    });
    inp.parentNode.appendChild(drop);
  });
  inp.addEventListener('blur',function(){setTimeout(function(){var d=document.getElementById('cli-prod-hab-drop');if(d) d.remove();},150);});
}

// ██ BLOQUE:PRODUCTOS-HABITUALES-FIN ██

// ██ BLOQUE:CAMPANAS-INICIO ██
var campTabActual='activas';
function getCampanaEstado(camp){
  var now=new Date(),hoy=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  var preIni=camp.preofertaInicio?parseFechaISO(camp.preofertaInicio):null,preFin=camp.preofertaFin?parseFechaISO(camp.preofertaFin):null;
  var campIni=camp.campanaInicio?parseFechaISO(camp.campanaInicio):null,campFin=camp.campanaFin?parseFechaISO(camp.campanaFin):null;
  if(campIni&&campFin&&hoy>=campIni&&hoy<=campFin) return 'activa';
  if(preIni&&preFin&&hoy>=preIni&&hoy<=preFin) return 'preoferta';
  if(campIni&&hoy<campIni){var dias=Math.floor((campIni-hoy)/(1000*60*60*24));if(dias<=60) return 'proxima';}
  if(campFin&&hoy>campFin) return 'pasada';
  return 'futura';
}
function parseFechaISO(str){if(!str) return null;var p=str.split('-');if(p.length===3) return new Date(+p[0],+p[1]-1,+p[2]);return null;}
function getMejorTramo(camp,dtoCliente){if(!camp.tramos||!camp.tramos.length) return null;var aptos=camp.tramos.filter(function(t){return t.dto>=dtoCliente+(state.config.margenMinDto||3);});if(!aptos.length) return null;return aptos[0];}
function clienteConsume(clienteId,productoIds){
  var c=getClienteById(clienteId);if(!c) return false;
  if(c.productosHabituales&&Array.isArray(c.productosHabituales)){for(var i=0;i<productoIds.length;i++){if(c.productosHabituales.indexOf(productoIds[i])>-1) return true;}}
  var umbralUds=state.config.umbralUnidades||12,umbralPeds=state.config.umbralPedidos||2;
  for(var pi=0;pi<productoIds.length;pi++){
    var pid=productoIds[pi],totalUds=0,numPedidos=0;
    state.historial.forEach(function(h){if(h.clienteId!==clienteId) return;if(!h.pedido||!h.pedido.lineas) return;var enEste=false;h.pedido.lineas.forEach(function(l){if(l.prodId===pid){totalUds+=(l.uds||1);enEste=true;}});if(enEste) numPedidos++;});
    if(totalUds>=umbralUds||numPedidos>=umbralPeds) return true;
  }
  return false;
}
function getCandidatos(camp){
  var estado=getCampanaEstado(camp);if(estado!=='activa'&&estado!=='preoferta'&&estado!=='proxima') return [];
  var prodIds=camp.esLibre?[]:(camp.productoIds||[]);var candidatos=[];
  state.clientes.forEach(function(c){
    var dtoC=parseFloat(c.descuento)||0,mejor=getMejorTramo(camp,dtoC);if(!mejor) return;
    if(!camp.esLibre&&!clienteConsume(c.id,prodIds)) return;
    candidatos.push({cliente:c,mejorTramo:mejor,dtoCliente:dtoC});
  });
  candidatos.sort(function(a,b){return b.mejorTramo.dto-a.mejorTramo.dto;});
  return candidatos;
}
function switchCampTab(tab,btn){campTabActual=tab;document.querySelectorAll('.camp-tab').forEach(function(b){b.classList.remove('active');});if(btn) btn.classList.add('active');renderCampContent();}
function renderCampanas(){campTabActual='activas';document.querySelectorAll('.camp-tab').forEach(function(b,i){b.classList.toggle('active',i===0);});renderCampContent();actualizarBadgeCamp();}
function actualizarBadgeCamp(){
  var badge=document.getElementById('camp-badge');if(!badge) return;
  var activas=state.campanas.filter(function(c){var e=getCampanaEstado(c);return e==='activa'||e==='preoferta';}).length;
  if(activas>0){badge.textContent=activas;badge.classList.remove('hidden');}else{badge.classList.add('hidden');}
}
function renderCampContent(){
  var div=document.getElementById('camp-content');if(!div) return;
  if(campTabActual==='gestion'){div.innerHTML=renderGestionHTML();bindGestionEvents();return;}
  if(campTabActual==='calendario'){div.innerHTML=renderCalendarioHTML();return;}
  var filtro=campTabActual;
  var arr=state.campanas.filter(function(c){var e=getCampanaEstado(c);if(filtro==='activas') return e==='activa'||e==='preoferta';if(filtro==='proximas') return e==='proxima'||e==='futura';return true;});
  if(!arr.length){div.innerHTML='<div class="card" style="text-align:center;padding:32px;color:var(--text3)">'+(filtro==='activas'?'No hay campa\u00f1as activas ahora':filtro==='proximas'?'No hay campa\u00f1as pr\u00f3ximas':'No hay campa\u00f1as configuradas.')+'</div>';return;}
  var html='';arr.forEach(function(camp){html+=renderCampCard(camp,filtro==='activas');});
  div.innerHTML=html;
  div.querySelectorAll('.btn-edit-camp').forEach(function(btn){btn.addEventListener('click',function(){editCampana(btn.dataset.id);});});
  div.querySelectorAll('.btn-del-camp').forEach(function(btn){btn.addEventListener('click',function(){deleteCampana(btn.dataset.id);});});
  div.querySelectorAll('.btn-toggle-cand').forEach(function(btn){btn.addEventListener('click',function(){var sec=document.getElementById('cand-'+btn.dataset.id);if(sec){sec.classList.toggle('hidden');btn.textContent=sec.classList.contains('hidden')?'\u25BC Ver candidatos':'\u25B2 Ocultar';}});});
}
function renderCampCard(camp,mostrarCandidatos){
  var estado=getCampanaEstado(camp);
  var badgeMap={activa:'<span class="camp-badge-activa">\u2713 ACTIVA</span>',preoferta:'<span class="camp-badge-preoferta">\u23F0 PRE-OFERTA</span>',proxima:'<span class="camp-badge-proxima">\u2197 PR\u00d3XIMA</span>',pasada:'<span class="camp-badge-pasada">Pasada</span>',futura:'<span class="camp-badge-pasada">Futura</span>'};
  var tramosHtml='';if(camp.tramos&&camp.tramos.length){camp.tramos.forEach(function(t){tramosHtml+='<span class="camp-tramo">'+t.uds+' uds \u2192 '+t.dto+'%</span>';});}
  var fechasHtml='';
  if(camp.preofertaInicio&&camp.preofertaFin) fechasHtml+='<span>Pre-oferta: '+formatFechaISO(camp.preofertaInicio)+' \u2013 '+formatFechaISO(camp.preofertaFin)+(camp.dtoPrecampana?' ('+camp.dtoPrecampana+'%)':'')+'</span>';
  if(camp.campanaInicio&&camp.campanaFin) fechasHtml+='<span>Campa\u00f1a: '+formatFechaISO(camp.campanaInicio)+' \u2013 '+formatFechaISO(camp.campanaFin)+(camp.dtoCampana?' ('+camp.dtoCampana+'%)':'')+'</span>';
  var candidatos=getCandidatos(camp);var candHtml='';
  if(mostrarCandidatos&&candidatos.length){
    var rows='';
    candidatos.slice(0,10).forEach(function(cd){rows+='<div class="camp-cand-item"><div><div class="camp-cand-nombre">'+escH(cd.cliente.nombreCompleto)+'</div><div class="camp-cand-sub">'+(cd.cliente.nombreComercial?escH(cd.cliente.nombreComercial)+' \u00b7 ':'')+escH(cd.cliente.localidad||'')+'</div></div><div class="camp-cand-dto">'+cd.dtoCliente+'% \u2192 '+cd.mejorTramo.dto+'% ('+cd.mejorTramo.uds+' uds)</div></div>';});
    if(candidatos.length>10) rows+='<div style="font-size:12px;color:var(--text3);padding-top:6px">... y '+(candidatos.length-10)+' m\u00e1s</div>';
    candHtml='<div class="camp-candidatos"><div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:8px">'+candidatos.length+' cliente'+(candidatos.length!==1?'s':'')+' candidato'+(candidatos.length!==1?'s':'')+' (campa\u00f1a compensa)</div>'+rows+'</div>';
  }
  return '<div class="camp-card"><div class="camp-card-header"><div><div class="camp-card-name">'+escH(camp.nombre)+'</div>'+(camp.esLibre?'<div class="camp-productos" style="color:#6ee7b7">Oferta libre</div>':'<div class="camp-productos">'+escH(camp.productosNombre||'Productos no especificados')+'</div>')+'</div><div style="display:flex;gap:6px;align-items:center">'+(badgeMap[estado]||'')+'</div></div>'+
    '<div class="camp-meta">'+fechasHtml+'<span>'+camp.envios+' env\u00edo'+(camp.envios!==1?'s':'')+'</span></div>'+
    '<div class="camp-tramos">'+tramosHtml+'</div>'+
    '<div class="camp-actions">'+(mostrarCandidatos&&candidatos.length?'<button class="btn btn-ghost btn-sm btn-toggle-cand" data-id="'+camp.id+'">\u25BC Ver candidatos ('+candidatos.length+')</button>':'')+
    '<button class="btn btn-ghost btn-sm btn-edit-camp" data-id="'+camp.id+'">Editar</button><button class="btn btn-danger btn-sm btn-del-camp" data-id="'+camp.id+'">&times;</button></div>'+
    (mostrarCandidatos&&candidatos.length?'<div id="cand-'+camp.id+'" class="hidden">'+candHtml+'</div>':'')+
  '</div>';
}
function formatFechaISO(str){if(!str) return '';var p=str.split('-');return p[2]+'/'+p[1]+'/'+p[0];}
function renderCalendarioHTML(){
  var meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],year=new Date().getFullYear();
  var html='<div class="card"><div class="card-title">Calendario '+year+'</div>';
  html+='<div style="display:flex;gap:4px;margin-bottom:8px;overflow-x:auto">';
  meses.forEach(function(m){html+='<div style="min-width:60px;flex:1;font-size:10px;font-weight:700;color:var(--text2);text-align:center">'+m+'</div>';});
  html+='</div>';
  if(!state.campanas.length){html+='<div style="text-align:center;padding:20px;color:var(--text3)">Sin campa\u00f1as.</div>';}
  state.campanas.forEach(function(camp){
    html+='<div style="display:flex;gap:4px;margin-bottom:6px;overflow-x:auto;align-items:center">';
    for(var m=0;m<12;m++){
      var mesIni=new Date(year,m,1),mesFin=new Date(year,m+1,0),esCamp=false,esPre=false;
      if(camp.campanaInicio&&camp.campanaFin){var ci=parseFechaISO(camp.campanaInicio),cf=parseFechaISO(camp.campanaFin);if(ci&&cf&&ci<=mesFin&&cf>=mesIni) esCamp=true;}
      if(!esCamp&&camp.preofertaInicio&&camp.preofertaFin){var pi2=parseFechaISO(camp.preofertaInicio),pf2=parseFechaISO(camp.preofertaFin);if(pi2&&pf2&&pi2<=mesFin&&pf2>=mesIni) esPre=true;}
      html+='<div style="min-width:60px;flex:1;height:10px;border-radius:3px;background:'+(esCamp?'#047857':esPre?'#d97706':'var(--border)')+'" title="'+escH(camp.nombre)+'"></div>';
    }
    html+='</div><div style="font-size:11px;color:var(--text2);margin-bottom:8px;padding-left:2px">'+escH(camp.nombre)+'</div>';
  });
  html+='<div style="display:flex;gap:16px;margin-top:12px;font-size:12px;color:var(--text2)"><span><span style="display:inline-block;width:12px;height:12px;background:#047857;border-radius:2px;margin-right:4px;vertical-align:middle"></span>Campa\u00f1a activa</span><span><span style="display:inline-block;width:12px;height:12px;background:#d97706;border-radius:2px;margin-right:4px;vertical-align:middle"></span>Pre-oferta</span></div></div>';
  return html;
}
function renderGestionHTML(){
  var html='<div class="card"><div class="card-title">Nueva Campa\u00f1a</div>'+
    '<div class="form-row"><div class="form-group"><label>Nombre de la campa\u00f1a *</label><input type="text" id="camp-nombre" placeholder="Ej: Ergymag Primavera 2026"></div>'+
    '<div class="form-group" style="flex:0 0 180px"><label>N\u00ba env\u00edos</label><select id="camp-envios"><option value="1">1 env\u00edo</option><option value="2" selected>2 env\u00edos</option><option value="3">3 env\u00edos</option></select></div></div>'+
    '<div class="form-row"><div class="form-group"><label>Producto del cat\u00e1logo *</label><input type="text" id="camp-productos" placeholder="Ej: ERGYMAG 90, ERGYMAG 180 \u2014 dejar vac\u00edo si es oferta libre"></div></div>'+
    '<div class="form-row"><div class="form-group"><label>Inicio precampa\u00f1a</label><input type="date" id="camp-pre-ini"></div><div class="form-group"><label>Fin precampa\u00f1a</label><input type="date" id="camp-pre-fin"></div><div class="form-group" style="flex:0 0 110px"><label>Dto precampa\u00f1a%</label><input type="number" id="camp-dto-pre" min="0" max="99" placeholder="0"></div></div>'+
    '<div class="form-row"><div class="form-group"><label>Inicio campa\u00f1a *</label><input type="date" id="camp-ini"></div><div class="form-group"><label>Fin campa\u00f1a *</label><input type="date" id="camp-fin"></div><div class="form-group" style="flex:0 0 110px"><label>Dto campa\u00f1a%</label><input type="number" id="camp-dto-camp" min="0" max="99" placeholder="0"></div></div>'+
    '<div class="form-row"><div class="form-group"><label>Tramos (formato: uds:dto, separados por , )</label><input type="text" id="camp-tramos" placeholder="Ej: 6:35,12:37,24:41,48:45,72:49"></div></div>'+
    '<input type="hidden" id="camp-editing-id">'+
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px"><button class="btn btn-success" onclick="saveCampana()">Guardar Campa\u00f1a</button><button class="btn btn-ghost hidden" id="btn-cancel-camp" onclick="cancelCampana()">Cancelar</button></div>'+
    '<div style="margin-top:12px;font-size:12px;color:var(--text3)">Importar desde CSV: <input type="file" id="camp-csv" accept=".csv" style="display:none" onchange="importCampanasCSV(event)"><button class="btn btn-ghost btn-sm" onclick="abrirCampCSV()">&#128190; Importar CSV</button></div></div>';
  if(state.campanas.length){
    html+='<div class="card"><div class="card-title">Campa\u00f1as configuradas ('+state.campanas.length+')</div>';
    state.campanas.forEach(function(camp){
      var estado=getCampanaEstado(camp);var badgeMap={activa:'\u2713 Activa',preoferta:'\u23F0 Pre-oferta',proxima:'\u2197 Pr\u00f3xima',pasada:'Pasada',futura:'Futura'};
      html+='<div class="client-item"><div style="flex:1"><div class="item-name">'+escH(camp.nombre)+'</div><div class="item-sub">'+(camp.campanaInicio?formatFechaISO(camp.campanaInicio)+' \u2013 '+formatFechaISO(camp.campanaFin):'Sin fechas')+' \u00b7 '+(badgeMap[estado]||estado)+'</div></div>'+
        '<div class="item-actions"><button class="btn btn-ghost btn-sm btn-edit-camp2" data-id="'+camp.id+'">Editar</button><button class="btn btn-danger btn-sm btn-del-camp2" data-id="'+camp.id+'">&times;</button></div></div>';
    });
    html+='</div>';
  }
  return html;
}
function saveCampana(){
  var nombre=document.getElementById('camp-nombre').value.trim();if(!nombre){toast('El nombre es obligatorio','err');return;}
  var tramosStr=document.getElementById('camp-tramos').value.trim(),tramos=[];
  if(tramosStr){tramosStr.split(',').forEach(function(t){var p=t.trim().split(':');if(p.length===2){var uds=parseInt(p[0]),dto=parseInt(p[1]);if(uds>0&&dto>0) tramos.push({uds:uds,dto:dto});}});tramos.sort(function(a,b){return a.uds-b.uds;});}
  var prodStr=document.getElementById('camp-productos').value.trim(),esLibre=!prodStr,productosNombre=prodStr,productoIds=[];
  if(!esLibre){prodStr.split(',').forEach(function(pn){var pnl=pn.trim().toLowerCase();var found=state.productos.find(function(p){return p.nombre.toLowerCase().indexOf(pnl)>-1;});if(found) productoIds.push(found.id);});}
  var editId=document.getElementById('camp-editing-id').value;
  var obj={id:editId||uid(),nombre:nombre,envios:parseInt(document.getElementById('camp-envios').value)||2,preofertaInicio:document.getElementById('camp-pre-ini').value||'',preofertaFin:document.getElementById('camp-pre-fin').value||'',campanaInicio:document.getElementById('camp-ini').value||'',campanaFin:document.getElementById('camp-fin').value||'',dtoPrecampana:parseFloat((document.getElementById('camp-dto-pre')||{}).value)||0,dtoCampana:parseFloat((document.getElementById('camp-dto-camp')||{}).value)||0,esLibre:esLibre,productosNombre:productosNombre,productoIds:productoIds,tramos:tramos};
  if(editId){var idx=state.campanas.findIndex(function(c){return c.id===editId;});if(idx>-1) state.campanas[idx]=obj;else state.campanas.push(obj);}
  else{state.campanas.push(obj);}
  saveState();actualizarBadgeCamp();toast('Campa\u00f1a guardada \u2713');cancelCampana();renderCampContent();
}
function cancelCampana(){['camp-nombre','camp-pre-ini','camp-pre-fin','camp-ini','camp-fin','camp-dto-pre','camp-dto-camp','camp-productos','camp-tramos','camp-editing-id'].forEach(function(id){var el=document.getElementById(id);if(el) el.value='';});var envEl=document.getElementById('camp-envios');if(envEl) envEl.value='2';var btnCan=document.getElementById('btn-cancel-camp');if(btnCan) btnCan.classList.add('hidden');}
function editCampana(id){
  var camp=state.campanas.find(function(c){return c.id===id;});if(!camp) return;
  switchCampTab('gestion',null);document.querySelectorAll('.camp-tab').forEach(function(b,i){b.classList.toggle('active',i===4);});
  setTimeout(function(){
    var n=document.getElementById('camp-nombre');if(n) n.value=camp.nombre||'';
    var e=document.getElementById('camp-envios');if(e) e.value=camp.envios||2;
    var pi=document.getElementById('camp-pre-ini');if(pi) pi.value=camp.preofertaInicio||'';
    var pf=document.getElementById('camp-pre-fin');if(pf) pf.value=camp.preofertaFin||'';
    var ci=document.getElementById('camp-ini');if(ci) ci.value=camp.campanaInicio||'';
    var cf=document.getElementById('camp-fin');if(cf) cf.value=camp.campanaFin||'';
    var pr=document.getElementById('camp-productos');if(pr) pr.value=camp.productosNombre||'';
    var dpre=document.getElementById('camp-dto-pre');if(dpre) dpre.value=camp.dtoPrecampana||'';
    var dcamp=document.getElementById('camp-dto-camp');if(dcamp) dcamp.value=camp.dtoCampana||'';
    var tr=document.getElementById('camp-tramos');if(tr) tr.value=(camp.tramos||[]).map(function(t){return t.uds+':'+t.dto;}).join(',');
    var ei=document.getElementById('camp-editing-id');if(ei) ei.value=camp.id;
    var bc=document.getElementById('btn-cancel-camp');if(bc) bc.classList.remove('hidden');
    bindGestionEvents();
  },50);
}
function deleteCampana(id){if(!confirm('\u00bfEliminar esta campa\u00f1a?')) return;state.campanas=state.campanas.filter(function(c){return c.id!==id;});saveState();actualizarBadgeCamp();renderCampContent();toast('Campa\u00f1a eliminada');}
function bindGestionEvents(){var div=document.getElementById('camp-content');if(!div) return;div.querySelectorAll('.btn-edit-camp2').forEach(function(btn){btn.addEventListener('click',function(){editCampana(btn.dataset.id);});});div.querySelectorAll('.btn-del-camp2').forEach(function(btn){btn.addEventListener('click',function(){deleteCampana(btn.dataset.id);});});}
function abrirCampCSV(){var el=document.getElementById('camp-csv');if(el) el.click();}
function importCampanasCSV(e){
  var file=e.target.files[0];if(!file) return;
  var reader=new FileReader();
  reader.onload=function(ev){
    var lines=ev.target.result.split('\n');var count=0;
    lines.forEach(function(raw){
      var line=raw.trim();if(!line) return;var sep=detectSep(line);var cols=line.split(sep).map(function(s){return s.trim().replace(/^"+|"+$/g,'');});
      if(cols[0].toUpperCase().indexOf('NOMBRE')>-1) return;if(!cols[0]) return;
      var tramos=[];if(cols[7]){cols[7].split(',').forEach(function(t){var p=t.trim().split(':');if(p.length===2){var u=parseInt(p[0]),d=parseInt(p[1]);if(u>0&&d>0) tramos.push({uds:u,dto:d});}});}
      var prodStr=cols[6]||'',esLibre=!prodStr.trim(),productoIds=[];
      if(!esLibre){prodStr.split('|').forEach(function(pn){var found=state.productos.find(function(p){return p.nombre.toLowerCase().indexOf(pn.trim().toLowerCase())>-1;});if(found) productoIds.push(found.id);});}
      state.campanas.push({id:uid(),nombre:cols[0],preofertaInicio:cols[1]||'',preofertaFin:cols[2]||'',campanaInicio:cols[3]||'',campanaFin:cols[4]||'',envios:parseInt(cols[5])||2,esLibre:esLibre,productosNombre:prodStr,productoIds:productoIds,tramos:tramos});count++;
    });
    saveState();actualizarBadgeCamp();renderCampContent();toast(count+' campa\u00f1as importadas \u2713');
  };
  reader.readAsText(file,'UTF-8');e.target.value='';
}

// ██ BLOQUE:CAMPANAS-FIN ██

// ██ BLOQUE:AJUSTES-INICIO ██
function renderAcumuladoMensual(){
  var div=document.getElementById('acumulado-mensual-grid');if(!div) return;
  var ahora=new Date();
  var meses=[];
  for(var i=11;i>=0;i--){
    var d=new Date(ahora.getFullYear(),ahora.getMonth()-i,1);
    var key=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2);
    var label=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]+' '+String(d.getFullYear()).slice(-2);
    var datos=state.acumuladoMensual[key]||{total:0,uds:0,pedidos:0};
    meses.push({key:key,label:label,datos:datos});
  }
  var maxTotal=Math.max.apply(null,meses.map(function(m){return m.datos.total;}));
  var html='<table style="width:100%;border-collapse:collapse;font-size:12px">';
  html+='<thead><tr><th style="text-align:left;padding:6px 8px;color:var(--text2);font-weight:700">Mes</th><th style="text-align:right;padding:6px 8px;color:var(--text2);font-weight:700">Pedidos</th><th style="text-align:right;padding:6px 8px;color:var(--text2);font-weight:700">Uds</th><th style="text-align:right;padding:6px 8px;color:var(--text2);font-weight:700">Total €</th><th style="padding:6px 8px;color:var(--text2);font-weight:700;width:80px">Barra</th></tr></thead><tbody>';
  meses.forEach(function(m){
    var esMesActual=m.key===(ahora.getFullYear()+'-'+('0'+(ahora.getMonth()+1)).slice(-2));
    var pct=maxTotal>0?Math.round((m.datos.total/maxTotal)*100):0;
    html+='<tr style="border-bottom:1px solid var(--border)'+(esMesActual?';background:rgba(37,99,235,0.1)':'')+'">';
    html+='<td style="padding:7px 8px;font-weight:'+(esMesActual?'700':'400')+';color:'+(esMesActual?'var(--cobalt-light)':'var(--text)')+'">'+m.label+(esMesActual?' ◀':'')+'</td>';
    html+='<td style="text-align:right;padding:7px 8px;color:var(--text2)">'+m.datos.pedidos+'</td>';
    html+='<td style="text-align:right;padding:7px 8px;color:var(--text2)">'+m.datos.uds+'</td>';
    html+='<td style="text-align:right;padding:7px 8px;font-weight:600;color:var(--cobalt-light)">'+fmNum(m.datos.total)+'</td>';
    html+='<td style="padding:7px 8px"><div style="background:var(--border);border-radius:3px;height:8px"><div style="background:var(--cobalt);border-radius:3px;height:8px;width:'+pct+'%;transition:width .3s"></div></div></td>';
    html+='</tr>';
  });
  html+='</tbody></table>';
  div.innerHTML=html;
}
function renderStats(){
  var totalHist=0;state.historial.forEach(function(h){totalHist+=h.total||0;});
  var sinStock=Object.values(state.stock).filter(function(v){return v;}).length;
  document.getElementById('stats-grid').innerHTML=
    '<div class="stat-card"><div class="stat-value">'+state.clientes.length+'</div><div class="stat-label">Clientes</div></div>'+
    '<div class="stat-card"><div class="stat-value">'+state.productos.length+'</div><div class="stat-label">Productos</div></div>'+
    '<div class="stat-card"><div class="stat-value">'+state.ofertas.length+'</div><div class="stat-label">Ofertas</div></div>'+
    '<div class="stat-card"><div class="stat-value">'+state.historial.length+'</div><div class="stat-label">Historial</div></div>'+
    '<div class="stat-card"><div class="stat-value" style="font-size:16px">'+fmNum(totalHist)+' &euro;</div><div class="stat-label">EUR historial</div></div>'+
    '<div class="stat-card"><div class="stat-value" style="color:var(--red)">'+sinStock+'</div><div class="stat-label">Sin stock</div></div>';
  renderAcumuladoMensual();
  renderContador5050();
}
function renderContador5050(){
  var div=document.getElementById('contador-5050');if(!div) return;
  var mesKey=(function(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2);})();
  var datos=state.acumuladoMensual[mesKey]||{tienda:0,medico:0,pedidos:0};
  var t=datos.tienda||0,m=datos.medico||0,total=t+m;
  var pctT=total>0?Math.round((t/total)*100):0;
  var pctM=total>0?Math.round((m/total)*100):0;
  var colorT=pctT>=50?'#6ee7b7':'#fcd34d';
  var colorM=pctM>=50?'#6ee7b7':'#fcd34d';
  div.innerHTML=
    '<div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;margin-bottom:8px">Balance Tienda / Médico — '+(['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][new Date().getMonth()])+' '+new Date().getFullYear()+'</div>'+
    '<div style="display:flex;gap:8px;margin-bottom:8px">'+
      '<div style="flex:1;background:var(--slate2);border-radius:8px;padding:10px;text-align:center">'+
        '<div style="font-size:22px;font-weight:700;color:'+colorT+'">'+t+'</div>'+
        '<div style="font-size:11px;color:var(--text2)">🏪 Tienda</div>'+
        '<div style="font-size:11px;color:'+colorT+';font-weight:700">'+pctT+'%</div>'+
      '</div>'+
      '<div style="flex:1;background:var(--slate2);border-radius:8px;padding:10px;text-align:center">'+
        '<div style="font-size:22px;font-weight:700;color:'+colorM+'">'+m+'</div>'+
        '<div style="font-size:11px;color:var(--text2)">🩺 Médico</div>'+
        '<div style="font-size:11px;color:'+colorM+';font-weight:700">'+pctM+'%</div>'+
      '</div>'+
    '</div>'+
    '<div style="background:var(--slate2);border-radius:6px;overflow:hidden;height:10px;display:flex">'+
      '<div style="width:'+pctT+'%;background:#6ee7b7;transition:width .4s"></div>'+
      '<div style="width:'+pctM+'%;background:#60a5fa;transition:width .4s"></div>'+
    '</div>'+
    '<div style="font-size:11px;color:var(--text3);margin-top:5px;text-align:center">'+total+' pedidos categorizados este mes</div>';
}
function saveConfig(){state.config={umbralUnidades:parseInt(document.getElementById('cfg-umbral-uds').value)||12,umbralPedidos:parseInt(document.getElementById('cfg-umbral-peds').value)||2,margenMinDto:parseInt(document.getElementById('cfg-margen-dto').value)||3};saveState();toast('Configuraci\u00f3n guardada \u2713');}
function saveDelegado(){state.delegado=document.getElementById('ajuste-delegado').value.trim();saveState();toast('Delegado guardado \u2713');}
function exportarBackup(){
  var data={clientes:state.clientes,productos:state.productos,ofertas:state.ofertas,pedidos:state.pedidos,historial:state.historial,stock:state.stock,delegado:state.delegado,campanas:state.campanas,config:state.config};
  var json=JSON.stringify(data,null,2),blob=new Blob([json],{type:'application/json'});
  var d=new Date(),fname='backup_pedidos_'+d.getDate()+'-'+(d.getMonth()+1)+'-'+d.getFullYear()+'.json';
  if(navigator.share&&navigator.canShare){var file=new File([blob],fname,{type:'application/json'});if(navigator.canShare({files:[file]})){navigator.share({files:[file],title:'Backup Franez',text:'Backup de datos Franez CRM'}).then(function(){toast('Backup compartido \u2713');}).catch(function(err){if(err.name!=='AbortError') descargarBackup(blob,fname);});return;}}
  descargarBackup(blob,fname);
}
function descargarBackup(blob,fname){var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fname;a.click();toast('Backup descargado \u2713');}
function importarBackup(e){
  var file=e.target.files[0];if(!file) return;
  var reader=new FileReader();
  reader.onload=function(ev){
    try{var data=JSON.parse(ev.target.result);if(data.clientes) state.clientes=data.clientes;if(data.productos) state.productos=data.productos;if(data.ofertas) state.ofertas=data.ofertas;if(data.pedidos) state.pedidos=data.pedidos;if(data.historial) state.historial=data.historial;if(data.stock) state.stock=data.stock;if(data.delegado) state.delegado=data.delegado;if(data.campanas) state.campanas=data.campanas;if(data.config) state.config=Object.assign({},state.config,data.config);saveState();renderStats();refreshOfertaSelect();updateStockBadge();toast('Backup restaurado \u2713');}catch(err){toast('Error: '+err.message,'err');}
  };
  reader.readAsText(file,'UTF-8');e.target.value='';
}
function borrarTipo(tipo){
  if(!confirm('\u00bfEliminar todos los datos de '+tipo+'?')) return;
  if(tipo==='clientes') state.clientes=[];else if(tipo==='productos') state.productos=[];else if(tipo==='ofertas'){state.ofertas=[];refreshOfertaSelect();}else if(tipo==='stock'){state.stock={};updateStockBadge();}else if(tipo==='historial') state.historial=[];else if(tipo==='pedidos'){state.pedidos=[{clienteId:'',ofertaId:'',lineas:[],portes:'auto',dtoActual:0,notas:''},{clienteId:'',ofertaId:'',lineas:[],portes:'auto',dtoActual:0,notas:''},{clienteId:'',ofertaId:'',lineas:[],portes:'auto',dtoActual:0,notas:''}];renderCurrentOrder();}
  saveState();renderStats();toast(tipo+' eliminados');
}
function subirDatosFirebase(){
  if (!window._fbDb || !window._fbSet || !window._fbRef) {
    toast('⚠️ Firebase no disponible aún, espera unos segundos y vuelve a intentarlo');
    return;
  }
  if (!confirm('¿Subir todos tus datos locales a la nube? Esto sobrescribirá lo que haya en Firebase.')) return;
  var now = Date.now();
  var payload = {
    clientes: state.clientes,
    productos: state.productos,
    ofertas: state.ofertas,
    historial: state.historial,
    stock: state.stock,
    delegado: state.delegado||'',
    campanas: state.campanas,
    config: state.config,
    acumuladoMensual: state.acumuladoMensual||{},
    _ts: now
  };
  window._fbSet(window._fbRef(window._fbDb, 'franez'), payload)
    .then(function(){ localStorage.setItem('franez_ts', now); toast('☁️ Datos subidos a la nube ✓'); })
    .catch(function(e){ toast('⚠️ Error al subir: ' + e.message); });
}
function borrarTodo(){if(!confirm('Esta accion es IRREVERSIBLE. \u00bfEliminar TODOS los datos?')) return;localStorage.clear();loadState();saveState();refreshOfertaSelect();renderCurrentOrder();renderStats();updateStockBadge();toast('Todos los datos eliminados');}

var ZONAS_DEFAULT=['Bahía de Cádiz','Jerez','Sevilla Norte','Sevilla Sur','Huelva','Ronda','Sierra de Cádiz','Almería','Granada','Málaga','Córdoba','Cádiz Interior'];
var ZONAS_ESPECIALES=['Teletrabajo','Congreso'];

function getZonasPersonalizadas(){
  try{var z=localStorage.getItem('franez_zonas');return z?JSON.parse(z):ZONAS_DEFAULT.slice();}catch(e){return ZONAS_DEFAULT.slice();}
}
function saveZonasPersonalizadas(zonas){
  localStorage.setItem('franez_zonas',JSON.stringify(zonas));
}
function getZonasDisponibles(){
  var base=getZonasPersonalizadas();
  state.clientes.forEach(function(c){if(c.zonaVisita&&base.indexOf(c.zonaVisita)===-1) base.push(c.zonaVisita);});
  return base.sort();
}
function addZona(){
  var input=document.getElementById('zona-nueva-input');
  var val=(input.value||'').trim();
  if(!val){toast('Escribe el nombre de la zona','err');return;}
  var zonas=getZonasPersonalizadas();
  if(zonas.indexOf(val)!==-1){toast('Esa zona ya existe','err');return;}
  zonas.push(val);
  saveZonasPersonalizadas(zonas);
  input.value='';
  renderZonasList();
  toast('Zona añadida ✓');
}
function deleteZona(nombre){
  if(!confirm('¿Eliminar la zona "'+nombre+'"?')) return;
  var zonas=getZonasPersonalizadas().filter(function(z){return z!==nombre;});
  saveZonasPersonalizadas(zonas);
  renderZonasList();
  toast('Zona eliminada');
}
function renderZonasList(){
  var lista=document.getElementById('zonas-lista');
  var especiales=document.getElementById('zonas-especiales-lista');
  if(!lista||!especiales) return;
  var zonas=getZonasPersonalizadas();
  lista.innerHTML=zonas.map(function(z){
    return '<span style="display:inline-flex;align-items:center;gap:6px;background:var(--slate2);border:1px solid var(--border);border-radius:8px;padding:4px 10px;font-size:13px">'+
      z+'<button onclick="deleteZona(decodeURIComponent(\''+encodeURIComponent(z)+'\'))" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;line-height:1;padding:0">&times;</button></span>';
  }).join('');
  especiales.innerHTML=ZONAS_ESPECIALES.map(function(z){
    return '<span style="display:inline-flex;align-items:center;gap:6px;background:var(--slate);border:1px solid var(--border);border-radius:8px;padding:4px 10px;font-size:13px;color:var(--text2)">'+z+'</span>';
  }).join('');
}

// ██ BLOQUE:AJUSTES-FIN ██

// ██ BLOQUE:PANEL-IA-INICIO ██
function initIAPanel(){var key=localStorage.getItem('ia_api_key')||'';var inp=document.getElementById('ia-api-key');if(inp) inp.value=key;}
function onApiKeyChange(){localStorage.setItem('ia_api_key',document.getElementById('ia-api-key').value);}
function onIAClienteChange(id){var c=getClienteById(id);var div=document.getElementById('ia-cliente-info');if(c){var parts=[];if(c.nombreComercial) parts.push(escH(c.nombreComercial));if(c.localidad) parts.push(escH(c.localidad));if(c.descuento) parts.push('Dto: '+c.descuento+'%');div.innerHTML=parts.join(' &bull; ');}else{div.innerHTML='';}}
function limpiarIA(){document.getElementById('ia-texto').value='';document.getElementById('ia-result-zone').innerHTML='';document.getElementById('cb-ia-cliente-input').value='';document.getElementById('cb-ia-cliente-val').value='';document.getElementById('ia-cliente-info').innerHTML='';iaResultado=null;}
function parsearIA(){
  var clienteId=document.getElementById('cb-ia-cliente-val').value;if(!clienteId){toast('Selecciona un cliente primero','err');return;}
  var texto=document.getElementById('ia-texto').value.trim();if(!texto){toast('Pega el mensaje del cliente primero','err');return;}
  if(!state.productos.length){toast('No tienes productos en el cat\u00e1logo','err');return;}
  var cliObj=getClienteById(clienteId);
  var catalogo=sortProductos(state.productos).map(function(p){return 'ID:'+p.id+' | '+p.nombre+' | PVP:'+fmNum(p.pvp)+' EUR';}).join('\n');
  var prompt='Eres un asistente de ventas. Tu tarea es interpretar un mensaje de un cliente y extraer los productos que quiere pedir.\n\nCAT\u00c1LOGO:\n'+catalogo+'\n\nCLIENTE: '+(cliObj?cliObj.nombreCompleto:'')+'\n\nMENSAJE:\n"'+texto+'"\n\nResponde SOLO con JSON v\u00e1lido:\n{"lineas":[{"textoOriginal":"","uds":1,"estado":"ok|ambiguo|no_encontrado","productoId":"ID_exacto_o_null","productoNombre":"nombre_o_null","opciones":[{"productoId":"","nombre":"","pvp":0}]}],"observaciones":""}';
  var btn=document.getElementById('btn-ia-parse');btn.disabled=true;
  document.getElementById('ia-result-zone').innerHTML='<div class="ia-spinner-wrap"><div class="ia-spinner"></div><div style="color:var(--text2);font-size:14px">Analizando\u2026</div></div>';
  fetch("https://blue-disk-5051.francisnzv.workers.dev/",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:texto})})
  .then(function(r){if(!r.ok){return r.text().then(function(t){throw new Error("Error: "+t);});}return r.json();})
  .then(function(data){
    btn.disabled=false;if(data.error){throw new Error(data.error);}
    data.lineas.forEach(function(l){if(!l.productoTexto) return;var found=state.productos.find(function(p){return p.nombre.toLowerCase().includes(l.productoTexto.toLowerCase());});if(found){l.productoId=found.id;l.productoNombre=found.nombre;}});
    data._clienteId=clienteId;iaResultado=data;renderIAResultado(data,clienteId);
  })
  .catch(function(err){btn.disabled=false;document.getElementById('ia-result-zone').innerHTML='<div style="background:#7f1d1d;border:1px solid var(--red);border-radius:10px;padding:16px;color:#fecaca"><strong>Error:</strong> '+escH(err.message)+'</div>';});
}
function renderIAResultado(parsed,clienteId){
  if(!parsed||!parsed.lineas){document.getElementById('ia-result-zone').innerHTML='<div style="color:var(--red);padding:16px">Respuesta inesperada</div>';return;}
  var ok=0,amb=0,nf=0;parsed.lineas.forEach(function(l){if(l.estado==='ok') ok++;else if(l.estado==='ambiguo') amb++;else nf++;});
  var cliObj=getClienteById(clienteId),totalUds=0;parsed.lineas.forEach(function(l){totalUds+=parseInt(l.uds)||1;});
  var html='<div class="card"><div class="card-title">&#10024; Resultado <span style="background:var(--slate2);color:var(--text2);border-radius:6px;padding:2px 8px;font-size:12px;font-weight:400;text-transform:none">'+parsed.lineas.length+' productos</span></div>';
  html+='<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">';
  if(ok) html+='<span style="background:#14532d;color:#86efac;border-radius:6px;padding:4px 12px;font-size:13px;font-weight:700">\u2713 '+ok+' ok</span>';
  if(amb) html+='<span style="background:#78350f;color:#fde68a;border-radius:6px;padding:4px 12px;font-size:13px;font-weight:700">? '+amb+' ambiguo</span>';
  if(nf) html+='<span style="background:#7f1d1d;color:#fca5a5;border-radius:6px;padding:4px 12px;font-size:13px;font-weight:700">\u2717 '+nf+' no encontrado</span>';
  html+='</div>';
  if(parsed.observaciones) html+='<div style="background:var(--slate2);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:var(--text2);font-style:italic">'+escH(parsed.observaciones)+'</div>';
  parsed.lineas.forEach(function(l,i){
    var p=l.productoId?getProductoById(l.productoId):null;
    html+='<div class="ia-line-card" id="ia-line-'+i+'"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div style="flex:1"><div style="font-size:13px;color:var(--text2);font-style:italic;margin-bottom:4px">"'+escH(l.productoTexto)+'"</div>';
    if(l.estado==='ok'){html+='<div style="color:#22c55e;font-weight:600;font-size:13px">\u2713 '+escH(l.productoNombre||'')+(p?' &bull; '+fmPlain(p.pvp):'')+'</div>';}
    else if(l.estado==='ambiguo'){html+='<div style="color:#f59e0b;font-weight:600;font-size:13px;margin-bottom:6px">? Ambiguo</div><select style="background:var(--slate2);color:var(--text);padding:8px 12px;border-radius:8px;font-size:14px;width:100%;min-height:40px;border:1px solid #f59e0b" onchange="seleccionarProductoAmbig('+i+',this.value)"><option value="">-- Elegir --</option>'+(l.opciones?l.opciones.map(function(op){return '<option value="'+op.productoId+'">'+escH(op.nombre)+'</option>';}).join(''):'')+'</select>';}
    else{html+='<div style="color:#f87171;font-weight:600;font-size:13px;margin-bottom:6px">\u2717 No encontrado</div><select style="background:var(--slate2);color:var(--text);padding:8px 12px;border-radius:8px;font-size:14px;width:100%;min-height:40px;border:1px solid var(--red)" onchange="asignarManualIA('+i+',this.value)"><option value="">-- Elegir --</option><option value="__ignore">Ignorar</option>'+sortProductos(state.productos).map(function(prod){return '<option value="'+prod.id+'">'+escH(prod.nombre)+'</option>';}).join('')+'</select>';}
    html+='</div><div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0"><div style="display:flex;align-items:center;gap:4px"><button onclick="cambiarUdsIA('+i+',-1)" style="background:var(--slate2);color:#fff;border:none;border-radius:6px;width:30px;height:30px;font-size:18px;cursor:pointer">&#8722;</button><input type="number" value="'+(l.uds||1)+'" min="1" style="width:52px;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:4px;border-radius:6px;font-size:14px;text-align:center" onchange="actualizarUdsIA('+i+',this.value)"><button onclick="cambiarUdsIA('+i+',1)" style="background:var(--slate2);color:#fff;border:none;border-radius:6px;width:30px;height:30px;font-size:18px;cursor:pointer">+</button></div><div style="font-size:11px;color:var(--text3)">uds</div></div><button onclick="eliminarLineaIA('+i+')" style="background:var(--red);color:#fff;border:none;border-radius:6px;width:30px;height:30px;font-size:16px;cursor:pointer">&times;</button></div></div>';
  });
  html+='<div class="ia-summary-bar"><div class="ia-summary-stat"><div class="ia-summary-val">'+parsed.lineas.length+'</div><div class="ia-summary-label">Productos</div></div><div class="ia-summary-stat"><div class="ia-summary-val">'+totalUds+'</div><div class="ia-summary-label">Unidades</div></div><div class="ia-summary-stat" style="flex:1"><div style="font-weight:700;color:#fff;font-size:15px">'+(cliObj?escH(cliObj.nombreCompleto):'')+'</div></div><button class="btn btn-ai" onclick="cargarPedidoIA()" style="min-height:48px;padding:0 24px;font-size:15px">&#128228; Cargar en pedido</button></div></div>';
  document.getElementById('ia-result-zone').innerHTML=html;
}
function cambiarUdsIA(idx,delta){if(!iaResultado||!iaResultado.lineas[idx]) return;var n=parseInt(iaResultado.lineas[idx].uds||1)+delta;if(n<1) n=1;iaResultado.lineas[idx].uds=n;renderIAResultado(iaResultado,iaResultado._clienteId);}
function actualizarUdsIA(idx,v){if(!iaResultado||!iaResultado.lineas[idx]) return;var n=parseInt(v)||1;if(n<1) n=1;iaResultado.lineas[idx].uds=n;}
function seleccionarProductoAmbig(idx,prodId){if(!iaResultado||!iaResultado.lineas[idx]) return;if(!prodId) return;var p=getProductoById(prodId);if(!p) return;iaResultado.lineas[idx].estado='ok';iaResultado.lineas[idx].productoId=prodId;iaResultado.lineas[idx].productoNombre=p.nombre;renderIAResultado(iaResultado,iaResultado._clienteId);}
function asignarManualIA(idx,prodId){if(!iaResultado||!iaResultado.lineas[idx]) return;if(prodId==='__ignore'){iaResultado.lineas[idx].estado='ignorar';renderIAResultado(iaResultado,iaResultado._clienteId);return;}if(!prodId) return;var p=getProductoById(prodId);if(!p) return;iaResultado.lineas[idx].estado='ok';iaResultado.lineas[idx].productoId=prodId;iaResultado.lineas[idx].productoNombre=p.nombre;renderIAResultado(iaResultado,iaResultado._clienteId);}
function eliminarLineaIA(idx){if(!iaResultado||!iaResultado.lineas) return;iaResultado.lineas.splice(idx,1);renderIAResultado(iaResultado,iaResultado._clienteId);}
function cargarPedidoIA(){
  if(!iaResultado||!iaResultado.lineas||!iaResultado.lineas.length){toast('Sin l\u00edneas para cargar','err');return;}
  var clienteId=iaResultado._clienteId||'';
  var lineasOk=iaResultado.lineas.filter(function(l){return l.estado==='ok'&&l.productoId;});
  var sinAsignar=iaResultado.lineas.filter(function(l){return l.estado!=='ok'&&l.estado!=='ignorar';});
  if(!lineasOk.length){toast('No hay l\u00edneas identificadas','err');return;}
  var slot=-1;for(var i=0;i<3;i++){if(!state.pedidos[i].lineas||!state.pedidos[i].lineas.length){slot=i;break;}}
  if(slot<0){if(!confirm('Todos los pedidos tienen datos. \u00bfSobrescribir Pedido 1?')) return;slot=0;}
  var cliObj=getClienteById(clienteId),dto=cliObj?parseFloat(cliObj.descuento)||0:0;
  var lineas=lineasOk.map(function(l){var p=getProductoById(l.productoId);return {id:uid(),prodId:l.productoId,nombre:p?p.nombre:l.productoNombre||'',pvp:p?p.pvp:0,costo:p?p.costo:0,dto:dto,uds:parseInt(l.uds)||1};});
  state.pedidos[slot]={clienteId:clienteId,ofertaId:'',lineas:lineas,portes:'auto',dtoActual:dto,notas:iaResultado.observaciones||''};
  savePedidos();currentOrder=slot;
  document.querySelectorAll('.order-tab').forEach(function(t,i){t.classList.toggle('active',i===slot);});
  showPanel('pedidos',null);document.querySelectorAll('.nav-btn').forEach(function(b,i){b.classList.toggle('active',i===0);});
  renderCurrentOrder();
  // Mostrar líneas pendientes en el panel de pedidos - con selector para asignar
  if(sinAsignar.length){
    var divPend=document.getElementById('ia-pendientes');
    var listPend=document.getElementById('ia-pendientes-list');
    if(divPend&&listPend){
      // Guardar pendientes en estado para poder asignarlos
      state.pedidos[slot]._iaPendientes=sinAsignar.map(function(l){
        return {texto:l.productoTexto||l.textoOriginal||'?',uds:parseInt(l.uds)||1};
      });
      savePedidos();
      listPend.innerHTML=sinAsignar.map(function(l,pi){
        var opts=sortProductos(state.productos).map(function(p){return '<option value="'+p.id+'">'+escH(p.nombre)+'</option>';}).join('');
        return '<div style="margin-bottom:8px;padding:6px 0;border-bottom:1px solid rgba(146,64,14,0.3)">'+
          '<div style="font-weight:700;margin-bottom:4px">\u2022 '+escH(l.productoTexto||l.textoOriginal||'?')+(l.uds&&l.uds>1?' ('+l.uds+' uds)':'')+'</div>'+
          '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+
          '<select style="background:#0f172a;color:#fff;padding:6px 10px;border-radius:6px;font-size:13px;flex:1;min-height:36px;border:1px solid #92400e" onchange="asignarPendienteIA('+slot+','+pi+',this.value,this)">'+
          '<option value="">-- Asignar producto --</option>'+
          '<option value="__ignore">Ignorar</option>'+opts+'</select>'+
          '<input type="number" value="'+(l.uds||1)+'" min="1" placeholder="uds" style="width:52px;background:#0f172a;border:1px solid #92400e;color:#fff;padding:6px;border-radius:6px;font-size:13px;text-align:center" id="pend-uds-'+pi+'">'+
          '</div></div>';
      }).join('');
      divPend.classList.remove('hidden');
    }
  }
  limpiarIA();toast('Pedido cargado en slot '+(slot+1)+' con '+lineas.length+' productos\u2713'+(sinAsignar.length?' \u2014 '+sinAsignar.length+' pendientes':''));
}


function abrirEmailPendientes(){
  mostrarMiniModal(
    '<div style="padding:16px">'+
    '<div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:4px">&#9993; Email "Faltan oídos cocina"</div>'+
    '<div style="font-size:12px;color:var(--text3);margin-bottom:10px">Pega aquí lo que te ha devuelto Gemini con los pedidos pendientes:</div>'+
    '<textarea id="mm-gemini-resp" style="width:100%;min-height:120px;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:8px;font-size:13px;resize:vertical;font-family:inherit" placeholder="Pega aquí la respuesta de Gemini..."></textarea>'+
    '<div style="display:flex;gap:8px;margin-top:10px">'+
    '<button class="btn btn-primary btn-sm" style="flex:1" onclick="generarEmailPendientes()">&#9993; Generar email</button>'+
    '<button class="btn btn-ghost btn-sm" style="flex:1" onclick="cerrarMiniModal()">Cancelar</button>'+
    '</div></div>'
  );
}
function generarEmailPendientes(){
  var resp=document.getElementById('mm-gemini-resp');
  if(!resp||!resp.value.trim()){toast('Pega la respuesta de Gemini primero','err');return;}
  var texto=resp.value.trim();
  // Extraer líneas que parecen pendientes (✗ o PENDIENTES)
  var lineas=texto.split('\n').filter(function(l){
    return l.trim() && (l.indexOf('\u2717')>-1||l.indexOf('PENDIENTE')>-1||l.indexOf('pendiente')>-1||l.match(/^\s*[-\u2022\*]\s+/));
  });
  var hoy=new Date();
  var fechaStr=('0'+hoy.getDate()).slice(-2)+'/'+('0'+(hoy.getMonth()+1)).slice(-2)+'/'+hoy.getFullYear();
  var cuerpo='Hola,\n\n';
  cuerpo+='Te escribo porque aún no he recibido confirmación ("oído cocina") de los siguientes pedidos del día '+fechaStr+':\n\n';
  if(lineas.length){
    lineas.forEach(function(l){
      // Limpiar iconos y espacios
      var limpia=l.replace(/[\u2717\u2713\u2714\u274c\*\-\u2022]/g,'').replace(/PENDIENTE[S]?/gi,'').trim();
      if(limpia) cuerpo+='  \u2022 '+limpia+'\n';
    });
  } else {
    // Si no detecta estructura, usar el texto tal cual
    cuerpo+=texto+'\n';
  }
  cuerpo+='\nEn cuanto los tengáis confirmados, podéis borrar los que ya estén.\n';
  cuerpo+='\nGracias,\n'+state.delegado+'\n';
  cuerpo+='\n--- Generado con Franez CRM ---';
  var asunto='Me faltan oídos cocina — '+fechaStr;
  var mailto='mailto:pedidos@nutergia.es?subject='+encodeURIComponent(asunto)+'&body='+encodeURIComponent(cuerpo);
  cerrarMiniModal();
  window.location.href=mailto;
}
function asignarPendienteIA(slot,pendIdx,prodId,selectEl){
  if(!prodId) return;
  var p=state.pedidos[slot];
  var udsEl=document.getElementById('pend-uds-'+pendIdx);
  var uds=udsEl?parseInt(udsEl.value)||1:1;
  if(prodId==='__ignore'){
    // Marcar como ignorada — quitar del DOM
    var row=selectEl?selectEl.closest('div[style*="border-bottom"]'):null;
    if(row) row.remove();
    toast('L\u00ednea ignorada');
    return;
  }
  var prod=getProductoById(prodId);if(!prod) return;
  var dto=p.dtoActual||0;
  p.lineas.push({id:uid(),prodId:prod.id,nombre:prod.nombre,pvp:prod.pvp,costo:prod.costo,dto:dto,uds:uds,notas:[]});
  savePedidos();renderLineas();renderSummary();
  // Quitar esta línea del panel pendientes
  var row=selectEl?selectEl.closest('div[style*="border-bottom"]'):null;
  if(row) row.remove();
  // Si no quedan pendientes, ocultar el panel
  var listPend=document.getElementById('ia-pendientes-list');
  if(listPend&&!listPend.querySelector('select')) document.getElementById('ia-pendientes').classList.add('hidden');
  toast(escH(prod.nombre)+' a\u00f1adido al pedido \u2713');
}
// ██ BLOQUE:PANEL-IA-FIN ██

// ██ BLOQUE:AVISOS-CAMPANAS-INICIO ██
function mostrarAvisoCampLinea(prodId){
  var div=document.getElementById('aviso-camp-linea');
  var txt=document.getElementById('aviso-camp-linea-text');
  if(!div||!txt) return;
  var prod=getProductoById(prodId);
  if(!prod){div.classList.add('hidden');return;}
  // Descuento actual del cliente en este pedido
  var p=state.pedidos[currentOrder];
  var dtoActual=p.dtoActual||0;
  var udsActuales=parseInt(document.getElementById('inp-uds').value)||1;
  var prodNombre=prod.nombre.toLowerCase();
  // Buscar campañas activas/preoferta con este producto
  var avisos=[];
  state.campanas.forEach(function(camp){
    var estado=getCampanaEstado(camp);
    if(estado!=='activa'&&estado!=='preoferta') return;
    if(camp.esLibre) return;
    if(!camp.productosNombre) return;
    var coincide=camp.productosNombre.split(',').some(function(pn){
      var pnl=pn.trim().toLowerCase();
      return prodNombre.indexOf(pnl)>-1||pnl.indexOf(prodNombre)>-1;
    });
    if(!coincide) return;
    // Buscar el tramo que alcanza con las uds actuales Y mejora el dto
    var margen=state.config.margenMinDto||3;
    var tramosValidos=(camp.tramos||[]).filter(function(t){
      return t.uds<=udsActuales&&t.dto>=(dtoActual+margen);
    });
    if(!tramosValidos.length) return;
    var mejorTramo=tramosValidos[tramosValidos.length-1];
    var mejora=mejorTramo.dto-dtoActual;
    avisos.push({camp:camp,estado:estado,tramo:mejorTramo,mejora:mejora});
  });
  if(!avisos.length){div.classList.add('hidden');return;}
  var a=avisos[0];
  var esPre=a.estado==='preoferta';
  txt.innerHTML=(esPre?'\u23f0 PRECAMPA\u00d1A':'\u26a1 CAMPA\u00d1A')+' <strong>'+escH(a.camp.nombre)+'</strong>: con '+a.tramo.uds+' uds tienes <strong>'+a.tramo.dto+'%</strong> (+'+a.mejora+' sobre tu '+dtoActual+'%)';
  div.classList.remove('hidden');
}
function mostrarAvisosAcumulados(clienteId){
  var div=document.getElementById('aviso-camp-acumulado');if(!div) return;
  if(!clienteId){div.classList.add('hidden');div.innerHTML='';return;}
  var UMBRALES=[12,24,48,72];
  var resultados=[];
  state.campanas.forEach(function(camp){
    var estado=getCampanaEstado(camp);
    if(estado!=='activa'&&estado!=='preoferta') return;
    if(camp.esLibre) return;
    var prodIds=(camp.productoIds||[]).slice();
    if(!prodIds.length&&camp.productosNombre){
      camp.productosNombre.split(',').forEach(function(pn){
        var pnl=pn.trim().toLowerCase();
        state.productos.forEach(function(p){
          if(p.nombre.toLowerCase().indexOf(pnl)>-1||pnl.indexOf(p.nombre.toLowerCase())>-1) prodIds.push(p.id);
        });
      });
    }
    if(!prodIds.length) return;
    var totalUds=0;
    state.historial.forEach(function(h){
      if(h.clienteId!==clienteId) return;
      if(!h.pedido||!h.pedido.lineas) return;
      h.pedido.lineas.forEach(function(l){if(prodIds.indexOf(l.prodId)>-1) totalUds+=(l.uds||1);});
    });
    if(!totalUds) return;
    var umbralSig=null;
    for(var i=0;i<UMBRALES.length;i++){if(UMBRALES[i]>totalUds){umbralSig=UMBRALES[i];break;}}
    var umbralAlcanzado=0;
    for(var j=0;j<UMBRALES.length;j++){if(totalUds>=UMBRALES[j]) umbralAlcanzado=UMBRALES[j];}
    resultados.push({camp:camp,estado:estado,totalUds:totalUds,umbralSig:umbralSig,umbralAlcanzado:umbralAlcanzado});
  });
  if(!resultados.length){div.classList.add('hidden');div.innerHTML='';return;}
  var h='<div class="aviso-camp-acum"><div class="aviso-camp-acum-title">&#128202; Acumulados en campañas activas</div>';
  resultados.forEach(function(r){
    var estadoTxt=r.estado==='activa'?'<span style="color:#6ee7b7;font-weight:700">CAMPAÑA</span>':'<span style="color:#fcd34d;font-weight:700">PRECAMPAÑA</span>';
    var msg;
    if(r.umbralSig){
      var faltan=r.umbralSig-r.totalUds;
      msg='⚡ <strong>'+escH(r.camp.nombre)+'</strong> ('+estadoTxt+'): '+r.totalUds+' uds acumuladas — con <strong>'+faltan+' más</strong> llegas a <strong>'+r.umbralSig+' uds</strong>';
    }else{
      msg='✅ <strong>'+escH(r.camp.nombre)+'</strong> ('+estadoTxt+'): '+r.totalUds+' uds — <strong>umbral máximo ('+r.umbralAlcanzado+' uds) alcanzado</strong>';
    }
    h+='<div class="aviso-camp-acum-item">'+msg+'</div>';
  });
  h+='</div>';
  div.innerHTML=h;div.classList.remove('hidden');
}
// ██ BLOQUE:AVISOS-CAMPANAS-FIN ██

// ██ BLOQUE:VISITAS-PLANIFICADOR-INICIO ██
var visitaTabActual='semana';
var semanaOffset=0; // 0=semana actual, 1=siguiente, -1=anterior

function switchVisitaTab(tab, btn){
  visitaTabActual=tab;
  ['semana','zona','briefing'].forEach(function(t){
    var el=document.getElementById('visita-tab-'+t);
    if(el) el.style.display=t===tab?'block':'none';
  });
  document.querySelectorAll('#panel-visitas .camp-tab').forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');
  if(tab==='semana') renderPlanificadorSemanal();
  if(tab==='zona') initZonaSelector();
  if(tab==='briefing'){renderRutaDia();renderAgenda14();}
}

function getLunesDeSemana(offset){
  var hoy=new Date();
  var dia=hoy.getDay()||7; // lunes=1...domingo=7
  var lunes=new Date(hoy);
  lunes.setDate(hoy.getDate()-(dia-1)+(offset*7));
  lunes.setHours(0,0,0,0);
  return lunes;
}

function fechaStr(d){
  return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();
}

function fechaISO(d){
  return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
}

function getSemanaState(){
  try{var v=localStorage.getItem('planSemana');return v?JSON.parse(v):{};}catch(e){return {};}
}

function saveSemanaState(s){localStorage.setItem('planSemana',JSON.stringify(s));}

function navegarSemana(dir){
  if(dir===0) semanaOffset=0; else semanaOffset+=dir;
  renderPlanificadorSemanal();
}

function calcSemaforo(cli){
  // Sin datos de visita
  if(!cli.tipoVisita||cli.tipoVisita==='') return 'gris';
  var hoy=new Date(); hoy.setHours(0,0,0,0);
  var dias=parseInt(cli.diasVisita)||90;
  var uv=cli.ultimaVisita?new Date(cli.ultimaVisita):null;
  var diasDesde=uv?Math.floor((hoy-uv)/(1000*60*60*24)):9999;
  var pct=uv?(diasDesde/dias):2;
  // Alertas extra: campaña activa o contrato próximo
  var tieneAlerta=false;
  if(cli.contrato){var dv=diasParaVencer(cli.contrato);if(dv>=0&&dv<=30) tieneAlerta=true;}
  var campsActivas=state.campanas.filter(function(c){var e=getCampanaEstado(c);return e==='activa'||e==='preoferta';});
  if(campsActivas.length&&(cli.tipoVisita==='A'||cli.tipoVisita==='B')) tieneAlerta=true;

  if(pct>=1.2||(pct>=0.8&&tieneAlerta)||(cli.tipoVisita==='A'&&pct>=0.9)) return 'rojo';
  if(pct>=0.8||tieneAlerta) return 'amarillo';
  if(pct>=0) return 'verde';
  return 'gris';
}

function renderPlanificadorSemanal(){
  var lunes=getLunesDeSemana(semanaOffset);
  var hoy=new Date(); hoy.setHours(0,0,0,0);
  var dias=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var planState=getSemanaState();

  // Label semana
  var viernes=new Date(lunes); viernes.setDate(lunes.getDate()+4);
  document.getElementById('semana-label').textContent=fechaStr(lunes)+' – '+fechaStr(viernes);

  // Calcular qué clientes ya están asignados en OTROS días (exclusión cruzada)
  var clientesOcupados={};
  for(var d=0;d<6;d++){
    var fdCheck=new Date(lunes); fdCheck.setDate(lunes.getDate()+d);
    var isoCheck=fechaISO(fdCheck);
    var zonaCheck=planState[isoCheck]||'';
    if(zonaCheck){
      getClientesPorZona(zonaCheck).forEach(function(c){
        if(!clientesOcupados[c.id]) clientesOcupados[c.id]=[];
        clientesOcupados[c.id].push(isoCheck);
      });
    }
  }

  var html='';
  for(var i=0;i<6;i++){
    var fecha=new Date(lunes); fecha.setDate(lunes.getDate()+i);
    var iso=fechaISO(fecha);
    var esHoy=fecha.getTime()===hoy.getTime();
    var zonaAsignada=planState[iso]||'';
    var prospData=planState[iso+'_prosp']||{activo:false,zona:'',notas:''};

    html+='<div class="dia-col">';
    html+='<div class="dia-col-header'+(esHoy?' hoy':'')+'">' +
      '<span>'+(esHoy?'⚡ ':'')+dias[i]+' '+('0'+fecha.getDate()).slice(-2)+'/'+('0'+(fecha.getMonth()+1)).slice(-2)+'</span>'+
    '</div>';

    // Selector de zona principal
    var zonas=getZonasDisponibles();
    html+='<select onchange="asignarZonaDia(\''+iso+'\',this.value)" style="width:100%;min-height:36px;font-size:12px;background:var(--slate);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:4px 8px;margin-bottom:6px">'+
      '<option value="">-- Sin zona --</option>'+
      zonas.map(function(z){return '<option value="'+z+'"'+(z===zonaAsignada?' selected':'')+'>'+z+'</option>';}).join('')+
    '</select>';

    // Toggle prospección por día
    var prospActivo=prospData.activo;
    html+='<div style="margin-bottom:8px">';
    html+='<button onclick="toggleProspeccion(\''+iso+'\')" style="width:100%;background:'+(prospActivo?'var(--cobalt)':'var(--slate2)')+';color:'+(prospActivo?'#fff':'var(--text2)')+';border:1px solid '+(prospActivo?'var(--cobalt)':'var(--border)')+';border-radius:6px;padding:5px 8px;font-size:12px;cursor:pointer;font-weight:'+(prospActivo?'700':'400')+'">'+
      '🔍 '+(prospActivo?'Prospectando':'Prospección')+
    '</button>';
    if(prospActivo){
      html+='<div style="margin-top:5px;display:flex;flex-direction:column;gap:4px">'+
        '<input type="text" placeholder="Zona libre..." value="'+escH(prospData.zona||'')+'" '+
          'onchange="guardarProspeccion(\''+iso+'\',this.value,document.getElementById(\'prosp-notas-'+iso+'\').value)" '+
          'style="width:100%;background:var(--slate2);border:1px solid var(--cobalt);color:var(--text);padding:5px 8px;border-radius:6px;font-size:12px">'+
        '<textarea id="prosp-notas-'+iso+'" placeholder="Notas de prospección..." '+
          'onchange="guardarProspeccion(\''+iso+'\',this.previousElementSibling.value,this.value)" '+
          'style="width:100%;background:var(--slate2);border:1px solid var(--cobalt);color:var(--text);padding:5px 8px;border-radius:6px;font-size:12px;min-height:56px;resize:vertical;font-family:inherit">'+escH(prospData.notas||'')+'</textarea>'+
      '</div>';
    }
    html+='</div>';

    // Clientes de esa zona con semáforo + exclusión cruzada
    if(zonaAsignada){
      var cliZona=getClientesPorZona(zonaAsignada);
      if(cliZona.length){
        cliZona.sort(function(a,b){
          var sa=calcSemaforo(a),sb=calcSemaforo(b);
          var orden={rojo:0,amarillo:1,verde:2,gris:3};
          if(orden[sa]!==orden[sb]) return orden[sa]-orden[sb];
          var ta=a.tipoVisita||'Z',tb=b.tipoVisita||'Z';
          return ta.localeCompare(tb);
        });
        var mostrados=0;
        cliZona.forEach(function(c){
          // Excluir si ya aparece en otro día distinto de este
          var otrosDias=(clientesOcupados[c.id]||[]).filter(function(d){return d!==iso;});
          if(otrosDias.length) return;
          if(mostrados>=8) return;
          var sem=calcSemaforo(c);
          var icon={rojo:'🔴',amarillo:'🟡',verde:'🟢',gris:'⚪'}[sem];
          var tipo=c.tipoVisita?'<span style="background:var(--cobalt);color:#fff;border-radius:4px;padding:1px 6px;font-size:11px;margin-left:4px">'+c.tipoVisita+'</span>':'';
          var uv=c.ultimaVisita?'<span style="font-size:11px;opacity:.7"> · '+c.ultimaVisita+'</span>':'';
          html+='<div class="visita-card semaforo-'+sem+'" onclick="verBriefingDesde(\''+c.id+'\')">'+
            icon+' <strong>'+escH(c.nombreCompleto)+'</strong>'+tipo+uv+
          '</div>';
          mostrados++;
        });
        var totalVisibles=cliZona.filter(function(c){
          return !((clientesOcupados[c.id]||[]).filter(function(d){return d!==iso;}).length);
        }).length;
        if(totalVisibles>8) html+='<div style="font-size:11px;color:var(--text3);text-align:center;padding:4px">+'+(totalVisibles-8)+' más</div>';
        if(totalVisibles===0) html+='<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px">Sin clientes disponibles esta semana</div>';
      } else {
        html+='<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px">Sin clientes en '+zonaAsignada+'</div>';
      }
    }
    html+='</div>';
  }
  document.getElementById('semana-dias-grid').innerHTML=html;
}

function toggleProspeccion(iso){
  var s=getSemanaState();
  var key=iso+'_prosp';
  var actual=s[key]||{activo:false,zona:'',notas:''};
  actual.activo=!actual.activo;
  s[key]=actual;
  saveSemanaState(s);
  renderPlanificadorSemanal();
}

function guardarProspeccion(iso,zona,notas){
  var s=getSemanaState();
  var key=iso+'_prosp';
  var actual=s[key]||{activo:true,zona:'',notas:''};
  actual.zona=zona||'';
  actual.notas=notas||'';
  s[key]=actual;
  saveSemanaState(s);
}

function getClientesPorZona(zona){
  return state.clientes.filter(function(c){
    return (c.zonaVisita||'').toLowerCase()===zona.toLowerCase() && c.tipoVisita && c.tipoVisita!=='';
  });
}

function verBriefingDesde(clienteId){
  switchVisitaTab('briefing', document.querySelectorAll('#panel-visitas .camp-tab')[2]);
  setTimeout(function(){
    var c=getClienteById(clienteId);
    if(c){
      document.getElementById('cb-visita-cliente-input').value=c.nombreCompleto;
      document.getElementById('cb-visita-cliente-val').value=clienteId;
      renderBriefing(clienteId);
    }
  },50);
}

function initZonaSelector(){
  var sel=document.getElementById('sel-zona-visita');
  if(!sel) return;
  var zonas=getZonasDisponibles();
  sel.innerHTML='<option value="">-- Seleccionar zona --</option>'+
    zonas.map(function(z){return '<option value="'+z+'">'+z+'</option>';}).join('');
}

function renderClientesPorZona(){
  var zona=document.getElementById('sel-zona-visita').value;
  var tipo=document.getElementById('sel-tipo-visita').value;
  var div=document.getElementById('clientes-zona-content');
  if(!zona){div.innerHTML='';return;}
  var clis=getClientesPorZona(zona).filter(function(c){return !tipo||c.tipoVisita===tipo;});
  clis.sort(function(a,b){
    var sa=calcSemaforo(a),sb=calcSemaforo(b);
    var orden={rojo:0,amarillo:1,verde:2,gris:3};
    if(orden[sa]!==orden[sb]) return orden[sa]-orden[sb];
    return (a.tipoVisita||'Z').localeCompare(b.tipoVisita||'Z');
  });
  if(!clis.length){div.innerHTML='<div style="text-align:center;padding:24px;color:var(--text3)">Sin clientes en esta zona</div>';return;}
  var html='<div style="display:flex;flex-direction:column;gap:6px">';
  clis.forEach(function(c){
    var sem=calcSemaforo(c);
    var icon={rojo:'🔴',amarillo:'🟡',verde:'🟢',gris:'⚪'}[sem];
    var tipo=c.tipoVisita?'<span style="background:var(--cobalt);color:#fff;border-radius:4px;padding:1px 6px;font-size:11px;margin-left:4px">'+c.tipoVisita+'</span>':'';
    var diasInfo='';
    if(c.ultimaVisita){
      var hoy=new Date();hoy.setHours(0,0,0,0);
      var uv=new Date(c.ultimaVisita);
      var diasDesde=Math.floor((hoy-uv)/(1000*60*60*24));
      diasInfo='<span style="font-size:11px;opacity:.7"> · Última: '+c.ultimaVisita+' ('+diasDesde+' días)</span>';
    } else {
      diasInfo='<span style="font-size:11px;opacity:.7"> · Sin visita registrada</span>';
    }
    var frecInfo=c.diasVisita?'<span style="font-size:11px;opacity:.7"> · Cada '+c.diasVisita+' días</span>':'';
    html+='<div class="visita-card semaforo-'+sem+'" onclick="verBriefingDesde(\''+c.id+'\');switchVisitaTab(\'briefing\',document.querySelectorAll(\'#panel-visitas .camp-tab\')[2])">'+
      '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'+
      icon+' <strong>'+escH(c.nombreCompleto)+'</strong>'+tipo+
      '</div>'+
      '<div style="margin-top:3px">'+diasInfo+frecInfo+'</div>'+
      '<button onclick="event.stopPropagation();registrarVisitaHoy(\''+c.id+'\')" style="margin-top:6px;background:var(--cobalt);color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer">✓ Registrar visita hoy</button>'+
    '</div>';
  });
  html+='</div>';
  div.innerHTML=html;
}

function registrarVisitaHoy(clienteId){
  var c=getClienteById(clienteId);
  if(!c) return;
  var hoy=new Date();
  c.ultimaVisita=fechaISO(hoy);
  saveState();
  toast('Visita registrada para '+escH(c.nombreCompleto)+' ✓');
  renderClientesPorZona();
  renderPlanificadorSemanal();
}

function initVisitasPanel(){
  initComboboxVisitaCliente();
  switchVisitaTab('semana', document.querySelectorAll('#panel-visitas .camp-tab')[0]);
}

// ██ BLOQUE:VISITAS-PLANIFICADOR-FIN ██

// ██ BLOQUE:VISITAS-BRIEFING-INICIO ██
function initComboboxVisitaCliente(){
  var inp=document.getElementById('cb-visita-cliente-input');
  var list=document.getElementById('cb-visita-cliente-list');
  var hid=document.getElementById('cb-visita-cliente-val');
  if(!inp) return;
  inp.addEventListener('input',function(){
    var q=inp.value.toLowerCase();
    var items=sortClientes(state.clientes).filter(function(c){
      return !q||(c.nombreCompleto||'').toLowerCase().indexOf(q)>-1||(c.nombreComercial||'').toLowerCase().indexOf(q)>-1;
    }).slice(0,10);
    list.innerHTML='';
    if(!items.length){list.innerHTML='<div class="cb-empty">Sin resultados</div>';list.classList.add('open');return;}
    items.forEach(function(c){
      var div=document.createElement('div');div.className='cb-item';
      div.innerHTML='<div>'+escH(c.nombreCompleto)+'</div>'+(c.nombreComercial?'<div class="cb-item-sub">'+escH(c.nombreComercial)+'</div>':'');
      div.addEventListener('mousedown',function(e){e.preventDefault();hid.value=c.id;inp.value=c.nombreCompleto;list.classList.remove('open');renderBriefing(c.id);});
      list.appendChild(div);
    });
    list.classList.add('open');
  });
  inp.addEventListener('blur',function(){setTimeout(function(){list.classList.remove('open');},150);});
  inp.addEventListener('focus',function(){if(inp.value) inp.dispatchEvent(new Event('input'));});
}
function renderBriefing(clienteId){
  var c=getClienteById(clienteId);
  var div=document.getElementById('briefing-content');
  if(!c||!div) return;
  // Escalado
  var vol=parseFloat(c.volumenExterno)||0;
  var tramo=getTramoByVol(vol);
  var dtoC=parseFloat(c.descuento)||0;
  // Último pedido en historial
  var ultPed=state.historial.find(function(h){return h.clienteId===clienteId;});
  // Campañas activas donde el cliente puede participar
  var campsActivas=state.campanas.filter(function(camp){
    var est=getCampanaEstado(camp);
    return est==='activa'||est==='preoferta';
  });
  var html='<div style="display:flex;flex-direction:column;gap:10px">';
  // Info básica
  html+='<div style="background:var(--slate2);border-radius:8px;padding:12px 14px">';
  html+='<div style="font-weight:700;font-size:15px;margin-bottom:6px">'+escH(c.nombreCompleto)+'</div>';
  if(c.nombreComercial) html+='<div style="font-size:13px;color:var(--text2)">'+escH(c.nombreComercial)+'</div>';
  if(c.localidad) html+='<div style="font-size:13px;color:var(--text2)">&#128205; '+escH(c.localidad+(c.provincia?', '+c.provincia:''))+'</div>';
  if(c.telefono||c.movil) html+='<div style="font-size:13px;color:var(--text2)">&#128222; '+(c.telefono||c.movil)+'</div>';
  html+='</div>';
  // Escalado y descuento
  html+='<div style="background:var(--slate2);border-radius:8px;padding:12px 14px">';
  html+='<div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;margin-bottom:8px">Escalado &amp; Condiciones</div>';
  html+='<div style="font-size:13px;margin-bottom:4px">Descuento: <strong style="color:var(--cobalt-light)">'+dtoC+'%</strong></div>';
  html+='<div style="font-size:13px;margin-bottom:4px">Volumen externo: <strong>'+fmNum(vol)+' €</strong> → Tramo <strong>'+tramo.dto+'%</strong></div>';
  if(c.contrato){
    var dias=diasParaVencer(c.contrato);
    var color=dias<0?'#f87171':dias<=30?'#fcd34d':'#6ee7b7';
    html+='<div style="font-size:13px">Contrato: <strong style="color:'+color+'">'+formatContratoDisplay(c.contrato)+(dias<0?' (vencido '+Math.abs(dias)+' días)':dias<=30?' (vence en '+dias+' días)':'')+'</strong></div>';
  }
  html+='</div>';
  // Último pedido
  if(ultPed){
    html+='<div style="background:var(--slate2);border-radius:8px;padding:12px 14px">';
    html+='<div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;margin-bottom:6px">Último Pedido</div>';
    html+='<div style="font-size:13px">'+escH(ultPed.fecha)+' — <strong>'+fmNum(ultPed.total)+' €</strong> ('+ultPed.totalUds+' uds)</div>';
    if(ultPed.pedido&&ultPed.pedido.lineas){
      html+='<div style="font-size:12px;color:var(--text2);margin-top:4px">';
      ultPed.pedido.lineas.slice(0,4).forEach(function(l){html+=escH(l.nombre)+' ×'+l.uds+'<br>';});
      if(ultPed.pedido.lineas.length>4) html+='...';
      html+='</div>';
    }
    html+='</div>';
  }
  // Campañas activas relevantes + indicador si le compensa
  if(campsActivas.length){
    html+='<div style="background:#064e3b;border:1px solid #047857;border-radius:8px;padding:12px 14px">';
    html+='<div style="font-size:12px;font-weight:700;color:#6ee7b7;text-transform:uppercase;margin-bottom:6px">Campañas activas / precampaña</div>';
    campsActivas.forEach(function(camp){
      var est=getCampanaEstado(camp);
      var badge=est==='activa'?'<span class="camp-badge-activa">ACTIVA</span>':'<span class="camp-badge-preoferta">PRECAMPAÑA</span>';
      var candidatos=getCandidatos(camp);
      var esCandiato=candidatos.some(function(cd){return cd.cliente.id===c.id;});
      var candBadge=esCandiato?'<span style="background:#1d4ed8;color:#bfdbfe;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:4px">✓ Le compensa</span>':'';
      html+='<div style="font-size:13px;margin-bottom:4px">'+badge+' '+escH(camp.nombre)+candBadge+'</div>';
    });
    html+='</div>';
  }
  // Nota próximo pedido
  if(c.notaProximoPedido){
    html+='<div style="background:#1e3a5f;border:1px solid #1d4ed8;border-radius:8px;padding:12px 14px">';
    html+='<div style="font-size:12px;font-weight:700;color:#93c5fd;text-transform:uppercase;margin-bottom:6px">📝 Nota próximo pedido</div>';
    html+='<div style="font-size:13px;color:var(--text)">'+escH(c.notaProximoPedido)+'</div>';
    html+='</div>';
  }
  // Datos de visita
  if(c.tipoVisita||c.zonaVisita||c.diasVisita){
    var hoy2=new Date();hoy2.setHours(0,0,0,0);
    var sem=calcSemaforo(c);
    var semColor={rojo:'#f87171',amarillo:'#fcd34d',verde:'#6ee7b7',gris:'var(--text3)'}[sem];
    var semIcon={rojo:'🔴',amarillo:'🟡',verde:'🟢',gris:'⚪'}[sem];
    var diasDesde2='';
    if(c.ultimaVisita){
      var uv2=new Date(c.ultimaVisita);
      diasDesde2=Math.floor((hoy2-uv2)/(1000*60*60*24))+' días';
    }
    html+='<div style="background:var(--slate2);border-radius:8px;padding:12px 14px">';
    html+='<div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;margin-bottom:8px">Visitas</div>';
    html+='<div style="font-size:13px;margin-bottom:4px">'+semIcon+' Prioridad: <strong style="color:'+semColor+'">'+sem.toUpperCase()+'</strong></div>';
    if(c.tipoVisita) html+='<div style="font-size:13px;margin-bottom:4px">Tipo: <strong>'+c.tipoVisita+'</strong></div>';
    if(c.zonaVisita) html+='<div style="font-size:13px;margin-bottom:4px">Zona: <strong>'+escH(c.zonaVisita)+'</strong></div>';
    if(c.diasVisita) html+='<div style="font-size:13px;margin-bottom:4px">Frecuencia: cada <strong>'+c.diasVisita+' días</strong></div>';
    if(c.ultimaVisita) html+='<div style="font-size:13px;margin-bottom:8px">Última visita: <strong>'+c.ultimaVisita+'</strong> ('+diasDesde2+')</div>';
    else html+='<div style="font-size:13px;color:#f87171;margin-bottom:8px">Sin visita registrada</div>';
    html+='<button onclick="registrarVisitaHoy(\''+c.id+'\')" style="background:var(--cobalt);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;width:100%">✓ Registrar visita hoy</button>';
    html+='</div>';
  }
  // Notas
  if(c.notas){
    html+='</div>';
  }
  html+='</div>';
  div.innerHTML=html;
}
function diasParaVencer(fechaStr){
  if(!fechaStr) return 9999;
  var p=fechaStr.split('-');if(p.length<3) return 9999;
  var fin=new Date(+p[0],+p[1]-1,+p[2]);
  var hoy=new Date();hoy.setHours(0,0,0,0);
  return Math.round((fin-hoy)/(1000*60*60*24));
}
// ---- RUTA DEL DÍA ----
function getRutaHoy(){
  var hoy=todayStr();
  if(!state.rutaDia||state.rutaDia.fecha!==hoy){
    state.rutaDia={fecha:hoy,clientes:[]};
    localStorage.setItem('rutaDia',JSON.stringify(state.rutaDia));
  }
  return state.rutaDia;
}
function saveRuta(){localStorage.setItem('rutaDia',JSON.stringify(state.rutaDia));}
function loadRuta(){
  try{var v=localStorage.getItem('rutaDia');if(v) state.rutaDia=JSON.parse(v);}catch(e){}
  getRutaHoy(); // asegura que sea de hoy
}
function addClienteRuta(){
  var clis=sortClientes(state.clientes);
  if(!clis.length){toast('No hay clientes','err');return;}
  var ruta=getRutaHoy();
  var yaIds=ruta.clientes.map(function(r){return r.id;});
  var disponibles=clis.filter(function(c){return yaIds.indexOf(c.id)<0;});
  if(!disponibles.length){toast('Todos los clientes ya están en la ruta','err');return;}
  var html='<div style="padding:16px">'+
    '<label style="font-size:13px;color:var(--text2);font-weight:600;display:block;margin-bottom:8px">Añadir a la ruta:</label>'+
    '<div style="position:relative;margin-bottom:12px">'+
    '<input type="text" id="mm-ruta-inp" placeholder="Escribe el nombre..." autocomplete="off" style="width:100%;min-height:44px;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:10px 32px 10px 12px;border-radius:8px;font-size:14px;box-sizing:border-box">'+
    '<span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text3);pointer-events:none">▼</span>'+
    '<div id="mm-ruta-list" style="display:none;position:absolute;z-index:200;width:100%;background:var(--slate);border:1px solid var(--border);border-radius:8px;max-height:200px;overflow-y:auto;top:100%;left:0"></div>'+
    '</div>'+
    '<input type="hidden" id="mm-ruta-val">'+
    '<div style="display:flex;gap:8px">'+
    '<button class="btn btn-primary" style="flex:1" onclick="confirmarAddRuta()">Añadir</button>'+
    '<button class="btn btn-ghost" style="flex:1" onclick="cerrarMiniModal()">Cancelar</button>'+
    '</div></div>';
  mostrarMiniModal(html);
  setTimeout(function(){
    var inp=document.getElementById('mm-ruta-inp');
    var list=document.getElementById('mm-ruta-list');
    var hid=document.getElementById('mm-ruta-val');
    if(!inp) return;
    function filtrar(){
      var q=inp.value.toLowerCase();
      var items=disponibles.filter(function(c){return !q||(c.nombreCompleto||'').toLowerCase().indexOf(q)>-1||(c.nombreComercial||'').toLowerCase().indexOf(q)>-1;}).slice(0,10);
      list.innerHTML='';
      if(!items.length){list.innerHTML='<div style="padding:10px;color:var(--text3);font-size:13px">Sin resultados</div>';list.style.display='block';return;}
      items.forEach(function(c){
        var div=document.createElement('div');
        div.style.cssText='padding:10px 12px;cursor:pointer;font-size:14px;border-bottom:1px solid var(--border)';
        div.innerHTML='<div>'+escH(c.nombreCompleto)+'</div>'+(c.nombreComercial?'<div style="font-size:11px;color:var(--text3)">'+escH(c.nombreComercial)+'</div>':'');
        div.addEventListener('mousedown',function(e){e.preventDefault();hid.value=c.id;inp.value=c.nombreCompleto;list.style.display='none';});
        list.appendChild(div);
      });
      list.style.display='block';
    }
    inp.addEventListener('input',filtrar);
    inp.addEventListener('focus',filtrar);
    inp.addEventListener('blur',function(){setTimeout(function(){list.style.display='none';},150);});
    inp.focus();
  },50);
}
function confirmarAddRuta(){
  var hid=document.getElementById('mm-ruta-val');
  var id=hid?hid.value:'';
  if(!id){toast('Selecciona un cliente','err');return;}
  var c=getClienteById(id);if(!c) return;
  var ruta=getRutaHoy();
  ruta.clientes.push({id:id,nombre:c.nombreCompleto,estado:'pendiente',nota:''});
  saveRuta();cerrarMiniModal();renderRutaDia();
}
function setEstadoRuta(idx,estado){
  var ruta=getRutaHoy();
  if(ruta.clientes[idx]) ruta.clientes[idx].estado=estado;
  saveRuta();renderRutaDia();
}
function eliminarDeRuta(idx){
  var ruta=getRutaHoy();ruta.clientes.splice(idx,1);saveRuta();renderRutaDia();
}
function renderRutaDia(){
  var div=document.getElementById('ruta-dia-content');if(!div) return;
  var ruta=getRutaHoy();
  if(!ruta.clientes.length){div.innerHTML='<div style="text-align:center;padding:24px;color:var(--text3);font-size:14px">No hay clientes en la ruta de hoy</div>';return;}
  // Ordenar: pendientes primero, luego aplazados, luego hechos/descartados
  var orden={'pendiente':0,'aplazado':1,'hecho':2,'descartado':3};
  var sorted=ruta.clientes.map(function(c,i){return {c:c,i:i};}).sort(function(a,b){return (orden[a.c.estado]||0)-(orden[b.c.estado]||0);});
  var html='';
  sorted.forEach(function(item){
    var cl=item.c,idx=item.i;
    var colEstado=cl.estado==='hecho'?'#6ee7b7':cl.estado==='aplazado'?'#fcd34d':cl.estado==='descartado'?'#f87171':'var(--text2)';
    html+='<div style="background:var(--slate2);border-radius:8px;padding:12px 14px;margin-bottom:8px;opacity:'+(cl.estado==='descartado'?'0.5':'1')+'">';
    html+='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
    html+='<span style="flex:1;font-weight:600;font-size:14px;color:'+colEstado+'">'+escH(cl.nombre)+'</span>';
    html+='<span style="font-size:11px;color:'+colEstado+';font-weight:700;text-transform:uppercase">'+cl.estado+'</span>';
    html+='</div>';
    html+='<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">';
    if(cl.estado!=='hecho') html+='<button class="btn btn-ghost btn-sm" style="color:#6ee7b7;border:1px solid #6ee7b7" onclick="setEstadoRuta('+idx+',\'hecho\')">✓ Hecho</button>';
    if(cl.estado!=='aplazado') html+='<button class="btn btn-ghost btn-sm" style="color:#fcd34d;border:1px solid #fcd34d" onclick="setEstadoRuta('+idx+',\'aplazado\')">⏸ Aplazar</button>';
    if(cl.estado!=='descartado') html+='<button class="btn btn-ghost btn-sm" style="color:#f87171;border:1px solid #f87171" onclick="setEstadoRuta('+idx+',\'descartado\')">✕ Descartar</button>';
    html+='<button class="btn btn-ghost btn-sm" onclick="eliminarDeRuta('+idx+')" style="margin-left:auto">🗑</button>';
    html+='</div>';
    html+='</div>';
  });
  div.innerHTML=html;
}
// Mini modal genérico
function abrirNotasProximoPedido(){
  var p=state.pedidos[currentOrder];
  var c=getClienteById(p.clienteId);
  if(!c){toast('Selecciona un cliente primero','err');return;}
  var notaActual=c.notaProximoPedido||'';
  mostrarMiniModal(
    '<div style="padding:16px">'+
    '<div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:8px">📝 Nota próximo pedido — '+escH(c.nombreCompleto)+'</div>'+
    '<textarea id="mm-nota-prox" style="width:100%;min-height:80px;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:8px;font-size:14px;resize:vertical;font-family:inherit">'+escH(notaActual)+'</textarea>'+
    '<div style="display:flex;gap:8px;margin-top:10px">'+
    '<button class="btn btn-primary btn-sm" style="flex:1" onclick="guardarNotaProxima(\''+c.id+'\')">Guardar</button>'+
    '<button class="btn btn-ghost btn-sm" style="flex:1" onclick="cerrarMiniModal()">Cancelar</button>'+
    '</div></div>'
  );
}
function guardarNotaProxima(clienteId){
  var c=getClienteById(clienteId);if(!c) return;
  var ta=document.getElementById('mm-nota-prox');if(!ta) return;
  c.notaProximoPedido=ta.value.trim();
  saveState();cerrarMiniModal();toast('Nota guardada \u2713');
}
function abrirCambioDescuento(){
  var p=state.pedidos[currentOrder];
  var c=getClienteById(p.clienteId);
  if(!c){toast('Selecciona un cliente primero','err');return;}
  mostrarMiniModal(
    '<div style="padding:16px">'+
    '<div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:8px">% Descuento \u2014 '+escH(c.nombreCompleto)+'</div>'+
    '<div style="font-size:12px;color:var(--text3);margin-bottom:10px">Descuento actual: <strong>'+c.descuento+'%</strong></div>'+
    '<input type="number" id="mm-nuevo-dto" min="0" max="99" value="'+c.descuento+'" style="width:100%;min-height:44px;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:8px;font-size:18px;text-align:center">'+
    '<div style="display:flex;gap:8px;margin-top:10px">'+
    '<button class="btn btn-primary btn-sm" style="flex:1" onclick="guardarNuevoDescuento(\''+c.id+'\')">Aplicar</button>'+
    '<button class="btn btn-ghost btn-sm" style="flex:1" onclick="cerrarMiniModal()">Cancelar</button>'+
    '</div></div>'
  );
}
function guardarNuevoDescuento(clienteId){
  var c=getClienteById(clienteId);if(!c) return;
  var inp=document.getElementById('mm-nuevo-dto');if(!inp) return;
  var nuevo=parseFloat(inp.value)||0;
  c.descuento=nuevo;saveState();
  var p=state.pedidos[currentOrder];
  if(!p.ofertaId){p.dtoActual=nuevo;savePedidos();}
  cerrarMiniModal();updateBadges();renderSummary();
  toast('Descuento actualizado a '+nuevo+'% \u2713');
}
// Mini modal genérico
function mostrarMiniModal(html){
  var ex=document.getElementById('mini-modal-overlay');if(ex) ex.remove();
  var ov=document.createElement('div');ov.id='mini-modal-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9500;display:flex;align-items:center;justify-content:center;padding:16px';
  var box=document.createElement('div');box.style.cssText='background:var(--slate);border:1px solid var(--border);border-radius:12px;min-width:280px;max-width:400px;width:100%';
  box.innerHTML=html;ov.appendChild(box);document.body.appendChild(ov);
  ov.addEventListener('click',function(e){if(e.target===ov) cerrarMiniModal();});
}
function cerrarMiniModal(){var el=document.getElementById('mini-modal-overlay');if(el) el.remove();}

// ---- AGENDA 14 DÍAS ----
function renderAgenda14(){
  var div=document.getElementById('agenda-14-content');
  if(!div) return;
  var hoy=new Date();hoy.setHours(0,0,0,0);
  var fin14=new Date(hoy);fin14.setDate(hoy.getDate()+14);
  var items=[];

  // 1. ENTREGAS FRACCIONADAS pendientes (e1 o f1/f2 dentro de 14 días, ocultar si han pasado 10 días)
  state.historial.forEach(function(h){
    if(!h.pedido||!h.pedido.entregasOverride) return;
    var cNom=h.clienteNombre||h.clienteId;
    Object.keys(h.pedido.entregasOverride).forEach(function(key){
      var ov=h.pedido.entregasOverride[key];
      ['f1','f2'].forEach(function(campo,idx){
        if(!ov[campo]) return;
        var partes=ov[campo].split('-');if(partes.length<3) return;
        var fDate=new Date(+partes[0],+partes[1]-1,+partes[2]);
        var diasPasados=Math.floor((hoy-fDate)/(1000*60*60*24));
        if(diasPasados>10) return; // ocultar 10 días después
        if(fDate>fin14) return;    // fuera de ventana
        var diasRestantes=Math.floor((fDate-hoy)/(1000*60*60*24));
        var urgencia=diasRestantes<0?0:diasRestantes<3?1:diasRestantes<7?2:3;
        items.push({tipo:'entrega',fecha:fDate,diasRestantes:diasRestantes,urgencia:urgencia,
          texto:'📦 <strong>'+escH(cNom)+'</strong> — Entrega '+(idx+1)+' ('+ov.uds+' uds)',
          sub:ov[campo]});
      });
    });
  });

  // 2. CONTRATOS que vencen en 60 días o caducados hace menos de 30
  state.clientes.forEach(function(c){
    if(!c.contrato) return;
    var dias=diasParaVencer(c.contrato);
    if(dias<-30||dias>60) return;
    var partes=c.contrato.split('-');if(partes.length<3) return;
    var fDate=new Date(+partes[0],+partes[1]-1,+partes[2]);
    var urgencia=dias<0?0:dias<=7?0:dias<=14?1:dias<=30?2:3;
    var textoEstado=dias<0?'⚠️ CADUCADO hace '+Math.abs(dias)+' días':'Contrato vence en '+dias+' días';
    items.push({tipo:'contrato',fecha:fDate,diasRestantes:dias,urgencia:urgencia,
      texto:'📄 <strong>'+escH(c.nombreCompleto)+'</strong> — '+textoEstado,
      sub:c.contrato+(c.nombreComercial?' · '+escH(c.nombreComercial):'')});
  });

  // 3. CAMPAÑAS que terminan pronto (activas/preoferta con fin en 14 días) + candidatos
  state.campanas.forEach(function(camp){
    var estado=getCampanaEstado(camp);
    if(estado!=='activa'&&estado!=='preoferta') return;
    var fechaFin=estado==='activa'?camp.campanaFin:camp.preofertaFin;
    if(!fechaFin) return;
    var partes=fechaFin.split('-');if(partes.length<3) return;
    var fDate=new Date(+partes[0],+partes[1]-1,+partes[2]);
    var dias=Math.floor((fDate-hoy)/(1000*60*60*24));
    if(dias<0||fDate>fin14) return;
    var candidatos=getCandidatos(camp);
    var urgencia=dias<=3?0:dias<=7?1:2;
    var candTexto=candidatos.length?(' <span style="color:var(--cobalt-light);font-size:11px;font-weight:700">'+candidatos.length+' candidato'+(candidatos.length!==1?'s':'')+'</span>'):'';
    items.push({tipo:'campana',fecha:fDate,diasRestantes:dias,urgencia:urgencia,
      texto:'🎯 <strong>'+escH(camp.nombre)+'</strong>'+candTexto+' — '+(estado==='activa'?'Campaña':'Precampaña')+' termina en '+dias+' días',
      sub:fechaFin,candidatos:candidatos,campId:camp.id});
  });

  if(!items.length){
    div.innerHTML='<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">&#10003; Sin eventos en los próximos 14 días</div>';
    return;
  }

  // Ordenar por urgencia, luego por fecha
  items.sort(function(a,b){return a.urgencia!==b.urgencia?a.urgencia-b.urgencia:a.fecha-b.fecha;});

  var colUrgencia=['#f87171','#fcd34d','#6ee7b7','var(--text3)'];
  var html='';
  items.forEach(function(item){
    var col=colUrgencia[item.urgencia]||'var(--text2)';
    var bg=item.urgencia===0?'background:rgba(248,113,113,.08);border-left:3px solid #f87171':
           item.urgencia===1?'background:rgba(252,211,77,.06);border-left:3px solid #fcd34d':
           'background:var(--slate2);border-left:3px solid var(--border)';
    html+='<div style="'+bg+';border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:8px">';
    html+='<div style="font-size:13px;color:var(--text)">'+item.texto+'</div>';
    html+='<div style="font-size:11px;color:var(--text3);margin-top:3px">'+item.sub+'</div>';
    // Candidatos de campaña desplegables
    if(item.candidatos&&item.candidatos.length){
      html+='<div id="ag14-cand-'+item.campId+'" style="display:none;margin-top:8px">';
      item.candidatos.slice(0,8).forEach(function(cd){
        html+='<div style="font-size:12px;color:var(--text2);padding:2px 0">· '+escH(cd.cliente.nombreCompleto)+
              ' <span style="color:var(--cobalt-light)">'+cd.dtoCliente+'%→'+cd.mejorTramo.dto+'% ('+cd.mejorTramo.uds+' uds)</span></div>';
      });
      if(item.candidatos.length>8) html+='<div style="font-size:11px;color:var(--text3)">...y '+(item.candidatos.length-8)+' más</div>';
      html+='</div>';
      html+='<button onclick="var el=document.getElementById(\'ag14-cand-'+item.campId+'\');el.style.display=el.style.display===\'none\'?\'block\':\'none\';this.textContent=el.style.display===\'none\'?\'▼ Ver candidatos\':\'▲ Ocultar\'" '+
            'style="margin-top:6px;background:transparent;border:none;color:var(--cobalt-light);font-size:11px;font-weight:700;cursor:pointer;padding:0">▼ Ver candidatos</button>';
    }
    html+='</div>';
  });
  div.innerHTML=html;
}

// ██ BLOQUE:VISITAS-BRIEFING-FIN ██

// ██ BLOQUE:INIT-INICIO ██
function initPopupInicio(){
  var ahora=Date.now();
  var pospuesto=sessionStorage.getItem('popupPospuesto');
  if(pospuesto&&ahora<parseInt(pospuesto)) return;
  var hoyStr=new Date().toISOString().slice(0,10);
  if(localStorage.getItem('popupVistoDia')===hoyStr) return;
  // Calcular novedades
  var novedades=[];
  var hoy=new Date();hoy.setHours(0,0,0,0);
  // Contratos por vencer (30 días)
  state.clientes.forEach(function(c){
    if(!c.contrato) return;
    var dias=diasParaVencer(c.contrato);
    if(dias>=0&&dias<=30) novedades.push('⚠️ Contrato de <strong>'+escH(c.nombreCompleto)+'</strong> vence en '+dias+' días');
  });
  // Clientes sin pedir en más de 30 días
  var sinPedirReciente=state.clientes.filter(function(c){
    if(!c.ultimoPedido) return false;
    var p=c.ultimoPedido.split('/');if(p.length<3) return false;
    var d=new Date(+p[2],+p[1]-1,+p[0]);
    return (hoy-d)>30*24*60*60*1000;
  });
  if(sinPedirReciente.length) novedades.push('📦 '+sinPedirReciente.length+' cliente'+(sinPedirReciente.length>1?'s':'')+' sin pedir en más de 30 días');
  // Campañas activas/precampaña
  var campsHoy=state.campanas.filter(function(c){var e=getCampanaEstado(c);return e==='activa'||e==='preoferta';});
  if(campsHoy.length) novedades.push('🎯 '+campsHoy.length+' campaña'+(campsHoy.length>1?'s':'')+' activa'+(campsHoy.length>1?'s':'')+' o en precampaña');
  if(!novedades.length) return; // sin novedades, no mostrar
  document.getElementById('popup-inicio-body').innerHTML=novedades.map(function(n){return '<div style="padding:4px 0;border-bottom:1px solid var(--border)">'+n+'</div>';}).join('');
  document.getElementById('popup-inicio').classList.remove('hidden');
}
function cerrarPopupInicio(){
  document.getElementById('popup-inicio').classList.add('hidden');
  cerrarPopupInicioDia();
}
function cerrarPopupInicioDia(){
  document.getElementById('popup-inicio').classList.add('hidden');
  var hoy=new Date().toISOString().slice(0,10);
  localStorage.setItem('popupVistoDia',hoy);
}
function posponerPopupInicio(){
  document.getElementById('popup-inicio').classList.add('hidden');
  sessionStorage.setItem('popupPospuesto',String(Date.now()+60*60*1000));
}
function initBannerConfirmaciones(){
  if(sessionStorage.getItem('bannerConf')) return;
  function checkHora(){
    var ahora=new Date(),h=ahora.getHours(),m=ahora.getMinutes();
    var enRango=(h===13)||(h===14&&m<=50);
    if(enRango&&!sessionStorage.getItem('bannerConf')){
      var b=document.getElementById('banner-confirmaciones');
      if(b) b.style.display='flex';
    }
  }
  checkHora();
  setInterval(checkHora,60000);
}
function abrirGemini(){
  window.open('https://gemini.google.com','_blank');
}
function init(){
  loadState();loadRuta();
  // PRECARGA CAMPAÑAS NUTERGIA 2026
  (function(){
    if(!state.campanas||state.campanas.length===0){
      var pdfCamps=[{"id":"camp000pdf26","nombre":"ERGYCOX Q1 2026","envios":2,"preofertaInicio":"2025-11-01","preofertaFin":"2025-12-15","campanaInicio":"2026-01-01","campanaFin":"2026-03-31","esLibre":false,"productosNombre":"ERGYCOX 30,ERGYCOX 90","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp001pdf26","nombre":"ERGYDREN Q1 2026","envios":2,"preofertaInicio":"2025-11-01","preofertaFin":"2025-12-15","campanaInicio":"2026-01-01","campanaFin":"2026-03-31","esLibre":false,"productosNombre":"ERGYDREN","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp002pdf26","nombre":"ERGYEPUR Q1 2026","envios":2,"preofertaInicio":"2025-11-01","preofertaFin":"2025-12-15","campanaInicio":"2026-01-01","campanaFin":"2026-03-31","esLibre":false,"productosNombre":"ERGYEPUR","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp003pdf26","nombre":"ERGYMAG Q1 2026","envios":2,"preofertaInicio":"2025-11-01","preofertaFin":"2025-12-15","campanaInicio":"2026-01-01","campanaFin":"2026-03-31","esLibre":false,"productosNombre":"ERGYMAG 90,ERGYMAG 180","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp004pdf26","nombre":"ERGYSTAM Q1 2026","envios":2,"preofertaInicio":"2025-11-01","preofertaFin":"2025-12-15","campanaInicio":"2026-01-01","campanaFin":"2026-03-31","esLibre":false,"productosNombre":"ERGYSTAM","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp005pdf26","nombre":"ERGYTAURINA DETOX Q1","envios":2,"preofertaInicio":"2025-11-01","preofertaFin":"2025-12-15","campanaInicio":"2026-01-01","campanaFin":"2026-03-31","esLibre":false,"productosNombre":"ERGYTAURINA DETOX","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp006pdf26","nombre":"ERGYCOL BALANCE Q2 2026","envios":2,"preofertaInicio":"2026-02-01","preofertaFin":"2026-03-15","campanaInicio":"2026-04-01","campanaFin":"2026-06-30","esLibre":false,"productosNombre":"ERGYCOL BALANCE","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp007pdf26","nombre":"ERGY-3 Q2 2026","envios":2,"preofertaInicio":"2026-02-01","preofertaFin":"2026-03-15","campanaInicio":"2026-04-01","campanaFin":"2026-06-30","esLibre":false,"productosNombre":"ERGY-3 60,ERGY-3 180","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp008pdf26","nombre":"ERGYFEM Q2 2026","envios":2,"preofertaInicio":"2026-02-01","preofertaFin":"2026-03-15","campanaInicio":"2026-04-01","campanaFin":"2026-06-30","esLibre":false,"productosNombre":"ERGYFEM CYCLE,ERGYFEM EQUILIBRIO,ERGYFEM BIENESTAR","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp009pdf26","nombre":"ERGYFIBRAL Q2 2026","envios":2,"preofertaInicio":"2026-02-01","preofertaFin":"2026-03-15","campanaInicio":"2026-04-01","campanaFin":"2026-06-30","esLibre":false,"productosNombre":"ERGYFIBRAL","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp010pdf26","nombre":"ERGYSLIM Q2 2026","envios":2,"preofertaInicio":"2026-02-01","preofertaFin":"2026-03-15","campanaInicio":"2026-04-01","campanaFin":"2026-06-30","esLibre":false,"productosNombre":"ERGYSLIM","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp011pdf26","nombre":"ERGYACTIV Q3 2026","envios":2,"preofertaInicio":"2026-05-01","preofertaFin":"2026-06-15","campanaInicio":"2026-07-01","campanaFin":"2026-09-30","esLibre":false,"productosNombre":"ERGYACTIV","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp012pdf26","nombre":"BICEBE PLUS Q3 2026","envios":2,"preofertaInicio":"2026-05-01","preofertaFin":"2026-06-15","campanaInicio":"2026-07-01","campanaFin":"2026-09-30","esLibre":false,"productosNombre":"BICEBE PLUS 30,BICEBE PLUS 90","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp013pdf26","nombre":"ERGYKID Q3 2026","envios":2,"preofertaInicio":"2026-05-01","preofertaFin":"2026-06-15","campanaInicio":"2026-07-01","campanaFin":"2026-09-30","esLibre":false,"productosNombre":"ERGYKID MULTIVIT,ERGYKID BIENESTAR,ERGYKID DEFENS","productoIds":[],"tramos":[{"uds":18,"dto":37},{"uds":36,"dto":41},{"uds":72,"dto":45},{"uds":96,"dto":49}]},{"id":"camp014pdf26","nombre":"ERGYSTRESS Q3 2026","envios":2,"preofertaInicio":"2026-05-01","preofertaFin":"2026-06-15","campanaInicio":"2026-07-01","campanaFin":"2026-09-30","esLibre":false,"productosNombre":"ERGYSTRESS","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp015pdf26","nombre":"VECTISEREN Q3 2026","envios":2,"preofertaInicio":"2026-05-01","preofertaFin":"2026-06-15","campanaInicio":"2026-07-01","campanaFin":"2026-09-30","esLibre":false,"productosNombre":"VECTISEREN","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp016pdf26","nombre":"ERGYZEN Q3 2026","envios":2,"preofertaInicio":"2026-05-01","preofertaFin":"2026-06-15","campanaInicio":"2026-07-01","campanaFin":"2026-09-30","esLibre":false,"productosNombre":"ERGYZEN","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp017pdf26","nombre":"ACEROL C Q4 2026","envios":2,"preofertaInicio":"2026-08-01","preofertaFin":"2026-09-15","campanaInicio":"2026-10-01","campanaFin":"2026-12-31","esLibre":false,"productosNombre":"ACEROL C","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp018pdf26","nombre":"ERGY D PLUS Q4 2026","envios":2,"preofertaInicio":"2026-08-01","preofertaFin":"2026-09-15","campanaInicio":"2026-10-01","campanaFin":"2026-12-31","esLibre":false,"productosNombre":"ERGY D PLUS","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp019pdf26","nombre":"ERGY D Q4 2026","envios":2,"preofertaInicio":"2026-08-01","preofertaFin":"2026-09-15","campanaInicio":"2026-10-01","campanaFin":"2026-12-31","esLibre":false,"productosNombre":"ERGY D","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp020pdf26","nombre":"ERGYLASE Q4 2026","envios":2,"preofertaInicio":"2026-08-01","preofertaFin":"2026-09-15","campanaInicio":"2026-10-01","campanaFin":"2026-12-31","esLibre":false,"productosNombre":"ERGYLASE","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp021pdf26","nombre":"ERGYPHILUS Q4 2026","envios":3,"preofertaInicio":"2026-08-01","preofertaFin":"2026-09-15","campanaInicio":"2026-10-01","campanaFin":"2026-12-31","esLibre":false,"productosNombre":"ERGYPHILUS HPY,ERGYPHILUS NINOS,ERGYPHILUS BEBE,ERGYPHILUS INTIMA,ERGYPHILUS PLUS30,ERGYPHILUS PLUS60,ERGYPHILUS INMUNO","productoIds":[],"tramos":[{"uds":48,"dto":37},{"uds":96,"dto":41},{"uds":192,"dto":45},{"uds":288,"dto":49}]},{"id":"camp022pdf26","nombre":"ERGYPROTECT CONF Q4","envios":2,"preofertaInicio":"2026-08-01","preofertaFin":"2026-09-15","campanaInicio":"2026-10-01","campanaFin":"2026-12-31","esLibre":false,"productosNombre":"ERGYPROTECT CONF","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp023pdf26","nombre":"VECTIDORM GABA Q4 2026","envios":2,"preofertaInicio":"2026-08-01","preofertaFin":"2026-09-15","campanaInicio":"2026-10-01","campanaFin":"2026-12-31","esLibre":false,"productosNombre":"VECTIDORM GABA","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]},{"id":"camp024pdf26","nombre":"VECTIDORM MELATONINA Q4","envios":2,"preofertaInicio":"2026-08-01","preofertaFin":"2026-09-15","campanaInicio":"2026-10-01","campanaFin":"2026-12-31","esLibre":false,"productosNombre":"VECTIDORM MELATONINA","productoIds":[],"tramos":[{"uds":6,"dto":35},{"uds":12,"dto":37},{"uds":24,"dto":41},{"uds":48,"dto":45},{"uds":72,"dto":49}]}];
      state.campanas=pdfCamps;saveState();
    }
  })();
  initComboboxes();refreshOfertaSelect();renderCurrentOrder();updateStockBadge();
  initBannerConfirmaciones();
  setTimeout(initPopupInicio,800);
  // Mostrar barra inferior al inicio (panel pedidos es el activo)
  document.getElementById('barra-pedido').classList.add('visible');
}
/* ===== TEMA ===== */
var TEMAS=['oscuro','claro','sol'];
var TEMA_ICONOS={oscuro:'🌙',claro:'☀️',sol:'🌞'};
function aplicarTema(t){
  document.documentElement.classList.remove('tema-claro','tema-sol');
  if(t==='claro') document.documentElement.classList.add('tema-claro');
  else if(t==='sol') document.documentElement.classList.add('tema-sol');
  var btn=document.getElementById('btn-tema');
  if(btn) btn.textContent=TEMA_ICONOS[t];
  localStorage.setItem('franez-tema',t);
}
function toggleTema(){
  var actual=localStorage.getItem('franez-tema')||'oscuro';
  var idx=(TEMAS.indexOf(actual)+1)%TEMAS.length;
  aplicarTema(TEMAS[idx]);
}
(function(){
  var t=localStorage.getItem('franez-tema')||'oscuro';
  aplicarTema(t);
})();
document.addEventListener('DOMContentLoaded',init);
// ██ BLOQUE:INIT-FIN ██
