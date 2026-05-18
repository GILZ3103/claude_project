export type StallCategory = 'Drinks' | 'Desserts' | 'Rice Meals' | 'Seafood' | 'Healthy Choices' | 'Snacks' | 'Beverages' | 'Local Favorites';

export interface MenuItem {
  id: string;
  name: string;
  price: string;
  calories: string;
  nutritionLabel: 'Green' | 'Orange' | 'Red';
  image: string;
}

export interface Stall {
  id: string;
  name: string;
  featuredFood: string;
  calories: string;
  distance: number; // in meters
  rating: number;
  isHealthy: boolean;
  isVegetarian: boolean;
  isLowSugar: boolean;
  isHalal: boolean;
  isHighProtein: boolean;
  isLocalVendor: boolean;
  isPopularVendor: boolean;
  hasVoucher: boolean;
  isFavorite: boolean;
  isBestseller: boolean;
  category: StallCategory;
  image: string;
  zone: string;
  menu: MenuItem[];
  operatingStatus: 'Open Now' | 'Closing Soon' | 'Currently Closed';
}

export const MOCK_STALLS: Stall[] = [
  {
    id: 's1',
    name: 'Pak Ali Satay',
    featuredFood: 'Chicken Satay',
    calories: '120 kcal',
    distance: 18,
    rating: 4.8,
    isHealthy: false,
    isVegetarian: false,
    isLowSugar: true,
    isHalal: true,
    isHighProtein: true,
    isLocalVendor: true,
    isPopularVendor: true,
    hasVoucher: true,
    isFavorite: true,
    isBestseller: true,
    category: 'Snacks',
    image: 'https://images.unsplash.com/photo-1772855386828-a18ff9a12584?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlja2VuJTIwc2F0YXklMjBza2V3ZXJzfGVufDF8fHx8MTc3ODY4OTc2OHww&ixlib=rb-4.1.0&q=80&w=1080',
    zone: 'A1',
    operatingStatus: 'Open Now',
    menu: [
      { id: 'm1', name: 'Chicken Satay (5pcs)', price: 'RM 6.00', calories: '120 kcal', nutritionLabel: 'Orange', image: 'https://images.unsplash.com/photo-1772855386828-a18ff9a12584?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlja2VuJTIwc2F0YXklMjBza2V3ZXJzfGVufDF8fHx8MTc3ODY4OTc2OHww&ixlib=rb-4.1.0&q=80&w=1080' },
      { id: 'm2', name: 'Beef Satay (5pcs)', price: 'RM 7.00', calories: '150 kcal', nutritionLabel: 'Red', image: 'https://images.unsplash.com/photo-1772855386828-a18ff9a12584?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlja2VuJTIwc2F0YXklMjBza2V3ZXJzfGVufDF8fHx8MTc3ODY4OTc2OHww&ixlib=rb-4.1.0&q=80&w=1080' }
    ]
  },
  {
    id: 's2',
    name: 'Ramly Burger Station',
    featuredFood: 'Special Beef Burger',
    calories: '550 kcal',
    distance: 32,
    rating: 4.9,
    isHealthy: false,
    isVegetarian: false,
    isLowSugar: false,
    isHalal: true,
    isHighProtein: true,
    isLocalVendor: true,
    isPopularVendor: true,
    hasVoucher: false,
    isFavorite: false,
    isBestseller: true,
    category: 'Snacks',
    image: 'https://images.unsplash.com/photo-1774109618787-a080e16de7dd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMG5pZ2h0JTIwbWFya2V0JTIwc3RyZWV0JTIwYnVyZ2VyfGVufDF8fHx8MTc3ODY4OTc2OHww&ixlib=rb-4.1.0&q=80&w=1080',
    zone: 'B2',
    operatingStatus: 'Closing Soon',
    menu: [
      { id: 'm3', name: 'Special Beef Burger', price: 'RM 8.50', calories: '550 kcal', nutritionLabel: 'Red', image: 'https://images.unsplash.com/photo-1774109618787-a080e16de7dd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMG5pZ2h0JTIwbWFya2V0JTIwc3RyZWV0JTIwYnVyZ2VyfGVufDF8fHx8MTc3ODY4OTc2OHww&ixlib=rb-4.1.0&q=80&w=1080' }
    ]
  },
  {
    id: 's3',
    name: 'Wok Master',
    featuredFood: 'Penang Char Kway Teow',
    calories: '450 kcal',
    distance: 45,
    rating: 4.7,
    isHealthy: false,
    isVegetarian: false,
    isLowSugar: false,
    isHalal: true,
    isHighProtein: false,
    isLocalVendor: true,
    isPopularVendor: false,
    hasVoucher: true,
    isFavorite: false,
    isBestseller: false,
    category: 'Local Favorites',
    image: 'https://images.unsplash.com/photo-1761125174582-a1538be4ec19?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHN0cmVldCUyMGZvb2QlMjBmcmllZCUyMG5vb2RsZXN8ZW58MXx8fHwxNzc4Njg5NzY4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    zone: 'A3',
    operatingStatus: 'Open Now',
    menu: [
      { id: 'm4', name: 'Char Kway Teow', price: 'RM 9.00', calories: '450 kcal', nutritionLabel: 'Red', image: 'https://images.unsplash.com/photo-1761125174582-a1538be4ec19?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHN0cmVldCUyMGZvb2QlMjBmcmllZCUyMG5vb2RsZXN8ZW58MXx8fHwxNzc4Njg5NzY4fDA&ixlib=rb-4.1.0&q=80&w=1080' }
    ]
  },
  {
    id: 's4',
    name: 'Tako Tako',
    featuredFood: 'Octopus Balls',
    calories: '320 kcal',
    distance: 12,
    rating: 4.5,
    isHealthy: false,
    isVegetarian: false,
    isLowSugar: true,
    isHalal: true,
    isHighProtein: true,
    isLocalVendor: false,
    isPopularVendor: true,
    hasVoucher: false,
    isFavorite: true,
    isBestseller: true,
    category: 'Snacks',
    image: 'https://images.unsplash.com/photo-1771308458012-e60e667bbddf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0YWtveWFraSUyMG9jdG9wdXMlMjBiYWxsc3xlbnwxfHx8fDE3Nzg2Nzk3Nzl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    zone: 'C1',
    operatingStatus: 'Open Now',
    menu: [
      { id: 'm5', name: 'Original Takoyaki (6pcs)', price: 'RM 8.00', calories: '320 kcal', nutritionLabel: 'Orange', image: 'https://images.unsplash.com/photo-1771308458012-e60e667bbddf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0YWtveWFraSUyMG9jdG9wdXMlMjBiYWxsc3xlbnwxfHx8fDE3Nzg2Nzk3Nzl8MA&ixlib=rb-4.1.0&q=80&w=1080' }
    ]
  },
  {
    id: 's5',
    name: 'Siam Drinks',
    featuredFood: 'Thai Iced Tea',
    calories: '280 kcal',
    distance: 25,
    rating: 4.6,
    isHealthy: false,
    isVegetarian: true,
    isLowSugar: false,
    isHalal: true,
    isHighProtein: false,
    isLocalVendor: false,
    isPopularVendor: true,
    hasVoucher: true,
    isFavorite: false,
    isBestseller: true,
    category: 'Drinks',
    image: 'https://images.unsplash.com/photo-1644204010193-a35de7b0d702?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0aGFpJTIwaWNlZCUyMHRlYXxlbnwxfHx8fDE3Nzg2MzU2Njd8MA&ixlib=rb-4.1.0&q=80&w=1080',
    zone: 'B1',
    operatingStatus: 'Open Now',
    menu: [
      { id: 'm6', name: 'Thai Iced Milk Tea', price: 'RM 6.00', calories: '280 kcal', nutritionLabel: 'Red', image: 'https://images.unsplash.com/photo-1644204010193-a35de7b0d702?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0aGFpJTIwaWNlZCUyMHRlYXxlbnwxfHx8fDE3Nzg2MzU2Njd8MA&ixlib=rb-4.1.0&q=80&w=1080' }
    ]
  },
  {
    id: 's6',
    name: 'Ocean Grill',
    featuredFood: 'Grilled Squid',
    calories: '210 kcal',
    distance: 55,
    rating: 4.8,
    isHealthy: true,
    isVegetarian: false,
    isLowSugar: true,
    isHalal: true,
    isHighProtein: true,
    isLocalVendor: false,
    isPopularVendor: false,
    hasVoucher: false,
    isFavorite: false,
    isBestseller: false,
    category: 'Seafood',
    image: 'https://images.unsplash.com/photo-1758115271914-76d1acfe305e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmlsbGVkJTIwc2VhZm9vZCUyMHN0cmVldCUyMGZvb2R8ZW58MXx8fHwxNzc4Njg5NzY5fDA&ixlib=rb-4.1.0&q=80&w=1080',
    zone: 'C3',
    operatingStatus: 'Currently Closed',
    menu: [
      { id: 'm7', name: 'Whole Grilled Squid', price: 'RM 15.00', calories: '210 kcal', nutritionLabel: 'Green', image: 'https://images.unsplash.com/photo-1758115271914-76d1acfe305e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmlsbGVkJTIwc2VhZm9vZCUyMHN0cmVldCUyMGZvb2R8ZW58MXx8fHwxNzc4Njg5NzY5fDA&ixlib=rb-4.1.0&q=80&w=1080' }
    ]
  },
  {
    id: 's7',
    name: 'Ice Frost',
    featuredFood: 'Mango Shaved Ice',
    calories: '180 kcal',
    distance: 38,
    rating: 4.9,
    isHealthy: true,
    isVegetarian: true,
    isLowSugar: false,
    isHalal: true,
    isHighProtein: false,
    isLocalVendor: false,
    isPopularVendor: true,
    hasVoucher: true,
    isFavorite: true,
    isBestseller: true,
    category: 'Desserts',
    image: 'https://images.unsplash.com/photo-1765188988267-7018a757f1f3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHN0cmVldCUyMGRlc3NlcnQlMjBzaGF2ZWQlMjBpY2V8ZW58MXx8fHwxNzc4Njg5NzY5fDA&ixlib=rb-4.1.0&q=80&w=1080',
    zone: 'A2',
    operatingStatus: 'Open Now',
    menu: [
      { id: 'm8', name: 'Fresh Mango Bingsu', price: 'RM 12.00', calories: '180 kcal', nutritionLabel: 'Green', image: 'https://images.unsplash.com/photo-1765188988267-7018a757f1f3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHN0cmVldCUyMGRlc3NlcnQlMjBzaGF2ZWQlMjBpY2V8ZW58MXx8fHwxNzc4Njg5NzY5fDA&ixlib=rb-4.1.0&q=80&w=1080' }
    ]
  }
];

