import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import PageLoader from "@/components/PageLoader";
import { getSession } from "@/lib/auth";
import { getMyCollection } from "@/lib/collectionData";
import CollectionClient, { type ApiResponse } from "./CollectionClient";

// La cabecera y el loader salen al instante; lo que hay en caché de la
// colección llega en la misma respuesta (Suspense). Si toca sincronizar con
// BGG, lo lanza el navegador después, como siempre.

export const dynamic = "force-dynamic";

export default function CollectionPage() {
  return (
    <Suspense
      fallback={
        <>
          <Navbar />
          <PageLoader withNavbar />
        </>
      }
    >
      <CollectionData />
    </Suspense>
  );
}

async function CollectionData() {
  // La ruta está protegida por el proxy: aquí siempre hay sesión.
  const session = await getSession();
  // Misma forma que GET /api/collection. Si falla, el cliente lo pide él.
  const initial: ApiResponse | undefined = session
    ? await getMyCollection(session.userId)
        .then((data) => JSON.parse(JSON.stringify(data)))
        .catch((err) => {
          console.error("[collection] no se pudo cargar", err);
          return undefined;
        })
    : undefined;
  return <CollectionClient initial={initial} />;
}
