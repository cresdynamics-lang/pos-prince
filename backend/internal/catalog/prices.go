package catalog

// ListPrice returns the standard list price (KES) for a leaf category slug.
// Cost is ~45% of list — adjust in admin when client confirms exact figures.
func ListPrice(categorySlug string) float64 {
	if p, ok := listPrices[categorySlug]; ok {
		return p
	}
	return 5500
}

func CostPrice(categorySlug string) float64 {
	list := ListPrice(categorySlug)
	return float64(int(list*0.45/100) * 100)
}

// listPrices — Prince Esquire retail guide (KES). Update via admin or future import.
var listPrices = map[string]float64{
	"knitted-polos":     6500,
	"polos":             5500,
	"formal-shoes":      38500,
	"casual-shoes":      12500,
	"boots":             22000,
	"sandals":           6500,
	"loafers":           32500,
	"formal-shirts":     9500,
	"casual-shirts":     5500,
	"presidential":      8500,
	"two-piece":         95000,
	"three-piece":       135000,
	"blazers":           32000,
	"track-suits":       15000,
	"jackets-sub":       18500,
	"half-jackets":      14000,
	"khaki":             5500,
	"formal-trousers":   7500,
	"chino":             6500,
	"jeans":             5500,
	"gurkha":            8500,
	"linen-set":         18500,
	"linen-trousers":    7500,
	"linen-shirts":      8500,
	"linen-shorts":      6500,
	"caps-hats":         2500,
	"belts":             4500,
	"ties":              3500,
	"sweaters":          12000,
	"sweat-shirts":      4500,
	"round-neck-t-shirts": 3500,
	"v-neck-t-shirts":   3500,
}
