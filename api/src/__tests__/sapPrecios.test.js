// ============================================================================
// Test del parseo de sapPrecios (sin base de datos).
//
// Cubre el bug real detectado en despliegue: el Excel de SAP puede traer los
// nombres de columna en inglés ("Unit Price", "Doc. num.", "Line No.") o con
// mayúsculas distintas, y el parser original solo reconocía los nombres en
// español exactos. _col ahora es insensible a mayúsculas y acepta aliases.
// ============================================================================
const { _col, _num, _int } = require('../services/sapPrecios');

describe('sapPrecios — _col (tolerancia a nombres de columna)', () => {
    it('encuentra la columna aunque venga en inglés (Unit Price)', () => {
        const row = { 'Doc. num.': '111102', 'Line No.': 1, 'Unit Price': 150000, 'CardName': 'PRISMA S.A.' };
        expect(_col(row, ['precio unitario', 'unit price', 'Unit Price', 'Price'])).toBe(150000);
        expect(_col(row, ['pedido', 'Doc. num.'])).toBe('111102');
        expect(_col(row, ['item', 'Line No.'])).toBe(1);
        expect(_col(row, ['cliente', 'CardName'])).toBe('PRISMA S.A.');
    });

    it('es insensible a mayúsculas/minúsculas', () => {
        const row = { 'PRECIO UNITARIO': 999, 'Pedido': '123' };
        expect(_col(row, ['precio unitario'])).toBe(999);
        expect(_col(row, ['PEDIDO'])).toBe('123');
        expect(_col(row, ['pEdIdO'])).toBe('123');
    });

    it('ignora celdas vacías y busca el siguiente alias', () => {
        const row = { 'precio': '', 'Unit Price': 500 };
        // "precio" está vacío → debe saltar al siguiente alias que sí tenga valor
        expect(_col(row, ['precio', 'unit price'])).toBe(500);
    });

    it('devuelve cadena vacía si ninguna columna coincide', () => {
        expect(_col({ 'otra': 1 }, ['precio', 'unit price'])).toBe('');
    });
});

describe('sapPrecios — _num (números es-CL e inglés)', () => {
    it('lee enteros simples', () => {
        expect(_num('150000')).toBe(150000);
        expect(_num(150000)).toBe(150000);
    });

    it('lee decimal con punto (formato inglés)', () => {
        expect(_num('98500.5')).toBe(98500.5);
    });

    it('lee decimal con coma y miles con punto (formato es-CL)', () => {
        expect(_num('98.500,5')).toBe(98500.5);
        expect(_num('1.234,56')).toBe(1234.56);
    });

    it('lee solo coma decimal', () => {
        expect(_num('1234,56')).toBe(1234.56);
    });

    it('descarta símbolos de moneda y espacios', () => {
        expect(_num('$ 1.234,56 CLP')).toBe(1234.56);
    });

    it('devuelve 0 en vacíos o texto no numérico', () => {
        expect(_num('')).toBe(0);
        expect(_num(null)).toBe(0);
        expect(_num('no es numero')).toBe(0);
    });
});

describe('sapPrecios — _int (enteros)', () => {
    it('redondea decimales', () => {
        expect(_int('2')).toBe(2);
        expect(_int('2.7')).toBe(3);
    });

    it('devuelve null en vacío', () => {
        expect(_int('')).toBeNull();
    });
});
