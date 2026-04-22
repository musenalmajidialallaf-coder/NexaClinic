import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { Patient, Visit } from '../types';
import { useAuth } from '../components/AuthProvider';
import { useI18n } from '../components/I18nProvider';
import { ArrowLeft, Plus, Calendar, FileText, Image as ImageIcon, FileAudio, Syringe, Activity, Phone, Home, Edit3, X, Check, AlertCircle, Trash2, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';

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

export default function PatientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'visits'>('visits');
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    phone_number: '',
    address: '',
    medical_history: '',
    date_of_birth: ''
  });
  const [editHistoryFiles, setEditHistoryFiles] = useState<File[]>([]);

  // Custom File State for Visit Form
  const [clinicalFiles, setClinicalFiles] = useState<File[]>([]);
  const [noteFiles, setNoteFiles] = useState<File[]>([]);
  const [labFiles, setLabFiles] = useState<File[]>([]);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);

  const clinicalInputRef = useRef<HTMLInputElement>(null);
  const noteFileInputRef = useRef<HTMLInputElement>(null);
  const labInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const prescriptionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    const fetchPatientData = async () => {
      try {
        const pDoc = await getDoc(doc(db, 'patients', id));
        if (pDoc.exists()) {
          const data = pDoc.data() as Patient;
          setPatient({ id: pDoc.id, ...data });
          setEditForm({
            phone_number: data.phone_number || '',
            address: data.address || '',
            medical_history: data.medical_history || '',
            date_of_birth: data.date_of_birth || ''
          });
        }

        const vQ = query(collection(db, `patients/${id}/visits`), orderBy('visit_date', 'desc'));
        const vSnap = await getDocs(vQ);
        const vDocs = vSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) })) as Visit[];
        setVisits(vDocs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPatientData();
  }, [id]);

  const handleSaveEdit = async () => {
    if (!id || !patient || !user?.email) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      let history_images = patient.history_images || [];
      if (editHistoryFiles.length > 0) {
         const newUrls = await processFilesFast(editHistoryFiles, `patients/${user.email}/history/${id}`);
         history_images = [...history_images, ...newUrls];
      }

      await updateDoc(doc(db, 'patients', id), {
        phone_number: editForm.phone_number,
        address: editForm.address,
        medical_history: editForm.medical_history,
        date_of_birth: editForm.date_of_birth || null,
        history_images
      });
      setPatient({ ...patient, ...editForm, history_images });
      setEditHistoryFiles([]);
      setIsEditing(false);
    } catch(err: any) {
       console.error(err);
       if (err?.message?.includes('storage') || err?.message?.includes('Timeout') || err?.code === 'storage/unauthorized') {
          alert('خطأ: يجب تفعيل مساحة تخزين الصور يدوياً (Storage) من إعدادات فايربيس.');
       } else {
          alert('Failed to update patient data');
       }
    } finally {
       setIsSubmitting(false);
    }
  };

  const calculateAge = (dob?: string) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const clearVisitForm = () => {
    setClinicalFiles([]);
    setLabFiles([]);
    setAudioFiles([]);
    setNoteFiles([]);
    setPrescriptionFile(null);
    setSubmitError(null);
  };

  const age = calculateAge(patient?.date_of_birth);

  const handleDeleteVisit = async (visitId: string) => {
    if (!id || !window.confirm('هل أنت متأكد من حذف هذا السجل الطبي؟ لا يمكن استعادة السجل بعد حذفه.')) return;
    try {
      const visitRef = doc(db, 'patients', id, 'visits', visitId);
      await deleteDoc(visitRef);
      setVisits((prevVisits) => prevVisits.filter((v) => v.id !== visitId));
    } catch (err) {
      console.error('Error deleting visit:', err);
      alert('فشل في حذف السجل. يرجى التأكد من صلاحيات النظام.');
    }
  };

  const handleDeletePatient = async () => {
    if (!id || !patient || !window.confirm(`هل أنت متأكد من حذف المريض (${patient.full_name}) تماماً؟ سيتم حذف كافة السجلات والزيارات التابعة له ولا يمكن التراجع.`)) return;
    try {
      await deleteDoc(doc(db, 'patients', id));
      navigate('/');
    } catch (err) {
      console.error(err);
      alert('فشل في حذف المريض. تأكد من الصلاحيات.');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E88E5]"></div></div>;
  if (!patient) return <div className="text-center py-20 text-slate-500">Patient not found.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 text-sm text-[#1565C0] hover:text-[#0D47A1] dark:text-blue-300 dark:hover:text-blue-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> {t('back_to_patients')}
      </button>

      <div className="bg-white/35 dark:bg-slate-900/30 backdrop-blur-[15px] border border-white/30 dark:border-white/10 rounded-[24px] overflow-hidden shadow-sm relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/20 dark:border-white/10 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="h-[48px] w-[48px] bg-white/60 dark:bg-white/10 border border-white/40 dark:border-white/5 text-[#1565C0] dark:text-blue-300 rounded-full flex items-center justify-center text-xl font-bold shadow-sm">
              {patient.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-[#0D47A1] dark:text-blue-100 leading-none mb-1.5">{patient.full_name}</h1>
              <div className="text-[12px] text-[#1565C0] dark:text-blue-300/80 flex items-center gap-3">
                <span>{t('id')}: #{patient.id.slice(0, 8)}</span>
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 opacity-70" /> {format(patient.created_at, 'MMM d, yyyy')}</span>
                {age !== null && <span className="font-semibold bg-white/40 dark:bg-white/10 px-2 py-0.5 rounded-full">{age} {t('years_old')}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => { setIsVisitModalOpen(true); setSubmitError(null); }}
              className="bg-[#1E88E5] text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm hover:scale-105 active:scale-95 transition-transform flex items-center gap-2 text-sm whitespace-nowrap"
            >
              <Plus className="h-4 w-4" /> {t('add_visit')}
            </button>
            <button 
              type="button"
              onClick={handleDeletePatient}
              className="p-3 text-red-500 hover:text-white hover:bg-red-500 bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 rounded-xl transition-all hover:scale-110 active:scale-95 shadow-md"
              title="حذف المريض نهائياً"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-2 pb-0 gap-6 border-b border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-800/30 overflow-x-auto">
          <button 
            type="button"
            onClick={() => { setActiveTab('info'); setIsEditing(false); }}
            className={`pb-3 pt-2 text-[14px] transition-colors border-b-2 uppercase tracking-wide whitespace-nowrap ${activeTab === 'info' ? 'border-[#1E88E5] text-[#0D47A1] dark:text-blue-100 font-bold' : 'border-transparent text-[#1565C0]/60 dark:text-blue-200/60 hover:text-[#1565C0] dark:hover:text-blue-200 font-medium'}`}
          >
            {t('info')}
          </button>
          <button 
            type="button"
            onClick={() => { setActiveTab('history'); setIsEditing(false); }}
            className={`pb-3 pt-2 text-[14px] transition-colors border-b-2 uppercase tracking-wide whitespace-nowrap ${activeTab === 'history' ? 'border-[#1E88E5] text-[#0D47A1] dark:text-blue-100 font-bold' : 'border-transparent text-[#1565C0]/60 dark:text-blue-200/60 hover:text-[#1565C0] dark:hover:text-blue-200 font-medium'}`}
          >
            {t('history')}
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('visits')}
            className={`pb-3 pt-2 text-[14px] transition-colors border-b-2 uppercase tracking-wide flex items-center gap-2 whitespace-nowrap ${activeTab === 'visits' ? 'border-[#1E88E5] text-[#0D47A1] dark:text-blue-100 font-bold' : 'border-transparent text-[#1565C0]/60 dark:text-blue-200/60 hover:text-[#1565C0] dark:hover:text-blue-200 font-medium'}`}
          >
            {t('visits')} <span className="bg-white/50 dark:bg-white/10 text-[#1565C0] dark:text-blue-200 px-2 py-0.5 rounded-full text-[10px] border border-white/30 dark:border-white/5">{visits.length}</span>
          </button>
        </div>
      </div>

      <div className="mt-6">
        {activeTab === 'info' && (
          <div className="bg-white/35 dark:bg-slate-900/30 backdrop-blur-[15px] border border-white/30 dark:border-white/10 rounded-[24px] p-6 space-y-4 relative z-0">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[16px] font-bold text-[#0D47A1] dark:text-blue-100 flex items-center gap-2">
                <Activity className="h-5 w-5 text-[#1E88E5]" /> {t('patient_information')}
              </h3>
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="text-[#1E88E5] dark:text-blue-400 text-sm font-semibold flex items-center gap-1 hover:underline">
                  <Edit3 className="h-4 w-4" /> {t('edit')}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => { setIsEditing(false); setEditHistoryFiles([]); }} className="text-[#1565C0] dark:text-blue-200 text-sm font-medium hover:underline">{t('cancel')}</button>
                  <button onClick={handleSaveEdit} disabled={isSubmitting} className="bg-[#1E88E5] text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 hover:bg-[#1565C0] disabled:opacity-50">
                    {isSubmitting ? '...' : <><Check className="h-4 w-4" /> {t('save')}</>}
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[14px]">
              <div className="space-y-1">
                <span className="text-[#1565C0]/80 dark:text-blue-200/80 flex items-center gap-2 uppercase tracking-wide text-[11px] font-semibold"><Phone className="h-3.5 w-3.5" /> {t('phone_number')}</span>
                {isEditing ? (
                   <input type="text" value={editForm.phone_number} onChange={e => setEditForm({...editForm, phone_number: e.target.value})} className="w-full rounded-lg bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-600 outline-none px-3 py-2 text-[#0D47A1] dark:text-white" />
                ) : (
                   <p className="font-medium text-[#0D47A1] dark:text-blue-100 text-[15px]">{patient.phone_number}</p>
                )}
              </div>
              <div className="space-y-1">
                <span className="text-[#1565C0]/80 dark:text-blue-200/80 flex items-center gap-2 uppercase tracking-wide text-[11px] font-semibold"><Calendar className="h-3.5 w-3.5" /> {t('date_of_birth')}</span>
                {isEditing ? (
                   <input type="date" value={editForm.date_of_birth} onChange={e => setEditForm({...editForm, date_of_birth: e.target.value})} className="w-full rounded-lg bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-600 outline-none px-3 py-2 text-[#0D47A1] dark:text-white" />
                ) : (
                   <p className="font-medium text-[#0D47A1] dark:text-blue-100 text-[15px]">{patient.date_of_birth ? format(new Date(patient.date_of_birth), 'MMM d, yyyy') : t('none')}</p>
                )}
              </div>
              <div className="space-y-1 md:col-span-2">
                <span className="text-[#1565C0]/80 dark:text-blue-200/80 flex items-center gap-2 uppercase tracking-wide text-[11px] font-semibold"><Home className="h-3.5 w-3.5" /> {t('home_address')}</span>
                {isEditing ? (
                   <input type="text" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} className="w-full rounded-lg bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-600 outline-none px-3 py-2 text-[#0D47A1] dark:text-white" />
                ) : (
                   <p className="font-medium text-[#0D47A1] dark:text-blue-100 text-[15px]">{patient.address}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white/35 dark:bg-slate-900/30 backdrop-blur-[15px] border border-white/30 dark:border-white/10 rounded-[24px] p-6 relative z-0">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[16px] font-bold text-[#0D47A1] dark:text-blue-100 flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#1E88E5]" /> {t('comprehensive_history')}
              </h3>
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="text-[#1E88E5] dark:text-blue-400 text-sm font-semibold flex items-center gap-1 hover:underline">
                  <Edit3 className="h-4 w-4" /> {t('edit')}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => { setIsEditing(false); setEditHistoryFiles([]); }} className="text-[#1565C0] dark:text-blue-200 text-sm font-medium hover:underline">{t('cancel')}</button>
                  <button onClick={handleSaveEdit} disabled={isSubmitting} className="bg-[#1E88E5] text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 hover:bg-[#1565C0] disabled:opacity-50">
                    {isSubmitting ? '...' : <><Check className="h-4 w-4" /> {t('save')}</>}
                  </button>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
               {isEditing ? (
                  <div>
                    <textarea rows={6} value={editForm.medical_history} onChange={e => setEditForm({...editForm, medical_history: e.target.value})} className="w-full rounded-xl bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-600 outline-none px-4 py-3 text-[#0D47A1] dark:text-white resize-none" />
                    
                    <div className="mt-4">
                      <label className="flex items-center gap-2 text-[13px] font-medium text-[#1565C0] dark:text-blue-200 mb-2 uppercase tracking-wide">
                        <ImageIcon className="h-4 w-4" />
                        {t('upload_history_image')}
                      </label>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files) {
                            setEditHistoryFiles(Array.from(e.target.files));
                          }
                        }}
                        className="block w-full text-sm text-[#0D47A1] dark:text-blue-100 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#1E88E5]/10 file:text-[#1E88E5] hover:file:bg-[#1E88E5]/20 transition-all"
                      />
                      {editHistoryFiles.length > 0 && (
                        <div className="mt-2 text-xs text-[#1565C0]/70 dark:text-blue-300/70">
                          {editHistoryFiles.length} file(s) selected
                        </div>
                      )}
                    </div>
                  </div>
               ) : (
                  <div>
                    <p className="text-[#0D47A1]/80 dark:text-blue-100/80 leading-relaxed whitespace-pre-wrap text-[14px] p-4 bg-white/40 dark:bg-slate-800/40 rounded-[16px] border border-white/30 dark:border-white/5">{patient.medical_history || t('no_history')}</p>
                    {patient.history_images && patient.history_images.length > 0 && (
                       <div className="mt-4">
                         <h5 className="text-[12px] font-bold text-[#1565C0] dark:text-blue-300 uppercase mb-3 tracking-widest pl-1">Medical History Documents</h5>
                         <div className="flex gap-3 flex-wrap">
                           {patient.history_images.map((img, i) => (
                             <a key={i} href={img} target="_blank" rel="noreferrer" className="block relative">
                               <img src={img} alt="History Doc" className="h-[120px] w-auto max-w-full object-contain rounded-[16px] border-[2px] border-white/60 dark:border-slate-700 shadow-sm bg-white/50 dark:bg-slate-800 hover:opacity-80 transition-opacity" />
                             </a>
                           ))}
                         </div>
                       </div>
                    )}
                  </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'visits' && (
          <div className="space-y-4">
            {visits.map(visit => (
              <div key={visit.id} className="bg-white/60 dark:bg-slate-800/40 rounded-[24px] p-6 shadow-sm border border-white/40 dark:border-white/10 hover:bg-white/80 dark:hover:bg-slate-800/60 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-[42px] w-[42px] bg-[#1E88E5]/10 rounded-xl flex items-center justify-center text-[#1E88E5] dark:text-blue-300 border border-[#1E88E5]/20 dark:border-blue-400/20">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[16px] text-[#0D47A1] dark:text-blue-100">{format(visit.visit_date, 'MMMM d, yyyy')}</h4>
                      <div className="text-[12px] text-[#1565C0] dark:text-blue-300 font-medium">Dr. {visit.created_by.split('@')[0]}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                       <div className="text-[10px] font-bold bg-[#E3F2FD] dark:bg-blue-900/40 text-[#1976D2] dark:text-blue-300 px-3 py-1 rounded-full uppercase tracking-widest border border-[#BBDEFB] dark:border-blue-800 inline-block">
                         {visit.diagnosis}
                       </div>
                       <button 
                         type="button"
                         onClick={() => handleDeleteVisit(visit.id)}
                         className="p-2 text-red-500 hover:text-white hover:bg-red-500 bg-red-500/5 dark:bg-red-500/10 border border-red-500/10 rounded-xl transition-all hover:scale-110 active:scale-95"
                         title="حذف الزيارة"
                       >
                         <Trash2 className="h-4 w-4" />
                       </button>
                    </div>
                    {visit.next_followup_date && (
                       <div className="text-[11px] font-medium text-orange-600 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-md border border-orange-200 dark:border-orange-800/50 whitespace-nowrap">
                         Follow-up: {format(new Date(visit.next_followup_date), 'MMM d, yyyy')}
                       </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 text-[#0D47A1]/80 dark:text-blue-100/80 text-[14px] leading-relaxed mb-4 p-4 bg-white/40 dark:bg-slate-900/40 rounded-[16px] border border-white/30 dark:border-white/5 space-y-4">
                  <div>
                    <h5 className="text-[11px] font-bold text-[#1565C0]/60 dark:text-blue-300/60 uppercase mb-2 flex items-center gap-1"><FileText className="h-3 w-3"/> Notes</h5>
                    <p className="whitespace-pre-wrap">{visit.notes}</p>
                  </div>
                  
                  {visit.actions && (
                    <div className="pt-3 border-t border-white/20 dark:border-white/5">
                      <h5 className="text-[11px] font-bold text-[#1565C0]/60 dark:text-blue-300/60 uppercase mb-2 flex items-center gap-1"><ClipboardList className="h-3 w-3"/> Procedures & Actions</h5>
                      <p className="text-[#1E88E5] dark:text-blue-300 font-medium whitespace-pre-wrap">{visit.actions}</p>
                    </div>
                  )}
                  
                  {visit.note_images && visit.note_images.length > 0 && (
                     <div className="flex flex-wrap gap-3 pt-3 border-t border-white/30 dark:border-slate-700/50">
                       {visit.note_images.map((imgUrl, i) => (
                          <a key={i} href={imgUrl} target="_blank" rel="noreferrer" className="block relative">
                            <img src={imgUrl} alt="Note Attachment" className="h-[80px] w-auto max-w-full object-cover rounded-xl border border-white/60 dark:border-slate-600 shadow-sm hover:opacity-80 transition-opacity" />
                          </a>
                       ))}
                     </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 pt-4 border-t border-white/20 dark:border-white/10 mb-4">
                  {visit.clinical_images?.length > 0 && (
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-[#1565C0] dark:text-blue-200 bg-white/40 dark:bg-slate-800/40 py-1.5 px-3 rounded-[12px] border border-white/40 dark:border-white/5 shadow-sm">
                      <ImageIcon className="h-3.5 w-3.5 text-[#1E88E5] dark:text-blue-400" /> {visit.clinical_images.length} Clinical Images
                    </div>
                  )}
                  {visit.lab_images?.length > 0 && (
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-[#1565C0] dark:text-blue-200 bg-white/40 dark:bg-slate-800/40 py-1.5 px-3 rounded-[12px] border border-white/40 dark:border-white/5 shadow-sm">
                      <Activity className="h-3.5 w-3.5 text-orange-400" /> {visit.lab_images.length} Lab Results
                    </div>
                  )}
                  {visit.audio_records?.length > 0 && (
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-[#1565C0] dark:text-blue-200 bg-white/40 dark:bg-slate-800/40 py-1.5 px-3 rounded-[12px] border border-white/40 dark:border-white/5 shadow-sm">
                      <FileAudio className="h-3.5 w-3.5 text-purple-400" /> {visit.audio_records.length} Audio Notes
                    </div>
                  )}
                  {visit.prescription_image && (
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-[#1565C0] dark:text-blue-200 bg-white/40 dark:bg-slate-800/40 py-1.5 px-3 rounded-[12px] border border-white/40 dark:border-white/5 shadow-sm">
                      <Syringe className="h-3.5 w-3.5 text-green-400" /> Prescription Included
                    </div>
                  )}
                </div>

                {/* Media Preview Section */}
                {(visit.clinical_images?.length > 0 || visit.lab_images?.length > 0 || visit.prescription_image || visit.audio_records?.length > 0) && (
                  <div className="bg-white/40 dark:bg-slate-900/30 rounded-[24px] p-5 border border-white/30 dark:border-white/5 space-y-5">
                    {visit.clinical_images?.length > 0 && (
                      <div>
                        <h5 className="text-[11px] font-bold text-[#1565C0]/80 dark:text-blue-300/80 uppercase mb-3 tracking-widest pl-1">Clinical Images</h5>
                        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                          {visit.clinical_images.map((img, i) => (
                             <a key={i} href={img} target="_blank" rel="noreferrer" className="block relative flex-shrink-0">
                               <img src={img} alt="Clinical" className="h-[90px] w-[90px] object-cover rounded-[16px] border-[2px] border-white/60 dark:border-slate-700 shadow-sm" />
                             </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {visit.lab_images?.length > 0 && (
                      <div>
                        <h5 className="text-[11px] font-bold text-[#1565C0]/80 dark:text-blue-300/80 uppercase mb-3 tracking-widest pl-1">Lab Scans</h5>
                        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                          {visit.lab_images.map((img, i) => (
                             <a key={i} href={img} target="_blank" rel="noreferrer" className="block relative flex-shrink-0">
                               <img src={img} alt="Lab" className="h-[90px] w-[90px] object-cover rounded-[16px] border-[2px] border-white/60 dark:border-slate-700 shadow-sm" />
                             </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {visit.prescription_image && (
                      <div>
                        <h5 className="text-[11px] font-bold text-[#1565C0]/80 dark:text-blue-300/80 uppercase mb-3 tracking-widest pl-1">Prescription</h5>
                        <a href={visit.prescription_image} target="_blank" rel="noreferrer" className="block relative">
                          <img src={visit.prescription_image} alt="Prescription" className="h-[120px] w-auto max-w-full object-contain rounded-[16px] border-[2px] border-white/60 dark:border-slate-700 shadow-sm bg-white/50 dark:bg-slate-800 block" />
                        </a>
                      </div>
                    )}
                    {visit.audio_records?.length > 0 && (
                      <div>
                        <h5 className="text-[11px] font-bold text-[#1565C0]/80 dark:text-blue-300/80 uppercase mb-3 tracking-widest pl-1">Audio Notes</h5>
                        <div className="space-y-3">
                          {visit.audio_records.map((audio, i) => (
                             <audio key={i} src={audio} controls className="block w-full max-w-sm h-10 rounded-full" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {visits.length === 0 && (
              <div className="py-12 px-6 text-center bg-white/35 dark:bg-slate-900/30 backdrop-blur-[15px] border border-white/30 dark:border-white/10 rounded-[24px]">
                <div className="h-16 w-16 bg-white/60 dark:bg-white/10 border border-white/40 dark:border-white/5 rounded-[20px] shadow-sm flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-[#1565C0]/50 dark:text-blue-300/50" />
                </div>
                <h3 className="text-[18px] font-bold text-[#0D47A1] dark:text-blue-100 mb-1">{t('no_visits_yet')}</h3>
                <p className="text-[14px] text-[#1565C0]/70 dark:text-blue-200/70 mb-6">{t('create_first_visit')}</p>
                <button 
                  onClick={() => setIsVisitModalOpen(true)}
                  className="bg-[#1E88E5] text-white px-6 py-3 rounded-xl font-semibold shadow-sm hover:scale-105 active:scale-95 transition-transform inline-flex items-center gap-2 text-sm"
                >
                  <Plus className="h-4 w-4" /> {t('add_visit')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {isVisitModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto w-full h-full">
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6 text-center">
            <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => !isSubmitting && setIsVisitModalOpen(false)}></div>
            <div className="relative transform text-left transition-all w-full max-w-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-[20px] border border-white/50 dark:border-slate-700/50 rounded-[24px] shadow-2xl flex flex-col my-8 pointer-events-auto max-h-[85vh]">
              <div className="flex justify-between items-center p-6 border-b border-white/30 dark:border-slate-700/50 flex-shrink-0">
                <h2 className="text-lg font-semibold text-[#0D47A1] dark:text-white">{t('add_new_visit')}</h2>
                <button disabled={isSubmitting} onClick={() => { setIsVisitModalOpen(false); clearVisitForm(); }} className="text-[#1565C0]/60 dark:text-slate-400 hover:text-[#1565C0] dark:hover:text-white transition-colors rounded-full hover:bg-white/50 dark:hover:bg-slate-800 p-1">
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <form id="add-visit-form" onSubmit={async (e) => {
                  e.preventDefault();
                  if (!user?.email || !id) return;
                  setIsSubmitting(true);
                  setSubmitError(null);
                  
                  const formData = new FormData(e.currentTarget);
                  const diagnosis = formData.get('diagnosis') as string;
                  const notes = formData.get('notes') as string;
                  const actions = formData.get('actions') as string;
                  const next_followup_date = formData.get('next_followup_date') as string;

                  try {
                    // Execute uploads in parallel efficiently
                    const [
                      clinical_images, 
                      lab_images, 
                      audio_records, 
                      prescriptionArr,
                      note_images
                    ] = await Promise.all([
                      processFilesFast(clinicalFiles, `patients/${id}/visits/clinical`),
                      processFilesFast(labFiles, `patients/${id}/visits/lab`),
                      processFilesFast(audioFiles, `patients/${id}/visits/audio`),
                      prescriptionFile ? processFilesFast([prescriptionFile], `patients/${id}/visits/prescription`) : Promise.resolve([]),
                      processFilesFast(noteFiles, `patients/${id}/visits/notes`)
                    ]);
                    
                    const now = Date.now();
                    await addDoc(collection(db, `patients/${id}/visits`), {
                      visit_date: now,
                      diagnosis,
                      notes,
                      actions,
                      clinical_images,
                      lab_images,
                      audio_records,
                      note_images,
                      prescription_image: prescriptionArr.length > 0 ? prescriptionArr[0] : null,
                      next_followup_date: next_followup_date || null,
                      created_by: user.email
                    });

                    await updateDoc(doc(db, 'patients', id), {
                       last_visit_date: now
                    });

                    // Refetch visits
                    const vQ = query(collection(db, `patients/${id}/visits`), orderBy('visit_date', 'desc'));
                    const vSnap = await getDocs(vQ);
                    setVisits(vSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) })) as Visit[]);
                    
                    setIsVisitModalOpen(false);
                    clearVisitForm();
                  } catch (err: any) {
                    console.error(err);
                    if (err?.message?.includes('storage') || err?.message?.includes('Timeout') || err?.code === 'storage/unauthorized') {
                       setSubmitError('STORAGE_ERROR');
                    } else {
                       setSubmitError('حدث خطأ أثناء حفظ الزيارة. يرجى المحاولة مرة أخرى.');
                    }
                  } finally {
                    setIsSubmitting(false);
                  }
                }} className="space-y-6">
                   
                   {submitError && submitError === 'STORAGE_ERROR' ? (
                      <StorageErrorHelp />
                   ) : submitError ? (
                      <div className="bg-red-500/10 border border-red-500/50 text-red-600 dark:text-red-400 p-3 rounded-xl flex items-start gap-2 text-sm font-medium">
                        <AlertCircle className="h-5 w-5 flex-shrink-0" />
                        <span>{submitError}</span>
                      </div>
                    ) : null}

                   <div>
                     <label className="block text-[13px] font-medium text-[#1565C0] dark:text-blue-200 mb-2 uppercase tracking-wide">{t('diagnosis_reason')}</label>
                     <input type="text" name="diagnosis" required placeholder="E.g., Routine checkup, Hypertension" className="w-full rounded-xl bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-600 text-[#0D47A1] dark:text-white focus:ring-2 focus:ring-[#1E88E5]/50 focus:bg-white/80 dark:focus:bg-slate-700 transition-all outline-none py-2.5 px-4" />
                   </div>

                   <div>
                     <label className="block text-[13px] font-medium text-[#1565C0] dark:text-blue-200 mb-2 uppercase tracking-wide">{t('clinical_notes')}</label>
                     <textarea name="notes" required rows={3} placeholder="Detailed doctor notes..." className="w-full rounded-xl bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-600 text-[#0D47A1] dark:text-white focus:ring-2 focus:ring-[#1E88E5]/50 focus:bg-white/80 dark:focus:bg-slate-700 transition-all outline-none py-2.5 px-4 resize-none"></textarea>
                   </div>

                   <div>
                     <label className="block text-[13px] font-medium text-[#1E88E5] dark:text-blue-300 mb-2 uppercase tracking-wide">Medical Actions & Procedures</label>
                     <textarea name="actions" rows={2} placeholder="Treatments, procedures, or specific actions taken..." className="w-full rounded-xl bg-blue-50/50 dark:bg-slate-800/80 border border-[#1E88E5]/30 dark:border-slate-600 text-[#0D47A1] dark:text-white focus:ring-2 focus:ring-[#1E88E5]/50 focus:bg-white/80 dark:focus:bg-slate-700 transition-all outline-none py-2.5 px-4 resize-none"></textarea>
                     
                     <div className="mt-3">
                        <label className="flex items-center gap-2 text-[12px] font-semibold text-[#1565C0] dark:text-blue-200 mb-1.5 uppercase tracking-wide cursor-pointer">
                          <ImageIcon className="h-4 w-4" />
                          {t('upload_note_image')}
                        </label>
                        <div className="flex flex-wrap gap-2">
                           {noteFiles.map((file, idx) => (
                             <div key={idx} className="relative h-14 w-14 group">
                               <img src={URL.createObjectURL(file)} className="h-full w-full object-cover rounded-xl border border-white/50 dark:border-slate-600 shadow-sm" />
                               <button type="button" onClick={() => setNoteFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-red-500 text-white shadow-md rounded-full p-0.5 border border-white/20 transition-all z-10 hover:bg-red-600 hover:scale-110"><X className="h-3.5 w-3.5"/></button>
                             </div>
                           ))}
                           <button type="button" onClick={() => noteFileInputRef.current?.click()} className="h-14 w-14 rounded-xl border-2 border-dashed border-[#1E88E5]/50 dark:border-blue-400/50 flex items-center justify-center text-[#1E88E5] dark:text-blue-400 hover:bg-white/50 dark:hover:bg-slate-800 transition-colors">
                             <Plus className="h-5 w-5" />
                           </button>
                           <input type="file" multiple accept="image/*" className="hidden" ref={noteFileInputRef} onChange={(e) => { if(e.target.files) setNoteFiles([...noteFiles, ...Array.from(e.target.files)]) }} />
                        </div>
                     </div>
                   </div>

                   <div>
                     <label className="block text-[13px] font-medium text-[#1565C0] dark:text-blue-200 mb-2 uppercase tracking-wide text-orange-600 dark:text-orange-400"><Calendar className="inline h-4 w-4 mr-1 pb-0.5" />{t('next_followup_date')}</label>
                     <input type="date" name="next_followup_date" className="w-full sm:w-auto min-w-[200px] rounded-xl bg-white/60 dark:bg-slate-800/50 border border-orange-200 dark:border-orange-900/50 text-[#0D47A1] dark:text-white focus:ring-2 focus:ring-orange-400/50 focus:bg-white/80 dark:focus:bg-slate-700 transition-all outline-none py-2.5 px-4" />
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/20 dark:border-slate-700/50">
                     {/* Custom File Uploaders */}
                     <div>
                       <label className="block text-[12px] font-semibold text-[#1565C0] dark:text-blue-200 mb-1.5 uppercase tracking-wide">{t('diagnostic_images')}</label>
                       <div className="flex flex-wrap gap-2">
                         {clinicalFiles.map((file, idx) => (
                           <div key={idx} className="relative h-16 w-16 group">
                             <img src={URL.createObjectURL(file)} className="h-full w-full object-cover rounded-xl border border-white/50 dark:border-slate-600 shadow-sm" />
                             <button type="button" onClick={() => setClinicalFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-red-500 text-white shadow-md rounded-full p-0.5 border border-white/20 transition-all z-10 hover:bg-red-600 hover:scale-110"><X className="h-3.5 w-3.5"/></button>
                           </div>
                         ))}
                         <button type="button" onClick={() => clinicalInputRef.current?.click()} className="h-16 w-16 rounded-xl border-2 border-dashed border-white/60 dark:border-slate-600 flex items-center justify-center text-[#1E88E5] dark:text-blue-400 hover:bg-white/50 dark:hover:bg-slate-800 transition-colors">
                           <Plus className="h-6 w-6" />
                         </button>
                         <input type="file" multiple accept="image/*" className="hidden" ref={clinicalInputRef} onChange={(e) => { if(e.target.files) setClinicalFiles([...clinicalFiles, ...Array.from(e.target.files)]) }} />
                       </div>
                     </div>

                     <div>
                       <label className="block text-[12px] font-semibold text-[#1565C0] dark:text-blue-200 mb-1.5 uppercase tracking-wide">{t('lab_results')}</label>
                       <div className="flex flex-wrap gap-2">
                         {labFiles.map((file, idx) => (
                           <div key={idx} className="relative h-16 w-16 group">
                             <img src={URL.createObjectURL(file)} className="h-full w-full object-cover rounded-xl border border-white/50 dark:border-slate-600 shadow-sm" />
                             <button type="button" onClick={() => setLabFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-red-500 text-white shadow-md rounded-full p-0.5 border border-white/20 transition-all z-10 hover:bg-red-600 hover:scale-110"><X className="h-3.5 w-3.5"/></button>
                           </div>
                         ))}
                         <button type="button" onClick={() => labInputRef.current?.click()} className="h-16 w-16 rounded-xl border-2 border-dashed border-white/60 dark:border-slate-600 flex items-center justify-center text-[#1E88E5] dark:text-blue-400 hover:bg-white/50 dark:hover:bg-slate-800 transition-colors">
                           <Plus className="h-6 w-6" />
                         </button>
                         <input type="file" multiple accept="image/*" className="hidden" ref={labInputRef} onChange={(e) => { if(e.target.files) setLabFiles([...labFiles, ...Array.from(e.target.files)]) }} />
                       </div>
                     </div>
                     
                     <div>
                       <label className="block text-[12px] font-semibold text-[#1565C0] dark:text-blue-200 mb-1.5 uppercase tracking-wide">{t('audio_recordings')}</label>
                       <div className="flex flex-wrap gap-2">
                         {audioFiles.map((file, idx) => (
                           <div key={idx} className="relative bg-white/60 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-white/50 dark:border-slate-600 flex items-center gap-2 group pr-8">
                             <FileAudio className="h-4 w-4 text-purple-500" />
                             <span className="text-xs max-w-[80px] truncate dark:text-white">{file.name}</span>
                             <button type="button" onClick={() => setAudioFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute right-1 text-red-500 hover:text-red-700 bg-white/80 dark:bg-slate-700 shadow-sm rounded-full p-0.5 border border-red-500/20"><X className="h-3 w-3"/></button>
                           </div>
                         ))}
                         <button type="button" onClick={() => audioInputRef.current?.click()} className="h-8 px-3 rounded-lg border border-dashed border-white/60 dark:border-slate-600 flex items-center justify-center text-[#1E88E5] dark:text-blue-400 hover:bg-white/50 dark:hover:bg-slate-800 transition-colors text-xs font-semibold gap-1">
                           <Plus className="h-3 w-3" /> Add Audio
                         </button>
                         <input type="file" multiple accept="audio/*" className="hidden" ref={audioInputRef} onChange={(e) => { if(e.target.files) setAudioFiles([...audioFiles, ...Array.from(e.target.files)]) }} />
                       </div>
                     </div>

                     <div>
                       <label className="block text-[12px] font-semibold text-[#1565C0] dark:text-blue-200 mb-1.5 uppercase tracking-wide">{t('prescription_image')}</label>
                       <div className="flex flex-wrap gap-2">
                         {prescriptionFile ? (
                           <div className="relative h-16 w-16 group">
                             <img src={URL.createObjectURL(prescriptionFile)} className="h-full w-full object-cover rounded-xl border border-white/50 dark:border-slate-600 shadow-sm" />
                             <button type="button" onClick={() => setPrescriptionFile(null)} className="absolute -top-2 -right-2 bg-red-500 text-white shadow-md rounded-full p-0.5 border border-white/20 transition-all z-10 hover:bg-red-600 hover:scale-110"><X className="h-3.5 w-3.5"/></button>
                           </div>
                         ) : (
                           <button type="button" onClick={() => prescriptionInputRef.current?.click()} className="h-16 w-16 rounded-xl border-2 border-dashed border-white/60 dark:border-slate-600 flex items-center justify-center text-[#1E88E5] dark:text-blue-400 hover:bg-white/50 dark:hover:bg-slate-800 transition-colors">
                             <Plus className="h-6 w-6" />
                           </button>
                         )}
                         <input type="file" accept="image/*" className="hidden" ref={prescriptionInputRef} onChange={(e) => { if(e.target.files && e.target.files[0]) setPrescriptionFile(e.target.files[0]) }} />
                       </div>
                     </div>
                   </div>
                </form>
              </div>

              <div className="p-6 border-t border-white/30 dark:border-slate-700/50 flex-shrink-0 flex justify-end gap-3 bg-white/30 dark:bg-slate-900/30 rounded-b-[24px]">
                 <button type="button" onClick={() => { setIsVisitModalOpen(false); clearVisitForm(); }} disabled={isSubmitting} className="px-5 py-2.5 text-sm font-medium text-[#1565C0] dark:text-blue-200 bg-white/50 dark:bg-slate-800/50 border border-white/40 dark:border-slate-600 rounded-xl hover:bg-white/80 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">{t('cancel')}</button>
                 <button type="submit" form="add-visit-form" disabled={isSubmitting} className="px-5 py-2.5 text-sm font-medium text-white bg-[#1E88E5] border border-transparent rounded-xl hover:bg-[#1565C0] shadow-sm transition-colors disabled:opacity-50 min-w-[140px] flex justify-center items-center gap-2">
                    {isSubmitting ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>{t('uploading')}</span>
                      </>
                    ) : (
                      <>
                         <Plus className="h-4 w-4" /> {t('save_visit')}
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
