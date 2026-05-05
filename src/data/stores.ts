import grocery from "@/assets/store-grocery.jpg";
import beauty from "@/assets/store-beauty.jpg";
import barber from "@/assets/store-fashion.jpg";

export const LIVE_CATEGORIES = ["Groceries", "Beauty Store", "Barbers", "Hair & Beauty"] as const;

/** Categories that use the booking/schedule system instead of an order basket */
export const BOOKABLE_CATEGORIES = ["Barbers", "Hair & Beauty"] as const;

export const REGIONS = {
  // Diaspora host countries
  GB: { name: "United Kingdom",            currency: "GBP", symbol: "£"    },
  US: { name: "United States",             currency: "USD", symbol: "$"    },
  CA: { name: "Canada",                    currency: "CAD", symbol: "C$"   },
  FR: { name: "France",                    currency: "EUR", symbol: "€"    },
  DE: { name: "Germany",                   currency: "EUR", symbol: "€"    },
  NL: { name: "Netherlands",               currency: "EUR", symbol: "€"    },
  BE: { name: "Belgium",                   currency: "EUR", symbol: "€"    },
  IE: { name: "Ireland",                   currency: "EUR", symbol: "€"    },
  IT: { name: "Italy",                     currency: "EUR", symbol: "€"    },
  ES: { name: "Spain",                     currency: "EUR", symbol: "€"    },
  PT: { name: "Portugal",                  currency: "EUR", symbol: "€"    },
  SE: { name: "Sweden",                    currency: "SEK", symbol: "kr"   },
  NO: { name: "Norway",                    currency: "NOK", symbol: "kr"   },
  DK: { name: "Denmark",                   currency: "DKK", symbol: "kr"   },
  CH: { name: "Switzerland",               currency: "CHF", symbol: "Fr"   },
  // African countries
  NG: { name: "Nigeria",                   currency: "NGN", symbol: "₦"    },
  GH: { name: "Ghana",                     currency: "GHS", symbol: "₵"    },
  KE: { name: "Kenya",                     currency: "KES", symbol: "KSh"  },
  ZA: { name: "South Africa",              currency: "ZAR", symbol: "R"    },
  ET: { name: "Ethiopia",                  currency: "ETB", symbol: "Br"   },
  UG: { name: "Uganda",                    currency: "UGX", symbol: "USh"  },
  TZ: { name: "Tanzania",                  currency: "TZS", symbol: "TSh"  },
  SN: { name: "Senegal",                   currency: "XOF", symbol: "CFA"  },
  CI: { name: "Ivory Coast",               currency: "XOF", symbol: "CFA"  },
  CM: { name: "Cameroon",                  currency: "XAF", symbol: "FCFA" },
  ZW: { name: "Zimbabwe",                  currency: "USD", symbol: "$"    },
  SO: { name: "Somalia",                   currency: "SOS", symbol: "Sh"   },
  ER: { name: "Eritrea",                   currency: "ERN", symbol: "Nfk"  },
  CD: { name: "DR Congo",                  currency: "CDF", symbol: "FC"   },
  // Caribbean countries
  JM: { name: "Jamaica",                   currency: "JMD", symbol: "J$"   },
  TT: { name: "Trinidad & Tobago",         currency: "TTD", symbol: "TT$"  },
  BB: { name: "Barbados",                  currency: "BBD", symbol: "Bds$" },
  GY: { name: "Guyana",                    currency: "GYD", symbol: "G$"   },
  HT: { name: "Haiti",                     currency: "HTG", symbol: "G"    },
  DO: { name: "Dominican Republic",        currency: "DOP", symbol: "RD$"  },
} as const;
export type Region = keyof typeof REGIONS;

