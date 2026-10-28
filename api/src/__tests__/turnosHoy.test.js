// Tests de turnosHoy: qué turnos quedan de HOY y con cuánta capacidad
// (proporcional al tiempo restante). Lógica pura, sin BD.
import { describe, it, expect } from 'vitest';
import { calcularTurnosRestantes } from '../services/turnosHoy';

// Config de ejemplo: Lunes a Viernes → Día 08:00-18:00 · Noche 18:00-06:00
// (la noche termina al día siguiente → se acredita al día en que termina).
const horarios = [];
for (let d = 1; d <= 5; d++) {
    horarios.push({ dia_semana: d, turno: 'dia', hora_inicio: '08:00', hora_fin: '18:00', dia_siguiente: false });
    horarios.push({ dia_semana: d, turno: 'noche', hora_inicio: '18:00', hora_fin: '06:00', dia_siguiente: true });
}

const hora = (fecha, h, m = 0) => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), h, m);

describe('turnosHoy - calcularTurnosRestantes', () => {
    // Miércoles 2026-10-28 es día hábil
    const miercoles = new Date(2026, 9, 28);

    it('08:00 → turno noche agotado (terminó 06:00) y turno día 100%', () => {
        const r = calcularTurnosRestantes(horarios, hora(miercoles, 8));
        const noche = r.turnos.find(t => t.turno === 'noche');
        const dia = r.turnos.find(t => t.turno === 'dia');
        expect(r.disponible).toBe(true);
        expect(noche.pct_restante).toBe(0);
        expect(dia.pct_restante).toBe(1);
    });

    it('14:00 → turno día al 40% (quedan 4h de 10h)', () => {
        const r = calcularTurnosRestantes(horarios, hora(miercoles, 14));
        const dia = r.turnos.find(t => t.turno === 'dia');
        expect(dia.pct_restante).toBeCloseTo(0.4, 2);
        expect(r.turnos.find(t => t.turno === 'noche').pct_restante).toBe(0);
    });

    it('19:00 → día agotado; la noche que empieza 18:00 NO es de hoy (termina mañana 06:00)', () => {
        const r = calcularTurnosRestantes(horarios, hora(miercoles, 19));
        expect(r.disponible).toBe(false);
        expect(r.turnos.every(t => t.pct_restante === 0)).toBe(true);
    });

    it('02:00 → la noche de ANOCHE sigue en curso (termina hoy 06:00): parcial + día completo', () => {
        // 28 miércoles 02:00 → la noche del mar 27 18:00 → mié 28 06:00
        const r = calcularTurnosRestantes(horarios, hora(miercoles, 2));
        const noche = r.turnos.find(t => t.turno === 'noche');
        const dia = r.turnos.find(t => t.turno === 'dia');
        expect(noche.pct_restante).toBeCloseTo(4 / 12, 2); // 4h de 12h restantes
        expect(dia.pct_restante).toBe(1);                  // aún no empieza
    });

    it('18:00 exacto → día termina (0%) y noche de hoy no existe todavía para hoy', () => {
        const r = calcularTurnosRestantes(horarios, hora(miercoles, 18));
        expect(r.disponible).toBe(false);
    });

    it('05:59 → noche casi agotada pero disponible', () => {
        const r = calcularTurnosRestantes(horarios, hora(miercoles, 5, 59));
        const noche = r.turnos.find(t => t.turno === 'noche');
        expect(noche.pct_restante).toBeGreaterThan(0);
        expect(noche.pct_restante).toBeLessThan(0.01);
    });

    it('sin configuración → respaldo 06:00-22:00 día / 22:00-06:00 noche', () => {
        const r = calcularTurnosRestantes([], hora(miercoles, 12));
        const dia = r.turnos.find(t => t.turno === 'dia');
        expect(dia.pct_restante).toBeCloseTo(10 / 16, 2); // 10h restantes de 16h
        expect(r.turnos.find(t => t.turno === 'noche').pct_restante).toBe(0); // terminó 06:00
    });

    it('sábado no tiene turnos configurados → no disponible', () => {
        const sabado = new Date(2026, 9, 31); // sábado
        const r = calcularTurnosRestantes(horarios, hora(sabado, 10));
        expect(r.disponible).toBe(false);
    });
});
