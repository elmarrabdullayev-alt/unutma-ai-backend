import React, { useState } from 'react';
import {
  User,
  Bell,
  Volume2,
  Download,
  Upload,
  ChevronRight,
  Smartphone,
  Check,
  Server,
  Database,
} from 'lucide-react';
import { Reminder } from '../types';
import { reminderService } from '../services/reminderService';
import { notificationService } from '../services/notificationService';

interface ProfileScreenProps {
  reminders: Reminder[];
  notificationPermission: NotificationPermission;
  onRequestNotificationPermission: () => void;
  onImportReminders: (reminders: Reminder[]) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  reminders,
  notificationPermission,
  onRequestNotificationPermission,
  onImportReminders,
}) => {
  const [userName, setUserName] = useState('Jalə İsmayılova');
  const [soundEffects, setSoundEffects] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [backupSuccess, setBackupSuccess] = useState(false);

  const completedCount = reminders.filter((r) => r.isCompleted).length;
  const totalCount = reminders.length;

  const storageProviderName = reminderService.getStorageProviderName();
  const notificationProviderName = notificationService.getProviderName();

  const handleExportData = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reminders, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `unutma_ai_yedek_${new Date().toISOString().slice(0, 10)}.json`);
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

  return (
    <div className="w-full px-4 pt-2 pb-24 space-y-5">
      {/* Native App Top Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">
          Profil və Tənzimləmələr
        </h1>
        <p className="text-xs font-semibold text-slate-400 mt-0.5">
          Tətbiq parametrləri və şəxsi seçimlər
        </p>
      </div>

      {/* Profile Card Summary */}
      <div className="flex items-center gap-3.5 rounded-2xl border border-white/5 bg-[#121828] p-3.5 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-black text-base shadow-md">
          {userName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-white truncate">{userName}</h2>
          <p className="text-xs text-slate-400">Ümumi {totalCount} xatırlatma • {completedCount} tamamlanıb</p>
        </div>
      </div>

      {/* SETTINGS GROUP 1: HESAB */}
      <div className="space-y-1.5">
        <h3 className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          Hesab
        </h3>
        <div className="rounded-2xl border border-white/5 bg-[#101524] overflow-hidden divide-y divide-white/5">
          <div className="flex items-center justify-between p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">İstifadəçi adı</p>
                <p className="text-[10px] text-slate-400">{userName}</p>
              </div>
            </div>
            <button
              onClick={() => {
                const newName = prompt('Yeni adınızı daxil edin:', userName);
                if (newName) setUserName(newName);
              }}
              className="text-xs font-bold text-violet-400 hover:text-violet-300"
            >
              Dəyiş
            </button>
          </div>
        </div>
      </div>

      {/* SETTINGS GROUP 2: BİLDİRİŞLƏR */}
      <div className="space-y-1.5">
        <h3 className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          Bildirişlər
        </h3>
        <div className="rounded-2xl border border-white/5 bg-[#101524] overflow-hidden divide-y divide-white/5">
          <div className="flex items-center justify-between p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Push Bildirişlər</p>
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
        </div>
      </div>

      {/* SETTINGS GROUP 3: SƏS VƏ AI */}
      <div className="space-y-1.5">
        <h3 className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          Səs və AI
        </h3>
        <div className="rounded-2xl border border-white/5 bg-[#101524] overflow-hidden divide-y divide-white/5">
          <div className="flex items-center justify-between p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                <Volume2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Səs effektləri və TTS</p>
                <p className="text-[10px] text-slate-400">Azərbaycan dilində səsli oxuma</p>
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
                <p className="text-xs font-semibold text-white">Toxunma hissi (Haptics)</p>
                <p className="text-[10px] text-slate-400">Düymə toxunuşlarında titrəmə</p>
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

      {/* SETTINGS GROUP 4: MƏLUMATLARIN EHTİYAT NÜSXƏSİ */}
      <div className="space-y-1.5">
        <h3 className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          Məlumatların Ehtiyat Nüsxəsi
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
                <p className="text-xs font-semibold text-white">Yedəkləmə (JSON İxrac)</p>
                <p className="text-[10px] text-slate-400">Bütün xatırlatmaları cihaza yüklə</p>
              </div>
            </div>
            {backupSuccess ? (
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                <Check className="h-3 w-3" /> Yükləndi
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
                <p className="text-xs font-semibold text-white">Bərpa et (JSON İdxal)</p>
                <p className="text-[10px] text-slate-400">Əvvəlki ehtiyat nüsxəni yüklə</p>
              </div>
            </div>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </label>
        </div>
      </div>

      {/* SETTINGS GROUP 5: NATIVE PROVAYDERLƏR VƏ SİSTEM */}
      <div className="space-y-1.5">
        <h3 className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          Sistem və Native Arxitektura
        </h3>
        <div className="rounded-2xl border border-white/5 bg-[#101524] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-violet-400" /> Yaddaş Provayderi
            </span>
            <span className="font-mono text-[11px] text-violet-300 font-bold">{storageProviderName}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-indigo-400" /> Bildiriş Provayderi
            </span>
            <span className="font-mono text-[11px] text-indigo-300 font-bold">{notificationProviderName}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-pink-400" /> AI Modeli və Təhlükəsizlik
            </span>
            <span className="text-[11px] font-semibold text-emerald-400">Server-Side Proxy (Təhlükəsiz)</span>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
            <span className="text-slate-400">Versiya</span>
            <span className="font-semibold text-slate-300">2.4.0 (Capacitor Native Ready)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
