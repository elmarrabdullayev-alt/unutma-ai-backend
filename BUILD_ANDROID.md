# Unutma AI — Android APK Build & Testing Guide (Windows)

Bu bələdçi heç bir proqramlaşdırma biliyi olmayan Windows istifadəçiləri üçün addım-addım hazırlanmışdır.

---

## 1. İlkin Tələblər (Windows Kompüterinizdə)

1. **Node.js LTS (v18 və ya v20+) Quraşdırın**:
   - [nodejs.org](https://nodejs.org/) saytına daxil olun, **LTS** versiyasını endirin və quraşdırın.
2. **Android Studio & SDK Quraşdırın**:
   - [developer.android.com/studio](https://developer.android.com/studio) saytından Android Studio-nu endirin və quraşdırın.
   - Quraşdırma zamanı **Android SDK**, **Android SDK Platform** və **Android Virtual Device / USB Driver** seçimlərinin işarələndiyindən əmin olun.
   - Android Studio daxilində: **Settings > Build, Execution, Deployment > Build Tools > Gradle** bölməsində **JDK 17 və ya JDK 21** seçildiyini yoxlayın.

---

## 2. Layihənin Hazırlanması

1. AI Studio-dan layihəni **ZIP** olaraq endirin və ya GitHub-dan kompüterinizə çıxarın.
2. Layihə qovluğuna daxil olun.
3. Klaviaturada `Shift` düyməsini basıb saxlayaraq qovluğun boş yerinə sağ klikləyin və **"Open PowerShell window here"** və ya **"Open in Terminal"** seçin.
4. Asılılıqları quraşdırın:
   ```bash
   npm install
   ```
5. `.env` faylını yaradın (və ya mövcud `.env` faylını yoxlayın) və backend URL-ni qeyd edin:
   ```env
   VITE_API_BASE_URL="https://ais-dev-zskhw7okvkbnkzk24lguak-34480644276.europe-west2.run.app"
   ```
   > ⚠️ **Qeyd**: `GEMINI_API_KEY` heç vaxt mobil müştəri `.env` faylına qoyulmur, o yalnız Cloud serverdə təhlükəsiz saxlanılır.

---

## 3. Metod A — Android Studio ilə APK Yaratmaq (Tövsiyə olunan)

1. Veb layihəni qurun və Android platformasına ötürün:
   ```bash
   npm run build
   npx cap sync android
   ```
2. Android Studio-nu açın:
   ```bash
   npx cap open android
   ```
3. Android Studio açıldıqdan sonra aşağı sağ küncdə **Gradle Sync** prosesinin bitməsini gözləyin.
4. Yuxarı menyudan:
   **Build > Build Bundle(s) / APK(s) > Build APK(s)** seçin.
5. Proses bitdikdə aşağı sağ küncdə **"Build APK(s): locate"** bildirişi çıxacaq.
6. **locate** düyməsinə klikləyərək APK faylını tapın:
   ```text
   android\app\build\outputs\apk\debug\app-debug.apk
   ```

---

## 4. Metod B — Birbaşa Terminal / Əmr Sətri ilə (Command-Line)

Android Studio interfeysini açmadan birbaşa PowerShell / CMD vasitəsilə:

```cmd
npm install
npm run build
npx cap sync android
cd android
gradlew.bat assembleDebug
```

Hazır olan Test APK faylının tam yolu:
```text
android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 5. APK-nın Android Telefona Quraşdırılması

1. `app-debug.apk` faylını Telegram, WhatsApp, Google Drive və ya USB kabel vasitəsilə Android telefonunuza göndərin.
2. Telefonda faylın üzərinə klikləyin.
3. Telefon "Naməlum mənbələrdən quraşdırma" icazəsi istəsə, **İcazə verin** (Allow from this source).
4. **Quraşdır (Install)** düyməsinə basaraq Unutma AI tətbiqini açın.

---

## 6. Real Cihazda Yoxlama Siyahısı (Real Device Test Checklist)

Telefonunuzda tətbiqi açdıqdan sonra aşağıdakı sınaqları ardıcıllıqla icra edin:

### Sınaq 1: Tətbiq Açıq İkən Əllə (Manual) Xatırlatma
- **Addım**: "+" düyməsinə basıb 3 dəqiqə sonraya əllə xatırlatma yaradın (məsələn: *"Dərman qəbul etmək"*).
- **Gözlənilən Nəticə**: 3 dəqiqə tamam olduqda tətbiq daxilində tam ekran/yuxarı siqnal bildirişi və səs səslənir.

### Sınaq 2: Tətbiq Arxa Planda (Background) İkən Xatırlatma
- **Addım**: 3 dəqiqə sonraya başqa bir xatırlatma yaradın və telefonu Home düyməsi ilə arxa plana keçirin və ya başqa tətbiqi açın.
- **Gözlənilən Nəticə**: 3 dəqiqədən sonra Android-in bildiriş panelində Unutma AI bildirişi, vibrasiya və səs çıxır.

### Sınaq 3: Tətbiq Tam Bağlı (Terminated / Killed) İkən Xatırlatma
- **Addım**: 3 dəqiqə sonraya xatırlatma qurun, sonra Android çox-tapşırıqlı menyudan (Recent Apps) Unutma AI-nı tam yuxarı çəkərək bağlayın.
- **Gözlənilən Nəticə**: Tətbiq bağlı olsa belə, Android Əməliyyat Sisteminin AlarmManager mexanizmi dəqiq vaxtda bildirişi çatdırır.

### Sınaq 4: Sadə Səsli Əmr və AI Təhlili
- **Addım**: Mikrofon düyməsinə toxunub danışın:
  *"3 dəqiqə sonra mənə su içməyi xatırlat."*
- **Gözlənilən Nəticə**: Səs real şəkildə mətnə çevrilir, Gemini modeli 3 dəqiqə sonranı hesablayır, xatırlatma kartı çıxır, təsdiq edildikdən sonra siqnal qurulur.

### Sınaq 5: Çox-Tapşırıqlı (Multi-Task) Azərbaycan Dili Sınağı
- **Addım**: Mikrofona deyin:
  *"Sabah saat 10-da Anara zəng etməyi və saat 2-də maşını ustaya aparmağı xatırlat."*
- **Gözlənilən Nəticə**: Tətbiq 2 ayrı xatırlatmanı (1. Sabah 10:00 - Anar, 2. Sabah 14:00 - Usta) aşkar edir və hər ikisini ayrıca nəzərdən keçirməyə təqdim edir.

### Sınaq 6: Xatırlatmanın Vaxtını Redaktə Etmək
- **Addım**: Mövcud xatırlatmanın vaxtını dəyişdirin.
- **Gözlənilən Nəticə**: Əvvəlki köhnə siqnal avtomatik ləğv edilir və yeni təyin olunan vaxt üçün yeni siqnal qeydiyyata alınır.

### Sınaq 7: Xatırlatmanı Silmək
- **Addım**: Xatırlatmanı silin.
- **Gözlənilən Nəticə**: Android sistemindəki planlaşdırılmış yerli bildiriş tam ləğv edilir.

### Sınaq 8: Telefonu Söndürüb-Yandırmaq (Reboot Test)
- **Addım**: Gələcək vaxta xatırlatma qoyub telefonu yenidən başladın (Restart).
- **Gözlənilən Nəticə**: `RECEIVE_BOOT_COMPLETED` icazəsi sayəsində xatırlatmalar itmir və vaxtı çatdıqda bildiriş yenə gəlir.
