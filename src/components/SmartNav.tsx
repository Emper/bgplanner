"use client";

import Navbar from "./Navbar";
import PublicNav from "./PublicNav";
import { usePathname } from "next/navigation";
import { useNavUser } from "@/lib/navUser";

export default function SmartNav() {
  // Comparte con la navbar lo que ya se sabe de la sesión: quien ya ha
  // entrado ve su cabecera desde el principio, sin pasar por la de visitante.
  const navUser = useNavUser();
  const pathname = usePathname();

  if (navUser) {
    return <Navbar />;
  }

  // Mientras no se sabe, también la de visitante: es lo que ve el buscador y
  // quien entra por primera vez (con sesión, ya se sabe desde el principio).
  return <PublicNav loginHref={`/login?redirect=${encodeURIComponent(pathname)}`} />;
}
