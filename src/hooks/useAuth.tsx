import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { auth } from '../../firebase'; // Your initialized Firebase auth instance
import { 
    User, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut as firebaseSignOut 
} from 'firebase/auth';

// Define the shape of the context value
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// Create the context with a default undefined value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define the props for the AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
}

// This is the provider component that will wrap your app
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start as true to check initial auth state

  useEffect(() => {
    // This listener is the core of Firebase Auth in a React app.
    // It automatically handles user session persistence (e.g., after a page refresh).
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // Auth state has been checked, set loading to false
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Sign in function that LoginPage will call
  const signIn = async (email: string, password: string) => {
    // The try/catch is handled in LoginPage, so we can let errors bubble up
    await signInWithEmailAndPassword(auth, email, password);
  };

  // Sign out function for use in other parts of the app (e.g., a navbar)
  const signOut = async () => {
    await firebaseSignOut(auth);
    // The onAuthStateChanged listener will automatically set the user to null
  };

  // The value provided to consuming components
  const value = {
    user,
    loading,
    signIn,
    signOut,
  };
  
  // The loading check prevents rendering protected routes before auth state is known
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// This is the custom hook that components will use to access the context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};