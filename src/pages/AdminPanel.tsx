import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Doctor } from "../types";
import { Shield, UserPlus, Trash2, Mail } from "lucide-react";
import { useAuth } from "../components/AuthProvider";

export default function AdminPanel() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "doctor">("doctor");
  const [error, setError] = useState<string | null>(null);
  const [doctorToRemove, setDoctorToRemove] = useState<string | null>(null);

  const fetchDoctors = async () => {
    try {
      const q = query(collection(db, "doctors"));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map((doc) => ({
        email: doc.id,
        ...(doc.data() as object),
      })) as Doctor[];
      setDoctors(docs);
    } catch (err) {
      console.error(err);
      setError("Failed to load doctors.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    setError(null);
    try {
      const doctorRef = doc(db, "doctors", newEmail.toLowerCase().trim());
      await setDoc(doctorRef, {
        email: newEmail.toLowerCase().trim(),
        role: newRole,
      });
      setNewEmail("");
      setNewRole("doctor");
      fetchDoctors();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to add doctor.");
    }
  };

  const confirmRemove = async (email: string) => {
    try {
      await deleteDoc(doc(db, "doctors", email));
      setDoctorToRemove(null);
      fetchDoctors();
    } catch (err: any) {
      console.error(err);
      setError("Failed to remove doctor.");
      setDoctorToRemove(null);
    }
  };

  const handleRemoveDoctor = async (email: string) => {
    if (email === user?.email) {
      setError("You cannot remove yourself.");
      return;
    }
    setDoctorToRemove(email);
  };

  if (loading)
    return (
      <div className="p-8 text-center text-slate-500">
        Loading admin panel...
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-white/20 dark:border-white/10">
        <Shield className="h-8 w-8 text-[#1E88E5]" />
        <div>
          <h1 className="text-[22px] font-bold text-[#0D47A1] dark:text-blue-100 m-0">
            Admin Panel
          </h1>
          <p className="text-[#1565C0]/80 dark:text-blue-200/80">
            Manage doctor access and permissions
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50/80 dark:bg-red-900/30 text-red-700 dark:text-red-200 rounded-[16px] border border-red-200/50 dark:border-red-900/50 backdrop-blur-sm">
          {error}
        </div>
      )}

      <div className="bg-white/35 dark:bg-slate-900/30 backdrop-blur-[15px] border border-white/30 dark:border-white/10 rounded-[24px] overflow-hidden">
        <div className="p-6 border-b border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-800/30">
          <h2 className="text-[16px] font-semibold text-[#0D47A1] dark:text-blue-100 flex items-center gap-2 m-0">
            <UserPlus className="h-5 w-5 text-[#1E88E5]" />
            Authorize New Doctor
          </h2>
        </div>
        <div className="p-6">
          <form
            onSubmit={handleAddDoctor}
            className="flex flex-col sm:flex-row gap-5"
          >
            <div className="flex-1">
              <label className="block text-[13px] font-medium text-[#1565C0] dark:text-blue-200 mb-2 uppercase tracking-wide">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-[#1565C0]/50 dark:text-blue-200/50" />
                </div>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="pl-11 block w-full rounded-xl bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-600 text-[#0D47A1] dark:text-white focus:ring-2 focus:ring-[#1E88E5]/50 focus:bg-white/80 dark:focus:bg-slate-700 transition-all outline-none py-2.5 px-4"
                  placeholder="doctor@hospital.com"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-[13px] font-medium text-[#1565C0] dark:text-blue-200 mb-2 uppercase tracking-wide">
                Role
              </label>
              <select
                value={newRole}
                onChange={(e) =>
                  setNewRole(e.target.value as "admin" | "doctor")
                }
                className="block w-full rounded-xl bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-600 text-[#0D47A1] dark:text-white focus:ring-2 focus:ring-[#1E88E5]/50 focus:bg-white/80 dark:focus:bg-slate-700 transition-all outline-none py-2.5 px-4"
              >
                <option value="doctor">Doctor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full sm:w-auto bg-[#1E88E5] text-white rounded-xl shadow-sm py-2.5 px-6 font-semibold hover:bg-[#1565C0] focus:ring-2 focus:ring-offset-2 focus:ring-[#1E88E5]/50 transition-colors"
              >
                Authorize
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="bg-white/35 dark:bg-slate-900/30 backdrop-blur-[15px] border border-white/30 dark:border-white/10 rounded-[24px] overflow-hidden">
        <div className="p-6 border-b border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-800/30">
          <h2 className="text-[16px] font-semibold text-[#0D47A1] dark:text-blue-100 m-0">
            Authorized Personnel
          </h2>
        </div>
        <div className="divide-y divide-white/20 dark:divide-white/10">
          {doctors.map((doc) => (
            <div
              key={doc.email}
              className="p-5 flex items-center justify-between hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center font-bold font-sm border ${doc.role === "admin" ? "bg-[#FFD54F]/20 text-[#7F5F00] dark:text-yellow-400 border-[#FFD54F]" : "bg-[#1E88E5] text-white border-transparent"}`}
                >
                  {doc.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[#0D47A1] dark:text-blue-100">
                    {doc.email}
                  </p>
                  <p className="text-[12px] text-[#1565C0] dark:text-blue-300 uppercase tracking-wide font-medium mt-0.5">
                    {doc.role}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRemoveDoctor(doc.email)}
                disabled={doc.email === user?.email}
                className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50/50 dark:hover:bg-red-900/30 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Revoke Access"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
          {doctors.length === 0 && (
            <div className="p-8 text-center text-[#1565C0]/60 dark:text-blue-200/60">
              No authorized doctors found.
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {doctorToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 dark:bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-[20px] border border-white/50 dark:border-slate-700/50 rounded-[24px] shadow-2xl p-6 max-w-sm w-full text-center">
            <h3 className="text-lg font-bold text-[#0D47A1] dark:text-white mb-2">
              Confirm Removal
            </h3>
            <p className="text-[#1565C0]/80 dark:text-blue-200/80 mb-6 text-sm">
              Are you sure you want to revoke access for{" "}
              <span className="font-semibold">{doctorToRemove}</span>?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDoctorToRemove(null)}
                className="px-5 py-2.5 text-sm font-medium text-[#1565C0] dark:text-blue-200 bg-white/50 dark:bg-slate-800/50 border border-white/40 dark:border-slate-600 rounded-xl hover:bg-white/80 dark:hover:bg-slate-700 transition-colors flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmRemove(doctorToRemove)}
                className="px-5 py-2.5 text-sm font-medium text-white bg-red-500 border border-transparent rounded-xl hover:bg-red-600 shadow-sm transition-colors flex-1"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
