import { ReminderCategory, CategoryMeta } from '../types';

export const CATEGORIES: Record<ReminderCategory, CategoryMeta> = {
  health: {
    id: 'health',
    label: 'Sağlamlıq',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    borderColor: 'border-rose-500/30',
    icon: 'HeartPulse',
  },
  work: {
    id: 'work',
    label: 'İş & Görüş',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
    borderColor: 'border-indigo-500/30',
    icon: 'Briefcase',
  },
  finance: {
    id: 'finance',
    label: 'Maliyyə & Ödəniş',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    borderColor: 'border-emerald-500/30',
    icon: 'CreditCard',
  },
  personal: {
    id: 'personal',
    label: 'Şəxsi & İdman',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    borderColor: 'border-violet-500/30',
    icon: 'User',
  },
  shopping: {
    id: 'shopping',
    label: 'Alış-veriş',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    borderColor: 'border-amber-500/30',
    icon: 'ShoppingBag',
  },
  education: {
    id: 'education',
    label: 'Təhsil & Dərs',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
    borderColor: 'border-sky-500/30',
    icon: 'GraduationCap',
  },
  home: {
    id: 'home',
    label: 'Ev & Təmir',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
    borderColor: 'border-orange-500/30',
    icon: 'Home',
  },
  other: {
    id: 'other',
    label: 'Digər',
    color: 'text-slate-400',
    bgColor: 'bg-slate-700/30 text-slate-300 border-white/10',
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
