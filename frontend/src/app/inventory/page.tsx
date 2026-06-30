import { InventoryView } from "@/components/PosViews";
import { fetchCategories } from "@/lib/api";

export default async function InventoryPage() {
  const categories = await fetchCategories();
  return <InventoryView categories={categories} />;
}
