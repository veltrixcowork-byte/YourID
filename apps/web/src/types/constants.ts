import {
  BookOpen,
  Briefcase,
  CreditCard,
  GraduationCap,
  Landmark,
  MonitorSmartphone,
  Music,
  Package,
  Palette,
  Smartphone,
  WalletCards,
  Waves,
} from 'lucide-react';

export const CURRENCIES = [
  { code: 'XOF', name: 'Franc CFA UEMOA', symbol: 'FCFA' },
  { code: 'XAF', name: 'Franc CFA CEMAC', symbol: 'FCFA' },
  { code: 'GHS', name: 'Cedi Ghanéen', symbol: 'GH₵' },
  { code: 'NGN', name: 'Naira Nigérian', symbol: '₦' },
  { code: 'KES', name: 'Shilling Kényan', symbol: 'KSh' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'Dollar US', symbol: '$' },
];

export const COUNTRIES = [
  { code: 'SN', name: 'Sénégal', flag: 'SN' },
  { code: 'CI', name: "Côte d'Ivoire", flag: 'CI' },
  { code: 'CM', name: 'Cameroun', flag: 'CM' },
  { code: 'ML', name: 'Mali', flag: 'ML' },
  { code: 'BF', name: 'Burkina Faso', flag: 'BF' },
  { code: 'GH', name: 'Ghana', flag: 'GH' },
  { code: 'NG', name: 'Nigeria', flag: 'NG' },
  { code: 'GA', name: 'Gabon', flag: 'GA' },
  { code: 'KE', name: 'Kenya', flag: 'KE' },
  { code: 'MA', name: 'Maroc', flag: 'MA' },
  { code: 'FR', name: 'France', flag: 'FR' },
  { code: 'US', name: 'États-Unis', flag: 'US' },
];

export const PAYMENT_METHODS = [
  { id: 'mtn_momo', name: 'MTN MoMo', icon: Smartphone, color: '#FFB800', countries: ['CI', 'GH', 'CM', 'SN'] },
  { id: 'orange_money', name: 'Orange Money', icon: WalletCards, color: '#FF6600', countries: ['SN', 'CI', 'ML'] },
  { id: 'wave', name: 'Wave', icon: Waves, color: '#1ba1e2', countries: ['SN', 'CI', 'ML', 'BF'] },
  { id: 'airtel_money', name: 'Airtel Money', icon: Landmark, color: '#FF0000', countries: ['KE', 'NG', 'GH'] },
  { id: 'moov', name: 'Moov Money', icon: CreditCard, color: '#00A0E3', countries: ['CI', 'BF', 'ML'] },
  { id: 'card', name: 'Carte Bancaire', icon: CreditCard, color: '#6366F1', countries: [] },
];

export const PRODUCT_TYPES = [
  { value: 'EBOOK', label: 'Ebook', icon: BookOpen },
  { value: 'COURSE', label: 'Formation', icon: GraduationCap },
  { value: 'AUDIO', label: 'Audio', icon: Music },
  { value: 'TEMPLATE', label: 'Template', icon: Palette },
  { value: 'SOFTWARE', label: 'Logiciel', icon: MonitorSmartphone },
  { value: 'SERVICE', label: 'Service', icon: Briefcase },
  { value: 'OTHER', label: 'Autre', icon: Package },
];
