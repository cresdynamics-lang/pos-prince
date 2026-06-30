import { PosView } from "@/components/PosViews";
import { fetchCategories } from "@/lib/api";

export default async function PosPage() {
  const categories = await fetchCategories();
  return <PosView categories={categories} />;
}
