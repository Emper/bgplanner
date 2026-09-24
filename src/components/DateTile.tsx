// La hojita de calendario de los eventos (SÁB / 18 / OCT), la misma que en
// la portada. Se pinta en el navegador, así que va en la hora local.
export default function DateTile({ date, size = "md" }: { date: string; size?: "sm" | "md" }) {
  const d = new Date(date);
  const part = (opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString("es-ES", opts).replace(".", "");
  const sm = size === "sm";
  return (
    <div
      className={`${sm ? "w-11" : "w-14"} shrink-0 rounded-xl bg-white text-center overflow-hidden shadow-md ring-1 ring-black/5`}
      aria-hidden
    >
      <div className={`bg-rose-500 text-white font-bold uppercase ${sm ? "text-[9px]" : "text-[10px]"} py-0.5`}>
        {part({ weekday: "short" })}
      </div>
      <div className={`font-extrabold text-slate-900 leading-tight ${sm ? "text-lg" : "text-xl"}`}>
        {part({ day: "numeric" })}
      </div>
      <div className={`font-semibold text-slate-500 uppercase ${sm ? "text-[9px]" : "text-[10px]"} pb-1`}>
        {part({ month: "short" })}
      </div>
    </div>
  );
}
