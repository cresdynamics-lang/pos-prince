package catalog

// ApparelSizes for shirts, sweaters, polos, suits, blazers, trousers, linen, t-shirts, track suits, jackets.
var ApparelSizes = []string{"S", "M", "L", "XL", "2XL", "XXL", "4XL"}

// ShoeSizes for footwear.
var ShoeSizes = []string{"39", "40", "41", "42", "43", "44", "45", "46"}

// CapSizes kept for legacy reference; caps/belts/ties use name-only variants now.
var CapSizes = []string{"S", "M", "L", "XL"}

// AllowsMultipleProducts — ties, caps, fedora can have many named products per category.
func AllowsMultipleProducts(categorySlug string) bool {
	switch categorySlug {
	case "ties", "caps", "fedora-hats":
		return true
	default:
		return false
	}
}

// IsNameOnlyCategory — no size axis on variants (belts, ties, caps, fedora).
func IsNameOnlyCategory(categorySlug string) bool {
	return len(SizeProfile(categorySlug)) == 0
}

// SizeProfile maps category slug patterns to size sets.
func SizeProfile(categorySlug string) []string {
	switch categorySlug {
	case "shoes", "formal-shoes", "casual-shoes", "boots", "sandals", "loafers":
		return ShoeSizes
	case "caps-hats", "caps", "fedora-hats", "belts", "ties", "belts-ties":
		return nil
	default:
		return ApparelSizes
	}
}

func UsesSize(categorySlug string) bool {
	return len(SizeProfile(categorySlug)) > 0
}
