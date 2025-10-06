import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

interface LoginForm {
  phone: string;
  password: string;
}

function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (data: LoginForm) => {
    try {
      setError(null);
      setIsLoading(true);

      // Get user from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, phone_number, full_name, role')
        .eq('phone_number', data.phone)
        .eq('password', data.password)
        .maybeSingle();

      if (userError) {
        console.error('Database error:', userError);
        throw new Error('אירעה שגיאה בהתחברות');
      }

      if (!userData) {
        throw new Error('שם משתמש או סיסמה שגויים');
      }

      setUser(userData);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בהתחברות');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <img
            src="https://ppgfqntelptocxijdhya.supabase.co/storage/v1/object/public/logo//logo2.png.png"
            alt="לוגו"
            className="mx-auto h-20 sm:h-24 w-auto"
          />
          <div className="mt-4 space-y-1">
            <h2 className="text-xl font-semibold text-gray-900">
              התחברו לאזור האישי
            </h2>
            <p className="text-sm text-gray-600">
              מלאו את הפרטים כדי להתחבר
            </p>
          </div>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="phone" className="sr-only">
                מספר טלפון
              </label>
              <input
                {...register('phone', { 
                  required: 'נא להזין מספר טלפון',
                  pattern: {
                    value: /^05\d{8}$/,
                    message: 'נא להזין מספר טלפון תקין'
                  }
                })}
                type="tel"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm text-right"
                placeholder="מספר טלפון"
                dir="rtl"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                סיסמה
              </label>
              <input
                {...register('password', { 
                  required: 'נא להזין סיסמה',
                  minLength: {
                    value: 6,
                    message: 'סיסמה חייבת להכיל לפחות 6 תווים'
                  }
                })}
                type="password"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="סיסמה"
              />
            </div>
          </div>

          {(errors.phone || errors.password) && (
            <p className="text-red-500 text-sm text-center">
              {errors.phone?.message || errors.password?.message || 'נא למלא את כל השדות'}
            </p>
          )}

          {error && (
            <p className="text-red-500 text-sm text-center">
              {error}
            </p>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'מתחבר...' : 'כניסה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;