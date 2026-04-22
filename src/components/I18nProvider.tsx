import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "ar";

interface Translations {
  [key: string]: { en: string; ar: string };
}

const translations: Translations = {
  // Common
  search_patients: {
    en: "Search patients by name or phone...",
    ar: "ابحث عن المرضى بالاسم أو رقم الهاتف...",
  },
  add_patient: { en: "Add Patient", ar: "إضافة مريض" },
  patients: { en: "Patients", ar: "المرضى" },
  id: { en: "ID", ar: "المعرف" },
  dashboard: { en: "Dashboard", ar: "لوحة القيادة" },
  logout: { en: "Logout", ar: "تسجيل خروج" },
  delete: { en: "Delete", ar: "حذف" },
  uploading: { en: "Uploading...", ar: "جاري الرفع..." },

  // Dashboard
  no_patients: {
    en: "No patients found matching your search.",
    ar: "لم يتم العثور على مرضى مطابقين لبحثك.",
  },
  all_patients: { en: "All Patients", ar: "كل المرضى" },
  favorites: { en: "Favorites", ar: "المفضلة" },

  // Add Patient Modal
  add_new_patient: { en: "Add New Patient", ar: "إضافة مريض جديد" },
  full_name: { en: "Full Name *", ar: "الاسم الكامل *" },
  phone_number: { en: "Phone Number *", ar: "رقم الهاتف *" },
  address: { en: "Address *", ar: "العنوان *" },
  date_of_birth: {
    en: "Date of Birth (Optional)",
    ar: "تاريخ الميلاد (اختياري)",
  },
  medical_history_summary: {
    en: "Medical History Summary *",
    ar: "ملخص التاريخ الطبي *",
  },
  upload_history_image: {
    en: "Attach History Image",
    ar: "إرفاق صورة للتاريخ الطبي",
  },
  cancel: { en: "Cancel", ar: "إلغاء" },
  save: { en: "Save", ar: "حفظ" },

  // Patient Details
  back_to_patients: { en: "Back to Patients", ar: "العودة إلى المرضى" },
  add_visit: { en: "Add Visit", ar: "إضافة زيارة" },
  info: { en: "Info", ar: "المعلومات" },
  history: { en: "History", ar: "التاريخ الطبي" },
  visits: { en: "Visits", ar: "الزيارات" },
  patient_information: { en: "Patient Information", ar: "معلومات المريض" },
  home_address: { en: "Home Address", ar: "عنوان المنزل" },
  age: { en: "Age", ar: "العمر" },
  years_old: { en: "years old", ar: "سنة" },
  comprehensive_history: {
    en: "Comprehensive Medical History",
    ar: "السجل الطبي الشامل",
  },
  no_history: { en: "No recorded history.", ar: "لا يوجد تاريخ مسجل." },
  none: { en: "None", ar: "لا يوجد" },

  // Edit Patient
  edit: { en: "Edit", ar: "تعديل" },

  // Visit Modal
  add_new_visit: { en: "Add New Visit", ar: "إضافة زيارة جديدة" },
  diagnosis_reason: {
    en: "Diagnosis / Reason for Visit *",
    ar: "التشخيص / سبب الزيارة *",
  },
  clinical_notes: { en: "Clinical Notes *", ar: "ملاحظات سريرية *" },
  upload_note_image: {
    en: "Attach Image to Note",
    ar: "إرفاق صورة مع الملاحظة",
  },
  diagnostic_images: {
    en: "Clinical Images (Unlimited)",
    ar: "صور سريرية (غير محدود)",
  },
  lab_results: { en: "Lab Results / Scans", ar: "نتائج المختبر / الأشعة" },
  audio_recordings: { en: "Audio Recordings", ar: "تسجيلات صوتية" },
  prescription_image: { en: "Prescription Image", ar: "صورة الوصفة الطبية" },
  next_followup_date: {
    en: "Next Follow-up Date",
    ar: "تاريخ المراجعة القادمة",
  },
  save_visit: { en: "Save Visit", ar: "حفظ الزيارة" },
  no_visits_yet: {
    en: "No visits recorded yet",
    ar: "لم يتم تسجيل أي زيارات بعد",
  },
  create_first_visit: { en: "Create First Visit", ar: "إنشاء أول زيارة" },
};

interface I18nContextProps {
  lang: Language;
  toggleLang: () => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem("preferredLang") as Language) || "en";
  });

  useEffect(() => {
    localStorage.setItem("preferredLang", lang);
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  const toggleLang = () => {
    setLang((prev) => (prev === "en" ? "ar" : "en"));
  };

  const t = (key: string): string => {
    if (!translations[key]) return key;
    return translations[key][lang] || translations[key].en;
  };

  return (
    <I18nContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
