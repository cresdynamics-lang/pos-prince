package catalog

// ListPrice returns the standard list price (KES) for a leaf category slug.
func ListPrice(categorySlug string) float64 {
	if p, ok := listPrices[categorySlug]; ok {
		return p
	}
	return 5500
}

func CostPrice(categorySlug string) float64 {
	if c, ok := costPrices[categorySlug]; ok {
		return c
	}
	list := ListPrice(categorySlug)
	return float64(int(list*0.45/100) * 100)
}

// Client-confirmed retail prices (KES).
var listPrices = map[string]float64{
	"polos":               3000,
	"knitted-polos":       3000,
	"casual-shoes":        6500,
	"loafers":             6500,
	"jeans":               2500,
	"khaki":               3000,
	"two-piece":           13000,
	"three-piece":         15000,
	"jackets-sub":         5500,
	"half-jackets":        5500,
	"round-neck-t-shirts": 2000,
	"v-neck-t-shirts":     2000,
	"sweat-shirts":        2000,
	"caps":                2500,
	"fedora-hats":         2500,
	"belts":               2000,
	"formal-shoes":        38500,
	"boots":               22000,
	"sandals":             6500,
	"formal-shirts":       9500,
	"casual-shirts":       5500,
	"presidential":        8500,
	"blazers":             32000,
	"track-suits":         15000,
	"formal-trousers":     7500,
	"chino":               6500,
	"gurkha":              8500,
	"linen-set":           18500,
	"linen-trousers":      7500,
	"linen-shirts":        8500,
	"linen-shorts":        6500,
	"ties":                3500,
	"sweaters":            12000,
}

var costPrices = map[string]float64{
	"polos":               1350,
	"knitted-polos":       1350,
	"casual-shoes":        2900,
	"loafers":             2900,
	"jeans":               1100,
	"khaki":               1350,
	"two-piece":           5850,
	"three-piece":         6750,
	"jackets-sub":         2500,
	"half-jackets":        2500,
	"round-neck-t-shirts": 900,
	"v-neck-t-shirts":     900,
	"sweat-shirts":        900,
	"caps":                1100,
	"fedora-hats":         1100,
	"belts":               900,
}
