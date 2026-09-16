/**
 * Preferencia de colapsado del sidebar del panel.
 *
 * El estado vive en un atributo `data-admin-sidebar` del `<html>` y no en
 * estado de React, y el ancho se resuelve con la variable CSS
 * `--admin-sidebar-w` (ver `app/globals.css`). El motivo: el HTML que manda el
 * servidor no puede saber qué hay en `localStorage`, así que si el ancho
 * dependiera del estado de React, un panel guardado como colapsado se pintaría
 * ancho y saltaría al hidratar. Con el atributo, un script inline que corre
 * antes del primer pintado (`AdminSidebarPreferenceScript`) deja el ancho
 * correcto desde el primer frame y React no interviene.
 */

export const SIDEBAR_STORAGE_KEY = 'manuj-admin-sidebar';

export type SidebarState = 'collapsed' | 'expanded';

/** Lee el estado real del DOM (única fuente de verdad, ya resuelta por el script). */
export function readSidebarState(): SidebarState {
  if (typeof document === 'undefined') return 'expanded';
  return document.documentElement.dataset.adminSidebar === 'collapsed'
    ? 'collapsed'
    : 'expanded';
}

/** Aplica el estado al DOM y lo persiste. `localStorage` puede fallar (modo privado, cuota). */
export function writeSidebarState(state: SidebarState): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.adminSidebar = state;
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, state);
  } catch {
    // Sin persistencia el panel sigue funcionando, solo se olvida al recargar.
  }
}
