/**
 * Script para verificar y corregir permisos del administrador
 * Ejecutar en la consola del navegador
 */

// Verificar permisos actuales
const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
console.log('Usuario actual:', user);
console.log('Email:', user.email);
console.log('Rol:', user.rol);
console.log('Permisos:', user.permisos);
console.log('Tiene permiso usuarios:', (user.permisos || []).includes('usuarios'));

// Si no tiene permiso 'usuarios', agregarlo
if (!(user.permisos || []).includes('usuarios')) {
    console.log('Agregando permiso usuarios...');
    if (!user.permisos) user.permisos = [];
    user.permisos.push('usuarios');
    localStorage.setItem('unified_user', JSON.stringify(user));
    console.log('Permiso usuarios agregado. Recarga la página.');
}
