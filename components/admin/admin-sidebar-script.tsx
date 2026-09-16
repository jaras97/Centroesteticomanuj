import { SIDEBAR_STORAGE_KEY } from '@/lib/admin/sidebar-preference';

/**
 * Script inline que aplica la preferencia de colapsado ANTES del primer
 * pintado. Va sin `next/script` a propósito: `next/script` (incluso con
 * `beforeInteractive`) no garantiza ejecutarse antes de que el navegador
 * pinte este subárbol, y un `<script>` literal en el stream del HTML sí,
 * porque bloquea el parser donde está. Es el mismo truco que usa next-themes
 * para no parpadear al cargar.
 *
 * Todo va dentro de try/catch: `localStorage` lanza en modo privado con
 * cookies bloqueadas. Si no hay valor guardado, no se escribe nada y el
 * sidebar queda expandido (el default de `--admin-sidebar-w`).
 */
export default function AdminSidebarPreferenceScript() {
  const script = `(function(){try{var v=localStorage.getItem(${JSON.stringify(
    SIDEBAR_STORAGE_KEY,
  )});if(v==='collapsed'||v==='expanded'){document.documentElement.setAttribute('data-admin-sidebar',v);}}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
