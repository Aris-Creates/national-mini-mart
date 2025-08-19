// src/hooks/useAuth.ts
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { 
    User, 
    onAuthStateChanged, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword, // <-- Import the signup function
    signOut as firebaseSignOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore'; // <-- Import setDoc
import { auth, db } from '../../firebase';

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: 'admin' | 'employee';
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  // **NEW**: Add signUp to the context type
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        } else {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  // **NEW**: The complete signUp function
  const signUp = async (fullName: string, email: string, password: string) => {
    // Step 1: Create the user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;

    // Step 2: Create the user's profile document in Firestore with the default role
    const userDocRef = doc(db, 'users', newUser.uid);
    await setDoc(userDocRef, {
      uid: newUser.uid,
      email: newUser.email,
      fullName: fullName,
      role: 'employee' // <-- Default role is set here!
    });
    // The onAuthStateChanged listener will automatically pick up the new user and profile.
  };

  const signOutUser = async () => {
    await firebaseSignOut(auth);
  };

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp, // <-- Provide the new function
    signOutUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};