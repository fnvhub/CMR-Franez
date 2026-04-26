// ██ BLOQUE:IMPORTAR-CONTRATO-PDF-INICIO ██

// ── Validación NIF/CIF español ──
function validarNIF(nif) {
  if (!nif) return { ok: false, msg: 'NIF vacío' };
  nif = nif.trim().toUpperCase();
  // NIF persona física (8 números + letra)
  var nifReg = /^(\d{8})([A-Z])$/;
  var letras = 'TRWAGMYFPDXBNJZSQVHLCKE';
  var m = nif.match(nifReg);
  if (m) {
    var letraCorrecta = letras[parseInt(m[1]) % 23];
    if (m[2] === letraCorrecta) return { ok: true, msg: '' };
    return { ok: false, msg: 'La letra del NIF debería ser ' + letraCorrecta + ' pero es ' + m[2] };
  }
  // NIE (X/Y/Z + 7 números + letra)
  var nieReg = /^([XYZ])(\d{7})([A-Z])$/;
  var mn = nif.match(nieReg);
  if (mn) {
    var nieNum = { X: '0', Y: '1', Z: '2' }[mn[1]] + mn[2];
    var letraNIE = letras[parseInt(nieNum) % 23];
    if (mn[3] === letraNIE) return { ok: true, msg: '' };
    return { ok: false, msg: 'La letra del NIE debería ser ' + letraNIE + ' pero es ' + mn[3] };
  }
  // CIF (letra + 7 dígitos + letra/número control) — validación básica formato
  var cifReg = /^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/;
  if (cifReg.test(nif)) return { ok: true, msg: '' };
  return { ok: false, msg: 'Formato de NIF/CIF no reconocido' };
}

// ── Validación IBAN español ──
function validarIBAN(iban) {
  if (!iban) return { ok: false, msg: 'IBAN vacío' };
  iban = iban.replace(/\s/g, '').toUpperCase();
  if (!/^ES\d{22}$/.test(iban)) return { ok: false, msg: 'Formato IBAN incorrecto (debe ser ES + 22 dígitos)' };
  // Mover los 4 primeros al final y convertir letras a números
  var reordenado = iban.slice(4) + iban.slice(0, 4);
  var numStr = reordenado.split('').map(function(c) {
    var code = c.charCodeAt(0);
    return code >= 65 ? String(code - 55) : c;
  }).join('');
  // Módulo 97 en bloques (JS no maneja BigInt en todos los Android)
  var resto = 0;
  for (var i = 0; i < numStr.length; i++) {
    resto = (resto * 10 + parseInt(numStr[i])) % 97;
  }
  if (resto === 1) return { ok: true, msg: '' };
  return { ok: false, msg: 'Los dígitos de control del IBAN no son válidos' };
}

// ── Separar teléfono/móvil ──
function clasificarTelefono(valor) {
  if (!valor) return { telefono: '', movil: '' };
  // Extraer todos los números del campo (puede haber dos)
  var nums = valor.replace(/[\s\-\.]/g, '').match(/[6789]\d{8}/g) || [];
  var telefono = '', movil = '';
  nums.forEach(function(n) {
    if (n[0] === '9') telefono = n;
    else if (n[0] === '6' || n[0] === '7') movil = n;
  });
  // Si solo hay un número y no encaja en el patrón, ponerlo en teléfono
  if (!telefono && !movil && valor.trim()) telefono = valor.trim();
  return { telefono: telefono, movil: movil };
}

// ── Convertir fecha DD/MM/YYYY → YYYY-MM-DD (formato contrato Franez) ──
function convertirFechaContrato(str) {
  if (!str) return '';
  var m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return str;
}

// ── Leer PDF con pdf.js (CDN) y extraer campos AcroForm ──
function leerCamposPDF(file, callback) {
  // Cargar pdf.js si no está cargado
  if (!window.pdfjsLib) {
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = function() {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      procesarPDF(file, callback);
    };
    script.onerror = function() { callback(null, 'No se pudo cargar el lector de PDF'); };
    document.head.appendChild(script);
  } else {
    procesarPDF(file, callback);
  }
}