/** Per-country address field labels. Falls back to generic if not listed. */
export const REGION_ADDRESS: Partial<Record<Region, { areaLabel: string; areaPlaceholder: string }>> = {
  GB: { areaLabel: "Postcode",        areaPlaceholder: "e.g. SW1A 1AA"     },
  US: { areaLabel: "State / ZIP",     areaPlaceholder: "e.g. NY 10001"     },
  CA: { areaLabel: "Province / Postal", areaPlaceholder: "e.g. ON M5H 2N2" },
  NG: { areaLabel: "State",           areaPlaceholder: "e.g. Lagos State"  },
  JM: { areaLabel: "Parish",          areaPlaceholder: "e.g. Saint Andrew" },
  ZA: { areaLabel: "Province",        areaPlaceholder: "e.g. Gauteng"      },
  GH: { areaLabel: "Region",          areaPlaceholder: "e.g. Greater Accra"},
};
/** Generic fallback for countries not in REGION_ADDRESS */
export const DEFAULT_AREA = { areaLabel: "Postcode / Area", areaPlaceholder: "Postcode or area" };

/** Per-country bank routing field label + placeholder. Null = no routing field. */
export const REGION_BANK: Partial<Record<Region, { routingLabel: string; routingPlaceholder: string; accountPlaceholder: string; bankPlaceholder: string }>> = {
  GB: { routingLabel: "Sort code",            routingPlaceholder: "20-00-00",       accountPlaceholder: "20451887",    bankPlaceholder: "e.g. Barclays"      },
  NG: { routingLabel: "Bank code (SWIFT/NIP)", routingPlaceholder: "e.g. 044",      accountPlaceholder: "1234567890",  bankPlaceholder: "e.g. Access Bank"   },
  GH: { routingLabel: "Bank code",            routingPlaceholder: "e.g. 030100",    accountPlaceholder: "1234567890",  bankPlaceholder: "e.g. GCB Bank"      },
  KE: { routingLabel: "Branch code",          routingPlaceholder: "e.g. 01001",     accountPlaceholder: "1234567890",  bankPlaceholder: "e.g. Equity Bank"   },
  ZA: { routingLabel: "Branch code",          routingPlaceholder: "e.g. 632005",    accountPlaceholder: "1234567890",  bankPlaceholder: "e.g. FNB"           },
  US: { routingLabel: "Routing number",        routingPlaceholder: "e.g. 021000021", accountPlaceholder: "123456789",  bankPlaceholder: "e.g. Chase"         },
  CA: { routingLabel: "Transit / Institution", routingPlaceholder: "e.g. 00102",    accountPlaceholder: "1234567",    bankPlaceholder: "e.g. TD Bank"       },
  JM: { routingLabel: "Branch / Routing",     routingPlaceholder: "e.g. 00001",     accountPlaceholder: "12345678",   bankPlaceholder: "e.g. NCB"           },
  TT: { routingLabel: "Branch code",          routingPlaceholder: "e.g. 00001",     accountPlaceholder: "12345678",   bankPlaceholder: "e.g. Republic Bank"  },
  FR: { routingLabel: "IBAN",                 routingPlaceholder: "FR76 …",         accountPlaceholder: "FR76…",       bankPlaceholder: "e.g. BNP Paribas"  },
  DE: { routingLabel: "IBAN",                 routingPlaceholder: "DE89 …",         accountPlaceholder: "DE89…",       bankPlaceholder: "e.g. Deutsche Bank" },
  NL: { routingLabel: "IBAN",                 routingPlaceholder: "NL91 …",         accountPlaceholder: "NL91…",       bankPlaceholder: "e.g. ING"           },
};
/** Generic fallback for countries not in REGION_BANK */
export const DEFAULT_BANK = { routingLabel: "Routing / Branch code", routingPlaceholder: "Routing or branch code", accountPlaceholder: "Account number", bankPlaceholder: "Bank name" };
export type LiveCategory = (typeof LIVE_CATEGORIES)[number];

export const LIVE_ORIGINS = [
  "🌍 Pan-African",
  "🇬🇭 Ghanaian",
  "🇳🇬 Nigerian",
  "🇰🇪 Kenyan",
  "🇪🇹 Ethiopian",
  "🇸🇴 Somali",
  "🇪🇷 Eritrean",
  "🇿🇦 South African",
  "🇿🇼 Zimbabwean",
  "🇨🇩 Congolese",
  "🇸🇳 Senegalese",
  "🇨🇮 Ivorian",
  "🏝️ Caribbean mixed",
  "🇯🇲 Jamaican",
  "🇹🇹 Trinidadian & Tobagonian",
  "🇧🇧 Barbadian",
  "🇬🇾 Guyanese",
  "🇭🇹 Haitian",
  "🇩🇴 Dominican",
  "🇨🇺 Cuban",
] as const;
export type LiveOrigin = (typeof LIVE_ORIGINS)[number];

