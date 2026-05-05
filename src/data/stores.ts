import grocery from "@/assets/store-grocery.jpg";
import beauty from "@/assets/store-beauty.jpg";
import barber from "@/assets/store-fashion.jpg";

export const LIVE_CATEGORIES = ["Groceries", "Beauty Store", "Barbers", "Hair & Beauty"] as const;

/** Categories that use the booking/schedule system instead of an order basket */
export const BOOKABLE_CATEGORIES = ["Barbers", "Hair & Beauty"] as const;

export const REGIONS = {
  GB: { name: "United Kingdom", currency: "GBP", symbol: "£" },
  NG: { name: "Nigeria", currency: "NGN", symbol: "₦" },
  JM: { name: "Jamaica", currency: "JMD", symbol: "J$" },
} as const;
export type Region = keyof typeof REGIONS;
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
