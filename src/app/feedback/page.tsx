import { redirect } from "next/navigation";

// /feedback y el roadmap eran lo mismo: proponer mejoras, reportar errores y
// votar qué llega antes. Vive todo en /roadmap; esto mantiene vivos los
// enlaces antiguos (emails, marcadores).
export default function FeedbackRedirectPage() {
  redirect("/roadmap");
}
