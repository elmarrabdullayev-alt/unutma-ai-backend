import React, { useState, useEffect } from 'react';
import {
  User,
  Bell,
  Volume2,
  Download,
  Upload,
  ChevronRight,
  Smartphone,
  Check,
  Calendar,
  Sparkles,
  Edit3,
  RotateCcw,
  X,
  Heart,
  ShieldCheck,
  Info,
  TrendingUp,
} from 'lucide-react';
import { Reminder, UserProfile, UserGender } from '../types';
import { userProfileService } from '../services/userProfileService';

interface ProfileScreenProps {
  reminders: Reminder[];
  notificationPermission: NotificationPermission;
  onRequestNotificationPermission: () => void;
  onImportReminders: (reminders: Reminder[]) => void;
  onReplayOnboarding?: () => void;
  onOpenProgress?: () => void;
}

const GENDER_LABELS: Record<UserGender, string> = {
  male: 'Kişi',
  female: 'Qadın',
  other: 'Digər',
  prefer_not_to_say: 'Demək istəmirəm',
};

const AZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
  'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
];

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  reminders,
  notificationPermission,
  onRequestNotificationPermission,
  onImportReminders,
  onReplayOnboarding,
  onOpenProgress,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(() => userProfileService.getProfile());
  const [soundEffects, setSoundEffects] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [backupSuccess, setBackupSuccess] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Edit modal state
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editGender, setEditGender] = useState<UserGender>('male');
  const [editYear, setEditYear] = useState(2000);
  const [editMonth, setEditMonth] = useState(1);
  const [editDay, setEditDay] = useState(15);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = userProfileService.subscribe((updated) => {
      setProfile(updated);
    });
    return unsub;
  }, []);

  const totalCount = reminders.length;

  const fullName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : 'İstifadəçi';

  const initials = userProfileService.getInitials(profile);

  const formatBirthDate = (isoStr?: string) => {
    if (!isoStr) return 'Qeyd edilməyib';
    const parts = isoStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return isoStr;
  };

  const handleOpenEdit = () => {
    if (profile) {
      setEditFirstName(profile.firstName || '');
      setEditLastName(profile.lastName || '');
      setEditGender(profile.gender || 'male');

      if (profile.birthDate) {
        const parts = profile.birthDate.split('-');
        if (parts.length === 3) {
          setEditYear(Number(parts[0]) || 2000);
          setEditMonth(Number(parts[1]) || 1);
          setEditDay(Number(parts[2]) || 15);
        }
      }
    }
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedFirst = editFirstName.trim();
    const trimmedLast = editLastName.trim();

    if (!trimmedFirst) {
      setEditError('Ad xanası boş buraxıla bilməz.');
      return;
    }
    if (!trimmedLast) {
      setEditError('Soyad xanası boş buraxıla bilməz.');
      return;
    }

    const formattedDay = editDay.toString().padStart(2, '0');
    const formattedMonth = editMonth.toString().padStart(2, '0');
    const isoBirthDate = `${editYear}-${formattedMonth}-${formattedDay}`;

    const updatedProfile: UserProfile = {
      firstName: trimmedFirst,
      lastName: trimmedLast,
      gender: editGender,
      birthDate: isoBirthDate,
      onboardingCompleted: profile?.onboardingCompleted ?? true,
      createdAt: profile?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await userProfileService.saveProfile(updatedProfile);
    setIsEditModalOpen(false);
  };

  const handleExportData = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reminders, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `unutma_ai_ehtiyat_nusxe_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setBackupSuccess(true);
    setTimeout(() => setBackupSuccess(false), 3000);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            onImportReminders(parsed);
            alert('Məlumatlar uğurla bərpa olundu!');
          }
        } catch (err) {
          alert('Fayl formatı düzgün deyil.');
        }
      };
    }
  };

  // Days in month calculation for modal
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1920 + 1 }, (_, i) => currentYear - i);
  const daysInMonth = new Date(editYear, editMonth, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="w-full px-4 pt-2 pb-24 space-y-5">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">
          Tətbiq ayarları
        </h1>
        <p className="text-xs font-semibold text-slate-400 mt-0.5">
          Tənzimləmələr və şəxsi seçimlər
        </p>
      </div>

      {/* Profile Card Summary with Initials Avatar */}
      <div className="flex items-center gap-3.5 rounded-2xl border border-white/5 bg-[#121828] p-3.5 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-black text-base shadow-md">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-white truncate">{fullName}</h2>
          <p className="text-xs text-slate-400">
            {profile?.gender ? GENDER_LABELS[profile.gender] : 'İstifadəçi'} • Ümumi {totalCount} xatırlatma
          </p>
        </div>
        <button
          onClick={handleOpenEdit}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 active:scale-95 transition-transform"
          title="Şəxsi məlumatları redaktə et"
        >
          <Edit3 className="h-4 w-4" />
        </button>
      </div>

      {/* SECTION 1: ŞƏXSİ MƏLUMATLAR */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Şəxsi məlumatlar
          </h3>
          <button
            onClick={handleOpenEdit}
            className="text-[11px] font-bold text-violet-400 hover:text-violet-300 transition-colors"
          >
            Redaktə et
          </button>
        </div>

        <div className="rounded-2xl border border-white/5 bg-[#101524] overflow-hidden divide-y divide-white/5">
          {/* Ad və Soyad */}
          <div className="flex items-center justify-between p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Ad və Soyad</p>
                <p className="text-[10px] text-slate-400">{fullName}</p>
              </div>
            </div>
            <button
              onClick={handleOpenEdit}
              className="text-xs font-bold text-violet-400 hover:text-violet-300"
            >
              Dəyiş
            </button>
          </div>

          {/* Cinsiyyət */}
          <div className="flex items-center justify-between p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
                <Heart className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Cinsiyyət</p>
                <p className="text-[10px] text-slate-400">
                  {profile?.gender ? GENDER_LABELS[profile.gender] : 'Demək istəmirəm'}
                </p>
              </div>
            </div>
            <button
              onClick={handleOpenEdit}
              className="text-xs font-bold text-violet-400 hover:text-violet-300"
            >
              Dəyiş
            </button>
          </div>

          {/* Doğum Tarixi */}
          <div className="flex items-center justify-between p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Doğum tarixi</p>
                <p className="text-[10px] text-slate-400">
                  {formatBirthDate(profile?.birthDate)}
                </p>
              </div>
            </div>
            <button
              onClick={handleOpenEdit}
              className="text-xs font-bold text-violet-400 hover:text-violet-300"
            >
              Dəyiş
            </button>
          </div>
        </div>
      </div>

      {/* SECTION: İRƏLİLƏYİŞİM */}
      {onOpenProgress && (
        <div className="space-y-1.5">
          <h3 className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            İrəliləyişim
          </h3>
          <div className="rounded-2xl border border-white/5 bg-[#101524] overflow-hidden">
            <button
              onClick={onOpenProgress}
              className="flex w-full items-center justify-between p-3.5 hover:bg-slate-800/40 text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400 group-hover:scale-105 transition-transform">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">İrəliləyişim</p>
                  <p className="text-[10px] text-slate-400">
                    Ardıcıl günlər, rutin və fokus nəticələrin.
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-violet-400 transition-colors" />
            </button>
          </div>
        </div>
      )}

      {/* SECTION A: BİLDİRİŞLƏR */}
      <div className="space-y-1.5">
        <div className="px-1">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Bildirişlər
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Xatırlatmaları vaxtında almaq üçün bildiriş ayarlarını idarə et.
          </p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-[#101524] overflow-hidden divide-y divide-white/5">
          <div className="flex items-center justify-between p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Bildirişlər</p>
                <p className="text-[10px] text-slate-400">
                  {notificationPermission === 'granted' ? 'Aktivdir' : 'İcazə tələb olunur'}
                </p>
              </div>
            </div>

            {notificationPermission === 'granted' ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                <Check className="h-3.5 w-3.5" /> Aktiv
              </span>
            ) : (
              <button
                onClick={onRequestNotificationPermission}
                className="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-500 active:scale-95"
              >
                İcazə ver
              </button>
            )}
          </div>

          <div className="flex items-center justify-between p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                <Volume2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Səs effektləri</p>
                <p className="text-[10px] text-slate-400">Bildirişlərdə və tətbiqdə səs</p>
              </div>
            </div>
            <button
              onClick={() => setSoundEffects(!soundEffects)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                soundEffects ? 'bg-violet-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  soundEffects ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/15 text-pink-400">
                <Smartphone className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Titrəmə</p>
                <p className="text-[10px] text-slate-400">Düymə toxunuşlarında geri bildiriş</p>
              </div>
            </div>
            <button
              onClick={() => setHapticFeedback(!hapticFeedback)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                hapticFeedback ? 'bg-violet-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  hapticFeedback ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION B: MƏLUMATLAR VƏ EHTİYAT NÜSXƏ */}
      <div className="space-y-1.5">
        <h3 className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          Məlumatlar və ehtiyat nüsxə
        </h3>
        <div className="rounded-2xl border border-white/5 bg-[#101524] overflow-hidden divide-y divide-white/5">
          <button
            onClick={handleExportData}
            className="flex w-full items-center justify-between p-3.5 hover:bg-slate-800/40 text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <Download className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Ehtiyat nüsxə yarat</p>
                <p className="text-[10px] text-slate-400">Xatırlatmalarını fayl şəklində yadda saxla.</p>
              </div>
            </div>
            {backupSuccess ? (
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                <Check className="h-3 w-3" /> Yadda saxlanıldı
              </span>
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-500" />
            )}
          </button>

          <label className="flex w-full items-center justify-between p-3.5 hover:bg-slate-800/40 cursor-pointer transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                <Upload className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Bərpa et</p>
                <p className="text-[10px] text-slate-400">Əvvəl saxladığın ehtiyat nüsxəni geri yüklə.</p>
              </div>
            </div>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </label>
        </div>
      </div>

      {/* SECTION C: MƏLUMATLARIN SAXLANMASI */}
      <div className="space-y-1.5">
        <h3 className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          Məlumatların saxlanması
        </h3>
        <div className="rounded-2xl border border-white/5 bg-[#101524] p-3.5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400 shrink-0 mt-0.5">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white">
                Xatırlatmaların və şəxsi məlumatların bu cihazda saxlanılır.
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Məlumatların icazən olmadan avtomatik paylaşılmır.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION D: İLK TANIŞLIQ */}
      {onReplayOnboarding && (
        <div className="space-y-1.5">
          <h3 className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            İlk tanışlıq
          </h3>
          <div className="rounded-2xl border border-white/5 bg-[#101524] overflow-hidden">
            <button
              onClick={onReplayOnboarding}
              className="flex w-full items-center justify-between p-3.5 hover:bg-slate-800/40 text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                  <RotateCcw className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">İlk tanışlığı yenidən göstər</p>
                  <p className="text-[10px] text-slate-400">Giriş və tanışlıq addımlarını yenidən gör.</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </div>
      )}

      {/* SECTION E: TƏTBİQ HAQQINDA */}
      <div className="space-y-1.5">
        <h3 className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          Tətbiq haqqında
        </h3>
        <div className="rounded-2xl border border-white/5 bg-[#101524] p-3.5 space-y-2.5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-300 shrink-0 mt-0.5">
              <Info className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Unutma AI</p>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                Azərbaycan dilində süni intellekt dəstəkli səsli xatırlatma və şəxsi yaddaş köməkçisi.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-2.5 border-t border-white/5">
            <span className="text-slate-400">Versiya</span>
            <span className="font-semibold text-slate-300">2.5.0</span>
          </div>
        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#0F1424] border border-white/10 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <span>Şəxsi Məlumatları Dəyiş</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              {/* Ad */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Ad
                </label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="Adınız"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#141B2D] border border-white/10 text-white text-sm outline-none focus:border-violet-500"
                />
              </div>

              {/* Soyad */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Soyad
                </label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Soyadınız"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#141B2D] border border-white/10 text-white text-sm outline-none focus:border-violet-500"
                />
              </div>

              {/* Cinsiyyət */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Cinsiyyət
                </label>
                <select
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value as UserGender)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#141B2D] border border-white/10 text-white text-sm outline-none focus:border-violet-500"
                >
                  <option value="male">Kişi</option>
                  <option value="female">Qadın</option>
                  <option value="other">Digər</option>
                  <option value="prefer_not_to_say">Demək istəmirəm</option>
                </select>
              </div>

              {/* Doğum Tarixi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Doğum Tarixi
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={editDay > daysInMonth ? daysInMonth : editDay}
                    onChange={(e) => setEditDay(Number(e.target.value))}
                    className="h-11 px-2 rounded-xl bg-[#141B2D] border border-white/10 text-white text-xs outline-none focus:border-violet-500"
                  >
                    {days.map((d) => (
                      <option key={d} value={d} className="bg-[#141B2D] text-white">
                        {d}
                      </option>
                    ))}
                  </select>

                  <select
                    value={editMonth}
                    onChange={(e) => setEditMonth(Number(e.target.value))}
                    className="h-11 px-2 rounded-xl bg-[#141B2D] border border-white/10 text-white text-xs outline-none focus:border-violet-500 truncate"
                  >
                    {AZ_MONTHS.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1} className="bg-[#141B2D] text-white">
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={editYear}
                    onChange={(e) => setEditYear(Number(e.target.value))}
                    className="h-11 px-2 rounded-xl bg-[#141B2D] border border-white/10 text-white text-xs outline-none focus:border-violet-500"
                  >
                    {years.map((y) => (
                      <option key={y} value={y} className="bg-[#141B2D] text-white">
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {editError && (
                <p className="text-xs text-rose-400 font-medium">{editError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 h-11 rounded-xl bg-white/5 text-slate-300 text-xs font-bold hover:bg-white/10 transition-colors"
                >
                  Ləğv et
                </button>
                <button
                  type="submit"
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-md"
                >
                  Yadda saxla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
