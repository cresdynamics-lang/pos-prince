export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
  variant_types: string[];
  children?: Category[];
};

export async function fetchCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API_BASE}/categories`, { next: { revalidate: 60 } });
    if (!res.ok) return FALLBACK_CATEGORIES;
    const data = await res.json();
    return data.categories ?? FALLBACK_CATEGORIES;
  } catch {
    return FALLBACK_CATEGORIES;
  }
}

export const FALLBACK_CATEGORIES: Category[] = [
  { id: "1", name: "Polo T-Shirts", slug: "polo-t-shirts", variant_types: ["size", "color"], children: [
    { id: "1a", name: "Knitted Polos", slug: "knitted-polos", variant_types: ["size", "color"] },
    { id: "1b", name: "Polos", slug: "polos", variant_types: ["size", "color"] },
  ]},
  { id: "2", name: "Shoes", slug: "shoes", variant_types: ["size", "color", "material"], children: [
    { id: "2a", name: "Formal Shoes", slug: "formal-shoes", variant_types: ["size", "color", "material"] },
    { id: "2b", name: "Casual", slug: "casual-shoes", variant_types: ["size", "color", "material"] },
    { id: "2c", name: "Boots", slug: "boots", variant_types: ["size", "color", "material"] },
    { id: "2d", name: "Sandals", slug: "sandals", variant_types: ["size", "color", "material"] },
    { id: "2e", name: "Loafers", slug: "loafers", variant_types: ["size", "color", "material"] },
  ]},
  { id: "3", name: "Shirts", slug: "shirts", variant_types: ["size", "color", "sleeve_type"], children: [
    { id: "3a", name: "Formal Shirts", slug: "formal-shirts", variant_types: ["size", "color", "sleeve_type"] },
    { id: "3b", name: "Casual", slug: "casual-shirts", variant_types: ["size", "color", "sleeve_type"] },
    { id: "3c", name: "Presidential", slug: "presidential", variant_types: ["size", "color", "sleeve_type"] },
  ]},
  { id: "4", name: "Suits", slug: "suits", variant_types: ["size", "color"], children: [
    { id: "4a", name: "Two Piece", slug: "two-piece", variant_types: ["size", "color"] },
    { id: "4b", name: "Three Piece", slug: "three-piece", variant_types: ["size", "color"] },
  ]},
  { id: "5", name: "Blazers", slug: "blazers", variant_types: ["size", "color"], children: [
    { id: "5a", name: "Formal Blazers", slug: "formal-blazers", variant_types: ["size", "color"] },
    { id: "5b", name: "Casual Blazers", slug: "casual-blazers", variant_types: ["size", "color"] },
  ]},
  { id: "6", name: "Track Suits", slug: "track-suits", variant_types: ["size", "color"], children: [
    { id: "6a", name: "Track Suits", slug: "track-suits-set", variant_types: ["size", "color"] },
    { id: "6b", name: "Joggers Set", slug: "joggers-set", variant_types: ["size", "color"] },
  ]},
  { id: "7", name: "Jackets", slug: "jackets", variant_types: ["size", "color", "material"], children: [
    { id: "7a", name: "Jackets", slug: "jackets-sub", variant_types: ["size", "color", "material"] },
    { id: "7b", name: "Half Jacket", slug: "half-jackets", variant_types: ["size", "color", "material"] },
    { id: "7c", name: "Puff Jacket", slug: "puff-jackets", variant_types: ["size", "color", "material"] },
  ]},
  { id: "8", name: "Trousers", slug: "trousers", variant_types: ["size", "length", "color"], children: [
    { id: "8a", name: "Khaki", slug: "khaki", variant_types: ["size", "length", "color"] },
    { id: "8b", name: "Formal", slug: "formal-trousers", variant_types: ["size", "length", "color"] },
    { id: "8c", name: "Chino", slug: "chino", variant_types: ["size", "length", "color"] },
    { id: "8d", name: "Jeans", slug: "jeans", variant_types: ["size", "length", "color"] },
    { id: "8e", name: "Gurkha", slug: "gurkha", variant_types: ["size", "length", "color"] },
  ]},
  { id: "9", name: "Linen", slug: "linen", variant_types: ["size", "color"], children: [
    { id: "9a", name: "Linen Set", slug: "linen-set", variant_types: ["size", "color"] },
    { id: "9b", name: "Linen Trousers", slug: "linen-trousers", variant_types: ["size", "color"] },
    { id: "9c", name: "Linen Shirts", slug: "linen-shirts", variant_types: ["size", "color"] },
    { id: "9d", name: "Linen Shorts", slug: "linen-shorts", variant_types: ["size", "color"] },
  ]},
  { id: "10", name: "Caps & Hats", slug: "caps-hats", variant_types: ["color"], children: [
    { id: "10a", name: "Caps", slug: "caps", variant_types: ["color"], children: [] },
    { id: "10b", name: "Fedora Hats", slug: "fedora-hats", variant_types: ["color"], children: [] },
  ]},
  { id: "11", name: "Belts & Ties", slug: "belts-ties", variant_types: ["color", "size"], children: [
    { id: "11a", name: "Belts", slug: "belts", variant_types: ["size", "color"] },
    { id: "11b", name: "Ties", slug: "ties", variant_types: ["color"] },
  ]},
  { id: "12", name: "Sweaters", slug: "sweaters", variant_types: ["size", "color"], children: [
    { id: "12a", name: "Crew Neck", slug: "crew-neck-sweaters", variant_types: ["size", "color"] },
    { id: "12b", name: "V-Neck", slug: "v-neck-sweaters", variant_types: ["size", "color"] },
    { id: "12c", name: "Cardigans", slug: "cardigans", variant_types: ["size", "color"] },
  ]},
  { id: "13", name: "T-Shirts", slug: "t-shirts", variant_types: ["size", "color"], children: [
    { id: "13a", name: "Sweat-Shirts", slug: "sweat-shirts", variant_types: ["size", "color"] },
    { id: "13b", name: "Round-Neck T-Shirts", slug: "round-neck-t-shirts", variant_types: ["size", "color"] },
    { id: "13c", name: "V-Neck T-Shirts", slug: "v-neck-t-shirts", variant_types: ["size", "color"] },
  ]},
];
