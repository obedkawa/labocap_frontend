import { redirect } from "next/navigation";

// La caisse de vente vit désormais sous /cashbox/vente (alignement sur les
// routes Laravel cashbox.vente.index). /cashbox redirige vers elle.
export default function CashboxIndexPage() {
  redirect("/cashbox/vente");
}
