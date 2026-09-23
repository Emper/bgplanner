// Se vuelve a montar en cada navegación (a diferencia de layout.tsx), así que
// cada página entra con un fundido suave. La animación no deja transform al
// acabar, para no romper los modales fixed ni la navbar sticky.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="fx-page-enter">{children}</div>;
}
