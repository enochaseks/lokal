import grocery from "@/assets/store-grocery.jpg";
import restaurant from "@/assets/store-restaurant.jpg";
import beauty from "@/assets/store-beauty.jpg";
import fashion from "@/assets/store-fashion.jpg";

export type Product = {
  name: string;
  price: number;
  unit?: string;
};

export type Store = {
  id: string;
  name: string;
  category: "Groceries" | "Restaurants" | "Beauty" | "Fashion";
  origin: string;
  rating: number;
  reviews: number;
  distance: string;
  address: string;
  hours: string;
  phone: string;
  image: string;
  description: string;
  bank: { name: string; accountName: string; accountNumber: string; sortCode?: string };
  products: Product[];
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
    id: "island-spice",
    name: "Island Spice Kitchen",
    category: "Restaurants",
    origin: "🇯🇲 Jamaican",
    rating: 4.8,
    reviews: 532,
    distance: "1.1 mi",
    address: "84 Brixton Hill, London SW2 1QN",
    hours: "Tue–Sun · 12pm – 11pm",
    phone: "+44 20 7733 2244",
    image: restaurant,
    description:
      "Slow-cooked jerk over pimento wood, oxtail that falls off the bone, and the rice & peas your auntie tried to make.",
    bank: { name: "NatWest", accountName: "Island Spice Ltd", accountNumber: "33124509", sortCode: "60-12-34" },
    products: [
      { name: "Jerk Chicken Plate", price: 14.0 },
      { name: "Oxtail & Butter Beans", price: 18.5 },
      { name: "Curry Goat", price: 16.0 },
      { name: "Festival (3pc)", price: 4.5 },
      { name: "Sorrel Drink (500ml)", price: 3.5 },
    ],
  },
  {
    id: "shea-and-soul",
    name: "Shea & Soul Apothecary",
    category: "Beauty",
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
    id: "ankara-atelier",
    name: "Ankara Atelier",
    category: "Fashion",
    origin: "🌍 Pan-African",
    rating: 4.7,
    reviews: 89,
    distance: "2.3 mi",
    address: "5 Dalston Ln, London E8 3DF",
    hours: "Wed–Sun · 11am – 6pm",
    phone: "+44 20 8123 4477",
    image: fashion,
    description:
      "Bespoke ankara tailoring and ready-to-wear pieces. Bring an idea or a Pinterest board — we'll bring it to life.",
    bank: { name: "Starling", accountName: "Ankara Atelier", accountNumber: "55667788", sortCode: "60-83-71" },
    products: [
      { name: "Custom Ankara Dress", price: 120 },
      { name: "Wax Print Headwrap", price: 18 },
      { name: "Two-piece Set", price: 95 },
      { name: "Kente Pocket Square", price: 25 },
    ],
  },
];

export const categories = [
  { name: "All", emoji: "🌍" },
  { name: "Groceries", emoji: "🥭" },
  { name: "Restaurants", emoji: "🍛" },
  { name: "Beauty", emoji: "✨" },
  { name: "Fashion", emoji: "👗" },
] as const;
