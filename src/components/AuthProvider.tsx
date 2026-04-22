import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  User,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

interface AuthContextType {
  user: User | null;
  role: "admin" | "doctor" | null;
  loading: boolean;
  isSigningIn: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "doctor" | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (!currentUser.email) {
          setError("Email is required for authentication.");
          await auth.signOut();
          setUser(null);
          setRole(null);
          setLoading(false);
          return;
        }

        try {
          if (currentUser.email === "musen.almajidi.alallaf@gmail.com" || 
              currentUser.email === "muhsen.hm292@student.uomosul.edu.iq") {
            setRole("admin");
            setUser(currentUser);
          } else {
            const docRef = doc(db, "doctors", currentUser.email);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
              setRole(docSnap.data().role as "admin" | "doctor");
              setUser(currentUser);
            } else {
              setError(
                "Your email is not authorized to access this application. Please contact an admin.",
              );
              await auth.signOut();
              setUser(null);
              setRole(null);
            }
          }
        } catch (err) {
          console.error(err);
          setError("Error verifying access.");
          await auth.signOut();
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    if (isSigningIn) return;
    setError(null);
    setIsSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      // Important for custom domains/iframes usually use popup not redirect
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      // Don't show error if user just closed the popup
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return;
      }
      setError(err.message || "Failed to sign in");
      console.error(err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, role, loading, isSigningIn, signIn, logOut, error }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