function procesarPDF(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var typedarray = new Uint8Array(e.target.result);
    pdfjsLib.getDocument({ data: typedarray }).promise.then(function(pdf) {
      var campos = {};
      var paginasProcesadas = 0;
      var totalPaginas = pdf.numPages;

      for (var i = 1; i <= totalPaginas; i++) {
        (function(numPag) {
          pdf.getPage(numPag).then(function(page) {
            return page.getAnnotations();
          }).then(function(annotations) {
            annotations.forEach(function(ann) {
              if (ann.fieldName && ann.fieldValue !== undefined) {
                // No sobreescribir si ya tiene valor (campos duplicados como DESCUENTO)
                if (!campos[ann.fieldName] && ann.fieldValue !== '') {
                  campos[ann.fieldName] = ann.fieldValue;
                } else if (ann.fieldValue !== '' && !campos[ann.fieldName]) {
                  campos[ann.fieldName] = ann.fieldValue;
                }
              }
            });
            paginasProcesadas++;
            if (paginasProcesadas === totalPaginas) {
              callback(campos, null);
            }
          }).catch(function(err) {
            paginasProcesadas++;
            if (paginasProcesadas === totalPaginas) callback(campos, null);
          });
        })(i);
      }
    }).catch(function(err) {
      callback(null, 'Error leyendo el PDF: ' + err.message);
    });
  };
  reader.onerror = function() { callback(null, 'Error leyendo el archivo'); };
  reader.readAsArrayBuffer(file);
}

// ── Construir IBAN completo desde campos del PDF ──
function construirIBAN(campos) {
  var control = (campos['cIBAN'] || '').trim();
  var g1 = (campos['cGrupo1'] || '').trim();
  var g2 = (campos['cGrupo2'] || '').trim();
  var g3 = (campos['cGrupo3'] || '').trim();
  var g4 = (campos['cGrupo4'] || '').trim();
  var g5 = (campos['cGrupo5'] || '').trim();
  if (!control && !g1) return '';
  return 'ES' + control + g1 + g2 + g3 + g4 + g5;
}

// ── Mostrar popup de revisión e importación ──
function mostrarPopupImportacion(campos) {
  var nombre = campos['NOMBRE DE FACTURACION'] || '';
  var nif = campos['CIF/NIF'] || '';
  var direccion = campos['DIRECCION'] || '';
  var cp = campos['CP'] || '';
  var localidad = campos['POBLACION'] || '';
  var provincia = campos['PROVINCIA'] || '';
  var email = campos['CORREO'] || '';
  var especialidad = campos['ESPECIALIDAD'] || '';
  var descuento = campos['DESCUENTO'] || '';
  var contratoFin = convertirFechaContrato(campos['FIN'] || '');
  var tel = clasificarTelefono(campos['TELEF'] || '');
  var iban = construirIBAN(campos);

  // Validaciones
  var nifVal = validarNIF(nif);
  var ibanVal = iban ? validarIBAN(iban) : { ok: true, msg: '' };

  var alertaNIF = !nifVal.ok
    ? '<div style="background:#7f1d1d;border:1px solid #f87171;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:13px;color:#fca5a5">⚠️ NIF: ' + escH(nifVal.msg) + '</div>'
    : '<div style="background:#14532d;border:1px solid #22c55e;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:13px;color:#86efac">✓ NIF válido</div>';

  var alertaIBAN = '';
  if (iban) {
    alertaIBAN = !ibanVal.ok
      ? '<div style="background:#7f1d1d;border:1px solid #f87171;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:13px;color:#fca5a5">⚠️ IBAN: ' + escH(ibanVal.msg) + '<br><strong>IBAN leído: ' + escH(iban) + '</strong></div>'
      : '<div style="background:#14532d;border:1px solid #22c55e;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:13px;color:#86efac">✓ IBAN válido: ' + escH(iban.match(/.{1,4}/g).join(' ')) + '</div>';
  }

  var html =
    '<div style="padding:16px;max-height:80vh;overflow-y:auto">' +
    '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px">📄 Revisar datos del contrato</div>' +
    '<div style="font-size:12px;color:#f97316;font-weight:600;margin-bottom:12px">⚠️ Revisa que el nombre esté en el orden correcto (Nombre Apellidos)</div>' +
    alertaNIF +
    alertaIBAN +

    '<div style="display:flex;flex-direction:column;gap:8px">' +

    '<div><label style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Nombre completo</label>' +
    '<input id="imp-nombre" type="text" value="' + escH(nombre) + '" style="width:100%;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:8px;font-size:14px;margin-top:2px;box-sizing:border-box"></div>' +

    '<div><label style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">NIF/CIF</label>' +
    '<input id="imp-nif" type="text" value="' + escH(nif) + '" style="width:100%;background:var(--slate2);border:1px solid ' + (nifVal.ok ? 'var(--border)' : '#f87171') + ';color:var(--text);padding:8px 10px;border-radius:8px;font-size:14px;margin-top:2px;box-sizing:border-box"></div>' +

    '<div><label style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Dirección</label>' +
    '<input id="imp-dir" type="text" value="' + escH(direccion) + '" style="width:100%;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:8px;font-size:14px;margin-top:2px;box-sizing:border-box"></div>' +

    '<div style="display:flex;gap:8px">' +
    '<div style="flex:0 0 90px"><label style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">CP</label>' +
    '<input id="imp-cp" type="text" value="' + escH(cp) + '" style="width:100%;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:8px;font-size:14px;margin-top:2px;box-sizing:border-box"></div>' +
    '<div style="flex:1"><label style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Localidad</label>' +
    '<input id="imp-loc" type="text" value="' + escH(localidad) + '" style="width:100%;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:8px;font-size:14px;margin-top:2px;box-sizing:border-box"></div>' +
    '<div style="flex:1"><label style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Provincia</label>' +
    '<input id="imp-prov" type="text" value="' + escH(provincia) + '" style="width:100%;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:8px;font-size:14px;margin-top:2px;box-sizing:border-box"></div>' +
    '</div>' +

    '<div style="display:flex;gap:8px">' +
    '<div style="flex:1"><label style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Teléfono</label>' +
    '<input id="imp-tel" type="text" value="' + escH(tel.telefono) + '" style="width:100%;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:8px;font-size:14px;margin-top:2px;box-sizing:border-box"></div>' +
    '<div style="flex:1"><label style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Móvil</label>' +
    '<input id="imp-movil" type="text" value="' + escH(tel.movil) + '" style="width:100%;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:8px;font-size:14px;margin-top:2px;box-sizing:border-box"></div>' +
    '</div>' +

    '<div><label style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Email</label>' +
    '<input id="imp-email" type="text" value="' + escH(email) + '" style="width:100%;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:8px;font-size:14px;margin-top:2px;box-sizing:border-box"></div>' +

    '<div style="display:flex;gap:8px">' +
    '<div style="flex:1"><label style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Especialidad</label>' +
    '<input id="imp-esp" type="text" value="' + escH(especialidad) + '" style="width:100%;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:8px;font-size:14px;margin-top:2px;box-sizing:border-box"></div>' +
    '<div style="flex:0 0 70px"><label style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Dto%</label>' +
    '<input id="imp-dto" type="number" value="' + escH(descuento) + '" style="width:100%;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:8px;font-size:14px;margin-top:2px;box-sizing:border-box"></div>' +
    '</div>' +

    '<div><label style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Contrato vence</label>' +
    '<input id="imp-contrato" type="date" value="' + escH(contratoFin) + '" style="width:100%;background:var(--slate2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:8px;font-size:14px;margin-top:2px;box-sizing:border-box"></div>' +

    '</div>' +

    '<div style="display:flex;gap:8px;margin-top:16px">' +
    '<button class="btn btn-success" style="flex:1;min-height:48px;font-size:15px;font-weight:700" onclick="confirmarImportacion()">✓ Guardar cliente</button>' +
    '<button class="btn btn-ghost" style="flex:1;min-height:48px" onclick="cerrarMiniModal()">Cancelar</button>' +
    '</div>' +
    '</div>';

  mostrarMiniModal(html);
}

