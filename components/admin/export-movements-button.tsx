'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MonthStr, MovementCsvRow } from '@/lib/finance/types';

const HEADERS = ['Fecha', 'Tipo', 'Categoría', 'Cuenta', 'Descripción', 'Monto'] as const;

/**
 * Descarga el mes como CSV. Sin librerías: el archivo se arma a mano y se
 * entrega con un Blob + `URL.createObjectURL`.
 *
 * Las filas llegan ya resueltas desde el servidor (`getMonthlyMovementsForCsv`)
 * porque incluyen los ingresos por cita, que viven en `appointments` y no en
 * el libro — un export que solo trajera `financial_movements` no cuadraría con
 * ningún número de la pantalla.
 */
export default function ExportMovementsButton({
  month,
  rows,
}: {
  month: MonthStr;
  rows: MovementCsvRow[];
}) {
  function handleDownload() {
    const lines = [
      HEADERS.join(';'),
      ...rows.map((row) =>
        [
          csvText(row.fecha),
          csvText(row.tipo),
          csvText(row.categoria),
          csvText(row.cuenta),
          csvText(row.descripcion),
          // El monto va crudo: sin separador de miles ni símbolo, para que
          // Excel lo lea como número y no como texto.
          String(Math.round(row.monto)),
        ].join(';'),
      ),
    ];

    // BOM UTF-8: sin él, Excel en español abre el archivo en su codificación
    // local y destroza todas las tildes y las ñ.
    const blob = new Blob(['﻿', lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finanzas-${month}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      variant='outline'
      size='sm'
      onClick={handleDownload}
      disabled={rows.length === 0}
      // Un botón deshabilitado y sin explicación deja al usuario adivinando;
      // el `title` es el único canal que queda (no es focusable).
      title={rows.length === 0 ? 'No hay movimientos en este mes para exportar' : undefined}
    >
      <Download className='h-3.5 w-3.5' />
      Exportar CSV
    </Button>
  );
}

/**
 * Escapa un campo de texto. La descripción es texto libre, así que puede traer
 * el separador (`;`), comas, comillas o saltos de línea, y cualquiera de los
 * tres corre las columnas del resto del archivo.
 *
 * Además se neutraliza el arranque con `= + - @`: Excel interpretaría esa celda
 * como una fórmula. Se antepone un apóstrofo, que Excel usa justamente para
 * decir "esto es texto".
 */
function csvText(value: string): string {
  const flattened = (value ?? '').replace(/[\r\n]+/g, ' ');
  const safe = /^[=+\-@]/.test(flattened) ? `'${flattened}` : flattened;
  return `"${safe.replace(/"/g, '""')}"`;
}
