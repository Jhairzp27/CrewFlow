"use client";

/**
 * Botón de submit que pide confirmación antes de disparar el Server Action
 * del formulario que lo contiene — para acciones destructivas (eliminar,
 * cancelar) que no se pueden deshacer.
 */
export function ConfirmButton({
  children,
  confirmMessage,
  className,
}: {
  children: React.ReactNode;
  confirmMessage: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
