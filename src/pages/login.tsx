import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
// **NEW**: Import Eye and EyeOff icons
import { Store, AlertTriangle, Loader2, Eye, EyeOff } from 'lucide-react';

type FormType = 'signIn' | 'signUp';

const getFriendlyErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/user-not-found': return 'No account found with this email.';
    case 'auth/wrong-password': return 'Incorrect password. Please try again.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/email-already-in-use': return 'This email is already registered. Please sign in.';
    case 'auth/weak-password': return 'Password should be at least 6 characters.';
    case 'auth/too-many-requests': return 'Access temporarily disabled. Please try again later.';
    default: return 'An unexpected error occurred. Please try again.';
  }
};

export default function LoginPage() {
  const [formType, setFormType] = useState<FormType>('signIn');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // **NEW**: State for the confirm password field
  const [confirmPassword, setConfirmPassword] = useState('');
  // **NEW**: State to toggle password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp, user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile) {
      navigate('/');
    }
  }, [user, profile, navigate]);

  const handleTabChange = (type: FormType) => {
    setFormType(type);
    // Clear all fields and errors when switching tabs
    setFullName('');
    setEmail('');
    setPassword('');
    setConfirmPassword(''); // Clear new field
    setError('');
    setShowPassword(false); // Reset password visibility
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // **NEW**: Client-side validation for password match on sign up
    if (formType === 'signUp' && password !== confirmPassword) {
      setError("Passwords do not match. Please try again.");
      setLoading(false);
      return; // Stop the submission
    }

    try {
      if (formType === 'signIn') {
        await signIn(email, password);
      } else {
        await signUp(fullName, email, password);
      }
    } catch (err: any) {
      console.error("Firebase Auth Error:", err.code, err.message);
      setError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white shadow-lg border border-gray-200">
        {/* ... Header remains the same ... */}
        <div className="text-center">
            <Store className="mx-auto h-12 w-12 text-blue-600" />
            <h1 className="mt-4 text-3xl font-bold text-gray-900">National Mini Mart</h1>
            <p className="mt-2 text-gray-500">
                {formType === 'signIn' ? 'Sign in to access your dashboard' : 'Create a new employee account'}
            </p>
        </div>

        {/* ... Tab Navigation remains the same ... */}
        <div className="flex border-b">
            <button
                onClick={() => handleTabChange('signIn')}
                className={`flex-1 py-2 text-sm font-medium ${formType === 'signIn' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Sign In
            </button>
            <button
                onClick={() => handleTabChange('signUp')}
                className={`flex-1 py-2 text-sm font-medium ${formType === 'signUp' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Sign Up
            </button>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {formType === 'signUp' && (
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {/* **NEW**: Password Input with View Toggle */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
            </label>
            <div className="relative">
                <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={formType === 'signIn' ? 'current-password' : 'new-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </div>
          </div>
          
          {/* **NEW**: Confirm Password Input with View Toggle (Sign Up only) */}
          {formType === 'signUp' && (
             <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password
                </label>
                <div className="relative">
                    <Input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                    >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>
            </div>
          )}

          {/* Error display is now more robust, showing both server and client errors */}
          {error && (
            <div className="flex items-center gap-3 text-sm text-red-800 bg-red-100 p-3 border border-red-200">
              <AlertTriangle size={18} className="text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <Button type="submit" variant='secondary' className="w-full flex justify-center items-center gap-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                formType === 'signIn' ? 'Sign In' : 'Create Account'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}