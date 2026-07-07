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
	"casual-shoes":        7000,
	"loafers":             7000,
	"jeans":               3000,
	"khaki":               3000,
	"two-piece":           13000,
	"three-piece":         15000,
	"jackets-sub":         5500,
	"half-jackets":        5500,
	"round-neck-t-shirts": 3000,
	"v-neck-t-shirts":     3000,
	"sweat-shirts":        3000,
	"caps":                2500,
	"fedora-hats":         2500,
	"belts":               2000,
	"formal-shoes":        7000,
	"boots":               7000,
	"sandals":             7000,
	"formal-shirts":       9500,
	"casual-shirts":       5500,
	"presidential":        8500,
	"blazers":             32000,
	"track-suits":         8000,
	"formal-trousers":     3000,
	"chino":               3000,
	"gurkha":              3000,
	"linen-set":           18500,
	"linen-trousers":      7500,
	"linen-shirts":        8500,
	"linen-shorts":        6500,
	"ties":                3500,
	"sweaters":            5500,
	"dresses":             5500,
}

var costPrices = map[string]float64{
	"polos":               1350,
	"knitted-polos":       1350,
	"casual-shoes":        3150,
	"loafers":             3150,
	"formal-shoes":        3150,
	"boots":               3150,
	"sandals":             3150,
	"jeans":               1350,
	"khaki":               1350,
	"formal-trousers":     1350,
	"chino":               1350,
	"gurkha":              1350,
	"two-piece":           5850,
	"three-piece":         6750,
	"jackets-sub":         2500,
	"half-jackets":        2500,
	"round-neck-t-shirts": 1350,
	"v-neck-t-shirts":     1350,
	"sweat-shirts":        1350,
	"caps":                1100,
	"fedora-hats":         1100,
	"belts":               900,
	"sweaters":            2500,
	"dresses":             2500,
	"track-suits":         3600,
}
