import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, addDoc, where, doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Patient } from '../types';
import { Link } from 'react-router-dom';
import { Users, Search, Plus, Calendar, Phone, X, Star, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../components/AuthProvider';
import { useI18n } from '../components/I18nProvider';

// Utility for fast parallel uploads with timeout
const processFilesFast = async (files: File[], pathPrefix: string): Promise<string[]> => {
  if (!files || files.length === 0) return [];
  const uploadPromises = files.map(async (file) => {
    return new Promise<string>((resolve, reject) => {
      const fileRef = ref(storage, `${pathPrefix}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`);
      const timer = setTimeout(() => reject(new Error("Timeout: File upload took too long. Check your connection or Firebase Storage rules.")), 30000);
      
      uploadBytes(fileRef, file).then(async () => {
        clearTimeout(timer);
        const url = await getDownloadURL(fileRef);
        resolve(url);
      }).catch(err => {
        clearTimeout(timer);
        reject(err);
      });
    });
  });
  return await Promise.all(uploadPromises);
};

const StorageErrorHelp = () => (
  <div className="bg-red-500/10 border border-red-500/50 text-red-700 dark:text-red-300 p-4 rounded-xl text-sm mt-4 space-y-3" dir="rtl">
    <div className="flex items-center gap-2 font-bold mb-2 text-red-600 dark:text-red-400">
      <AlertCircle className="h-5 w-5" />
      <span>خطأ: يجب تفعيل مساحة تخزين الصور يدوياً (Storage)</span>
    </div>
    <p>التطبيق لا يمكنه رفع الصور لأن خدمة التخزين غير مفعلة في قاعدة البيانات الخاصة بك. لا يمكن للذكاء الاصطناعي تفعيلها بدلاً عنك، يجب عليك القيام بذلك:</p>
    <ol className="list-decimal list-inside space-y-2 pl-2">
      <li>
        افتح هذا الرابط: 
        <a href="https://console.firebase.google.com/project/gen-lang-client-0342480127/storage" target="_blank" rel="noreferrer" className="text-blue-500 underline mx-1 hover:text-blue-600">إعدادات Storage</a>
      </li>
      <li>اضغط على زر <strong>Get Started (البدء)</strong> ووافق على الخطوات.</li>
      <li>انتقل إلى قسم <strong>Rules (القواعد)</strong>، استبدل الموجود بهذا الكود ثم اضغط <strong>Publish</strong>:
        <pre className="mt-2 text-left bg-black/10 dark:bg-black/30 p-2 rounded text-xs select-all font-mono" dir="ltr">
{`rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}`}
        </pre>
      </li>
    </ol>
  </div>
);

export default function Dashboard() {
  const { user, role } = useAuth();
  const { t } = useI18n();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterParams, setFilterParams] = useState<'all' | 'favorites'>('all');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const [newPatient, setNewPatient] = useState({
    full_name: '',
    phone_number: '',
    address: '',
    date_of_birth: '',
    medical_history: ''
  });
  const [historyFiles, setHistoryFiles] = useState<File[]>([]);

  const fetchPatients = async () => {
    if (!user?.email) return;
    try {
      let q;
      // Admin sees all, doctor sees only theirs
      if (role === 'admin') {
        q = query(collection(db, 'patients'), orderBy('last_visit_date', 'desc'), orderBy('created_at', 'desc'));
      } else {
        q = query(collection(db, 'patients'), where('created_by', '==', user.email));
      }
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as object)
      })) as Patient[];
      
      // Client-side sort fallback since compound index might be missing initially
      docs.sort((a, b) => {
         const dateA = a.last_visit_date || a.created_at || 0;
         const dateB = b.last_visit_date || b.created_at || 0;
         return dateB - dateA; // descending
      });

      setPatients(docs);
    } catch (err) {
      console.error("Error fetching patients", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [user, role]);

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const historyUrls = await processFilesFast(historyFiles, `patients/${user.email}/history`);

      const now = Date.now();
      await addDoc(collection(db, 'patients'), {
        full_name: newPatient.full_name,
        phone_number: newPatient.phone_number,
        address: newPatient.address,
        medical_history: newPatient.medical_history,
        date_of_birth: newPatient.date_of_birth || null,
        is_favorite: false,
        created_at: now,
        last_visit_date: now,
        created_by: user.email,
        history_images: historyUrls
      });
      setIsModalOpen(false);
      setNewPatient({ full_name: '', phone_number: '', address: '', date_of_birth: '', medical_history: '' });
      setHistoryFiles([]);
      fetchPatients();
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes('storage') || err?.message?.includes('Timeout') || err?.code === 'storage/unauthorized') {
         setSubmitError('STORAGE_ERROR');
      } else {
         setSubmitError('حدث خطأ أثناء حفظ البيانات. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, patientId: string, currentFav: boolean) => {
    e.preventDefault(); // Prevent link navigation
    try {
      await updateDoc(doc(db, 'patients', patientId), {
        is_favorite: !currentFav
      });
      setPatients(patients.map(p => p.id === patientId ? { ...p, is_favorite: !currentFav } : p));
    } catch (err) {
      console.error('Error toggling favorite', err);
    }
  };

  const filteredPatients = patients.filter(
    (p) =>
      (filterParams === 'all' || p.is_favorite) &&
      (p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || p.phone_number.includes(searchTerm))
  );

  return (
    <div className="bg-white/35 dark:bg-slate-900/30 backdrop-blur-[15px] border border-white/30 dark:border-white/10 rounded-[24px] p-6 flex flex-col h-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/20 dark:border-white/10">
        <div className="flex items-center gap-4">
          <h1 className="text-[18px] font-semibold text-[#0D47A1] dark:text-blue-100 m-0">{t('patients')}</h1>
          <div className="flex bg-white/50 dark:bg-slate-800/50 rounded-xl p-1 border border-white/40 dark:border-slate-700">
            <button
              onClick={() => setFilterParams('all')}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${filterParams === 'all' ? 'bg-[#1E88E5] text-white shadow-sm' : 'text-[#1565C0] dark:text-blue-200 hover:bg-white/40 dark:hover:bg-slate-700'}`}
            >
              {t('all_patients')}
            </button>
            <button
              onClick={() => setFilterParams('favorites')}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${filterParams === 'favorites' ? 'bg-[#FFD54F] text-[#7F5F00] shadow-sm' : 'text-[#1565C0] dark:text-blue-200 hover:bg-white/40 dark:hover:bg-slate-700'}`}
            >
              {t('favorites')}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1565C0]/60 dark:text-blue-200/50" />
            <input
              type="text"
              placeholder={t('search_patients')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/60 dark:bg-slate-800/40 border border-white/50 dark:border-white/10 text-sm text-[#0D47A1] dark:text-blue-100 placeholder-[#1565C0]/60 dark:placeholder-blue-200/40 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/50 focus:bg-white/80 dark:focus:bg-slate-800/60 transition-all"
            />
          </div>
          <button 
            onClick={() => { setIsModalOpen(true); setSubmitError(null); }} 
            className="text-[#1E88E5] dark:text-blue-400 text-2xl font-bold hover:scale-110 active:scale-95 transition-transform flex items-center justify-center h-8 w-8 rounded-full hover:bg-white/50 dark:hover:bg-white/10"
            title={t('add_patient')}
          >
            +
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E88E5]"></div></div>
      ) : (
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-2">
          {filteredPatients.map((patient) => (
            <Link 
              key={patient.id} 
              to={`/patients/${patient.id}`}
              className="bg-white/60 dark:bg-slate-800/40 p-4 rounded-[18px] border border-white/40 dark:border-white/10 hover:bg-white/90 dark:hover:bg-slate-800/60 hover:border-[#1E88E5] dark:hover:border-blue-400 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-2 group"
            >
              <div className="flex items-center gap-3">
                <button 
                  onClick={(e) => toggleFavorite(e, patient.id, !!patient.is_favorite)}
                  className={`p-1 rounded-full transition-colors ${patient.is_favorite ? 'text-yellow-400 hover:bg-yellow-400/20' : 'text-slate-300 dark:text-slate-600 hover:text-yellow-400 hover:bg-yellow-400/10'}`}
                >
                  <Star className="h-5 w-5" fill={patient.is_favorite ? "currentColor" : "none"} />
                </button>
                <div className="flex flex-col">
                  <span className="font-semibold text-[#1565C0] dark:text-blue-100 block text-base">
                    {patient.full_name}
                  </span>
                  <span className="text-[11px] text-[#64B5F6] dark:text-blue-300/70">
                    Added: {format(patient.created_at, 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm ml-9 md:ml-0 mt-2 md:mt-0">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex items-center gap-1.5 text-[#1565C0]/80 dark:text-blue-200/80 bg-white/40 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-white/30 dark:border-white/5">
                    <Phone className="h-3.5 w-3.5" />
                    <span className="text-[13px]">{patient.phone_number}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#1565C0]/80 dark:text-blue-200/80 bg-white/40 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-white/30 dark:border-white/5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-[13px]">Last Visit: {patient.last_visit_date ? format(patient.last_visit_date, 'MMM d, yyyy') : 'None'}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          {filteredPatients.length === 0 && (
            <div className="py-12 text-center text-[#1565C0]/60 dark:text-blue-200/50 bg-white/40 dark:bg-slate-800/20 rounded-xl border border-dashed border-white/50 dark:border-slate-700">
              {t('no_patients')}
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto w-full h-full">
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6 text-center">
            <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => !isSubmitting && setIsModalOpen(false)}></div>
            <div className="relative transform text-left transition-all w-full max-w-lg bg-white/85 dark:bg-slate-900/90 backdrop-blur-[20px] border border-white/50 dark:border-slate-700/50 rounded-[24px] shadow-2xl flex flex-col my-8 pointer-events-auto max-h-[85vh]">
              <div className="flex justify-between items-center p-6 border-b border-white/30 dark:border-slate-700/50 flex-shrink-0">
                <h2 className="text-lg font-semibold text-[#0D47A1] dark:text-white">{t('add_new_patient')}</h2>
                <button disabled={isSubmitting} onClick={() => { setIsModalOpen(false); setHistoryFiles([]); setNewPatient({ full_name: '', phone_number: '', address: '', date_of_birth: '', medical_history: '' }); setSubmitError(null); }} className="text-[#1565C0]/60 dark:text-slate-400 hover:text-[#1565C0] dark:hover:text-white transition-colors rounded-full hover:bg-white/50 dark:hover:bg-slate-800 p-1">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <form id="add-patient-form" onSubmit={handleAddPatient} className="space-y-4">
                  {submitError && submitError === 'STORAGE_ERROR' ? (
                     <StorageErrorHelp />
                  ) : submitError ? (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-600 dark:text-red-400 p-3 rounded-xl flex items-start gap-2 text-sm font-medium">
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  ) : null}

                  <div>
                    <label className="block text-[13px] font-medium text-[#1565C0] dark:text-blue-200 mb-2 uppercase tracking-wide">{t('full_name')}</label>
                    <input
                      type="text"
                      required
                      value={newPatient.full_name}
                      onChange={(e) => setNewPatient({ ...newPatient, full_name: e.target.value })}
                      className="w-full rounded-xl bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-600 text-[#0D47A1] dark:text-white focus:ring-2 focus:ring-[#1E88E5]/50 focus:bg-white/80 transition-all outline-none py-2.5 px-4"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-medium text-[#1565C0] dark:text-blue-200 mb-2 uppercase tracking-wide">{t('phone_number')}</label>
                      <input
                        type="tel"
                        required
                        value={newPatient.phone_number}
                        onChange={(e) => setNewPatient({ ...newPatient, phone_number: e.target.value })}
                        className="w-full rounded-xl bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-600 text-[#0D47A1] dark:text-white focus:ring-2 focus:ring-[#1E88E5]/50 focus:bg-white/80 transition-all outline-none py-2.5 px-4"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-[#1565C0] dark:text-blue-200 mb-2 uppercase tracking-wide">{t('date_of_birth')}</label>
                      <input
                        type="date"
                        value={newPatient.date_of_birth}
                        onChange={(e) => setNewPatient({ ...newPatient, date_of_birth: e.target.value })}
                        className="w-full rounded-xl bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-600 text-[#0D47A1] dark:text-white focus:ring-2 focus:ring-[#1E88E5]/50 focus:bg-white/80 transition-all outline-none py-2.5 px-4"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#1565C0] dark:text-blue-200 mb-2 uppercase tracking-wide">{t('address')}</label>
                    <input
                      type="text"
                      required
                      value={newPatient.address}
                      onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })}
                      className="w-full rounded-xl bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-600 text-[#0D47A1] dark:text-white focus:ring-2 focus:ring-[#1E88E5]/50 focus:bg-white/80 transition-all outline-none py-2.5 px-4"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#1565C0] dark:text-blue-200 mb-2 uppercase tracking-wide">{t('medical_history_summary')}</label>
                    <textarea
                      required
                      rows={3}
                      value={newPatient.medical_history}
                      onChange={(e) => setNewPatient({ ...newPatient, medical_history: e.target.value })}
                      className="w-full rounded-xl bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-600 text-[#0D47A1] dark:text-white focus:ring-2 focus:ring-[#1E88E5]/50 focus:bg-white/80 transition-all outline-none py-2.5 px-4 resize-none"
                      placeholder="Brief overview of medical history..."
                    ></textarea>
                  </div>
                  
                  <div>
                    <label className="flex items-center gap-2 text-[13px] font-medium text-[#1565C0] dark:text-blue-200 mb-2 uppercase tracking-wide">
                      <FileText className="h-4 w-4" />
                      {t('upload_history_image')}
                    </label>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files) {
                          setHistoryFiles(Array.from(e.target.files));
                        }
                      }}
                      className="block w-full text-sm text-[#0D47A1] dark:text-blue-100 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#1E88E5]/10 file:text-[#1E88E5] hover:file:bg-[#1E88E5]/20 transition-all"
                    />
                    {historyFiles.length > 0 && (
                      <div className="mt-2 text-xs text-[#1565C0]/70 dark:text-blue-300/70">
                        {historyFiles.length} file(s) selected
                      </div>
                    )}
                  </div>
                </form>
              </div>
              
              <div className="p-6 border-t border-white/30 dark:border-slate-700/50 flex-shrink-0 flex justify-end gap-3 bg-white/30 dark:bg-slate-900/30 rounded-b-[24px]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-[#1565C0] dark:text-blue-200 bg-white/50 dark:bg-slate-800/50 border border-white/40 dark:border-slate-600 rounded-xl hover:bg-white/80 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  form="add-patient-form"
                  className="px-5 py-2.5 text-sm font-medium text-white bg-[#1E88E5] border border-transparent rounded-xl hover:bg-[#1565C0] flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50 min-w-[140px]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                       <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                       <span>{t('uploading')}</span>
                    </div>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> {t('save')}
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