// ── Confirmar e inyectar datos en el formulario de cliente ──
function confirmarImportacion() {
  var nombre = document.getElementById('imp-nombre').value.trim();
  if (!nombre) { toast('El nombre es obligatorio', 'err'); return; }

  // Rellenar formulario de nuevo cliente
  var set = function(id, val) { var el = document.getElementById(id); if (el) el.value = val; };
  set('cli-nombre', nombre);
  set('cli-nif', document.getElementById('imp-nif').value.trim());
  set('cli-direccion', document.getElementById('imp-dir').value.trim());
  set('cli-cp', document.getElementById('imp-cp').value.trim());
  set('cli-localidad', document.getElementById('imp-loc').value.trim());
  set('cli-provincia', document.getElementById('imp-prov').value.trim());
  set('cli-telefono', document.getElementById('imp-tel').value.trim());
  set('cli-movil', document.getElementById('imp-movil').value.trim());
  set('cli-email', document.getElementById('imp-email').value.trim());
  set('cli-especialidad', document.getElementById('imp-esp').value.trim());
  set('cli-descuento', document.getElementById('imp-dto').value.trim());
  set('cli-contrato', document.getElementById('imp-contrato').value.trim());

  cerrarMiniModal();
  toast('Datos importados ✓ — revisa y pulsa Guardar cliente');

  // Scroll al formulario
  var el = document.getElementById('cli-nombre');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
  if (el) el.focus();
}

// ── Entrada: botón y input file oculto ──
function importarContratoPDF() {
  var input = document.getElementById('imp-contrato-file');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'imp-contrato-file';
    input.accept = '.pdf,application/pdf';
    input.style.display = 'none';
    input.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      toast('Leyendo contrato...');
      leerCamposPDF(file, function(campos, err) {
        if (err) { toast('Error: ' + err, 'err'); return; }
        if (!campos || Object.keys(campos).length === 0) {
          toast('No se encontraron campos en el PDF. ¿Está guardado con los campos rellenados?', 'err');
          return;
        }
        mostrarPopupImportacion(campos);
      });
      input.value = '';
    });
    document.body.appendChild(input);
  }
  input.click();
}

// ██ BLOQUE:IMPORTAR-CONTRATO-PDF-FIN ██
