const XLSX = require('xlsx');

const headers = [
    'codigo', 'pedido', 'item', 'cliente', 'descripcion',
    'cantidad', 'anho', 'alto', 'perforaciones',
    'pintado', 'pintado car', 'radio', 'ventana',
    'tipo de venta', 'fecha_creacion', 'nota',
    'posicion', 'orden de compra', 'tipo de entrega', 'kilos'
];

const example = [
    'P12345', 'PED-001', 1, 'Cliente ABC', 'Vidrio 6mm',
    10, 1500, 2000, 0,
    1, 0, 0, 0,
    'Normal', '2026-07-24', '',
    '', 'OC-001', 'Despacho', 150
];

const ws = XLSX.utils.aoa_to_sheet([headers, example]);

ws['!cols'] = headers.map(() => ({ wch: 18 }));

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
XLSX.writeFile(wb, 'plantilla_importar_sap.xlsx');
console.log('Creado: plantilla_importar_sap.xlsx');