export type Product = {
  name: string;
  price: number;
  unit?: string;
  deposit?: number | null;
};

export type Store = {
  id: string;
  name: string;
  category: LiveCategory;
  origin: string;
  rating: number;
  reviews: number;
  distance: string;
  address: string;
  city?: string;
  postcode?: string;
  hours: string;
  phone: string;
  image: string;
  description: string;
  fulfillment: "collection" | "delivery" | "both" | "pay_at_store";
  location_type?: "salon" | "remote" | "travel" | "remote_and_travel" | null;
  instagramHandle?: string;
  tiktokHandle?: string;
  websiteUrl?: string;
  region?: Region;
  bank: { name: string; accountName: string; accountNumber: string; sortCode?: string };
  products: Product[];
  deposit_amount?: number | null;
};

export const stores: Store[] = [
  {
    id: "mama-adwoa",
    name: "Mama Adwoa's Pantry",
    category: "Groceries",
    origin: "🇬🇭 Ghanaian",
    rating: 4.9,
    reviews: 218,
    distance: "0.6 mi",
    address: "12 Ridley Rd, London E8 2NP",
    hours: "Mon–Sat · 8am – 9pm",
    phone: "+44 20 7946 0011",
    image: grocery,
    description:
      "A family-run grocer stocking pantry staples from West Africa — fresh plantain, yam, palm oil, egusi and more, sourced weekly.",
    bank: { name: "Barclays", accountName: "Adwoa Mensah Ltd", accountNumber: "20451887", sortCode: "20-00-00" },
    products: [
      { name: "Ripe Plantain", price: 1.2, unit: "each" },
      { name: "Puna Yam", price: 8.5, unit: "tuber" },
      { name: "Palm Oil (1L)", price: 6.0 },
      { name: "Egusi Seeds (500g)", price: 7.5 },
      { name: "Scotch Bonnet (250g)", price: 3.0 },
    ],
  },
  {
    id: "shea-and-soul",
    name: "Shea & Soul Apothecary",
    category: "Beauty Store",
    origin: "🇳🇬 Nigerian",
    rating: 4.9,
    reviews: 147,
    distance: "1.8 mi",
    address: "27 Peckham High St, London SE15 5DT",
    hours: "Mon–Sat · 10am – 7pm",
    phone: "+44 20 7635 9908",
    image: beauty,
    description:
      "Unrefined shea, raw black soap, and small-batch hair oils — formulated for African and Caribbean hair and skin.",
    bank: { name: "Monzo", accountName: "Shea & Soul Ltd", accountNumber: "77881122", sortCode: "04-00-04" },
    products: [
      { name: "Raw Shea Butter (250g)", price: 12.0 },
      { name: "African Black Soap", price: 8.0 },
      { name: "Chebe Hair Oil", price: 18.0 },
      { name: "Baobab Body Butter", price: 22.0 },
    ],
  },
  {
    id: "fade-factory",
    name: "Fade Factory Barbers",
    category: "Barbers",
    origin: "🇬🇭 Ghanaian",
    rating: 4.8,
    reviews: 164,
    distance: "2.3 mi",
    address: "5 Dalston Ln, London E8 3DF",
    hours: "Tue–Sun · 10am – 8pm",
    phone: "+44 20 8123 4477",
    image: barber,
    description:
      "Skin fades, beard trims, line-ups and clean cuts for the community, with walk-ins and weekend appointments.",
    bank: { name: "Starling", accountName: "Fade Factory Ltd", accountNumber: "55667788", sortCode: "60-83-71" },
    products: [
      { name: "Skin Fade", price: 25 },
      { name: "Kids Cut", price: 18 },
      { name: "Beard Shape-Up", price: 12 },
      { name: "Cut + Beard Combo", price: 32 },
    ],
  },
];

export const categories = [
  { name: "All", emoji: "🌍" },
  { name: "Groceries", emoji: "🥭" },
  { name: "Beauty Store", emoji: "✨" },
  { name: "Barbers", emoji: "💈" },
  { name: "Hair & Beauty", emoji: "💅" },
] as const;
