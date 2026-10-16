import { ReminderCategory, CategoryMeta } from '../types';

export const CATEGORIES: Record<ReminderCategory, CategoryMeta> = {
  health: {
    id: 'health',
    label: 'Sağlamlıq',
    color: 'text-nar-300',
    bgColor: 'bg-nar-400/10 text-nar-300 border-nar-400/20',
    borderColor: 'border-nar-400/30',
    icon: 'HeartPulse',
  },
  work: {
    id: 'work',
    label: 'İş & Görüş',
    color: 'text-lilac-300',
    bgColor: 'bg-lilac-400/10 text-lilac-300 border-lilac-400/20',
    borderColor: 'border-lilac-400/30',
    icon: 'Briefcase',
  },
  finance: {
    id: 'finance',
    label: 'Maliyyə & Ödəniş',
    color: 'text-pista-300',
    bgColor: 'bg-pista-400/10 text-pista-300 border-pista-400/20',
    borderColor: 'border-pista-400/30',
    icon: 'CreditCard',
  },
  personal: {
    id: 'personal',
    label: 'Şəxsi & İdman',
    color: 'text-zer-300',
    bgColor: 'bg-zer-400/10 text-zer-300 border-zer-400/20',
    borderColor: 'border-zer-400/30',
    icon: 'User',
  },
  shopping: {
    id: 'shopping',
    label: 'Alış-veriş',
    color: 'text-amber-300',
    bgColor: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
    borderColor: 'border-amber-400/30',
    icon: 'ShoppingBag',
  },
  education: {
    id: 'education',
    label: 'Təhsil & Dərs',
    color: 'text-sky-300',
    bgColor: 'bg-sky-400/10 text-sky-300 border-sky-400/20',
    borderColor: 'border-sky-400/30',
    icon: 'GraduationCap',
  },
  home: {
    id: 'home',
    label: 'Ev & Təmir',
    color: 'text-orange-300',
    bgColor: 'bg-orange-400/10 text-orange-300 border-orange-400/20',
    borderColor: 'border-orange-400/30',
    icon: 'Home',
  },
  other: {
    id: 'other',
    label: 'Digər',
    color: 'text-ink-300',
    bgColor: 'bg-white/[0.04] text-ink-200 border-white/10',
    borderColor: 'border-white/10',
    icon: 'Bell',
  },
};

export const SAMPLE_VOICE_PROMPTS = [
  'Sabah saat 10-da həkimə zəng et, axşam 7-də idmana get və hər ayın 5-i kirayəni ödə.',
  'Bu gün saat 15:00-da komanda iclasına qoşul və saat 19:30-da marketdən çörək və süd al.',
  'Sabah səhər 09:00-da layihə təqdimatını müdirə göndər və saat 14:00-da avtomobili yudurt.',
  'Hər bazar ertəsi saat 09:00-da həftəlik planlaşdırma et və hər cümə hesabatı tamamla.',
  'Bu axşam saat 20:00-da ingilis dili dərsinə bax və sabah saat 11:30-da bank kartını yenilə.',
];

export const SAMPLE_QUESTIONS = [
  'Bu gün nə etməliyəm?',
  'Sabah nə var?',
  'Gələn həftə nələri unutmamalıyam?',
  'Maliyyə və ödənişlərim nə vaxtdır?',
];