export const VOUCHERS = [
  { id: 'v1', title: 'RM2 OFF Drinks', stall: 'Siam Drinks', expiry: 'Today', status: 'Active', code: 'DRNK-1234', terms: 'Valid for all drinks at Siam Drinks stall.', image: 'https://images.unsplash.com/photo-1644204010193-a35de7b0d702?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0aGFpJTIwaWNlZCUyMHRlYXxlbnwxfHx8fDE3Nzg2MzU2Njd8MA&ixlib=rb-4.1.0&q=80&w=1080' },
  { id: 'v2', title: 'Buy 1 Free 1 Dessert', stall: 'Ice Frost', expiry: 'In 3 days', status: 'Active', code: 'DSRT-5678', terms: 'Valid for Mango Bingsu only.', image: 'https://images.unsplash.com/photo-1765188988267-7018a757f1f3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHN0cmVldCUyMGRlc3NlcnQlMjBzaGF2ZWQlMjBpY2V8ZW58MXx8fHwxNzc4Njg5NzY5fDA&ixlib=rb-4.1.0&q=80&w=1080' }
];

export const CATEGORIES: StallCategory[] = [
  'Drinks', 'Desserts', 'Rice Meals', 'Seafood', 'Healthy Choices', 'Snacks', 'Beverages', 'Local Favorites'
];
