import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import emailjs from '@emailjs/browser';
import { Send } from 'lucide-react';

interface ContactForm {
  fullName: string;
  phoneNumber: string;
  message: string;
}

export default function Contact() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactForm>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (data: ContactForm) => {
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(false);

      const templateParams = {
        from_name: data.fullName,
        phone_number: data.phoneNumber,
        message: data.message,
        to_email: 'bokobzadir@gmail.com'
      };

      await emailjs.send(
        'service_5w6s044',
        'template_m975h2h',
        templateParams,
        '7Yjbt1QrTbjvLL571'
      );

      setSuccess(true);
      reset();
    } catch (err) {
      setError('אירעה שגיאה בשליחת ההודעה. נסה שוב מאוחר יותר.');
      console.error('Error sending email:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">צור קשר</h1>

      <div className="bg-white rounded-lg shadow-sm max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              שם מלא
            </label>
            <input
              type="text"
              {...register('fullName', { required: 'נא להזין שם מלא' })}
              className="input"
              placeholder="הזן שם מלא"
            />
            {errors.fullName && (
              <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              מספר טלפון
            </label>
            <input
              type="tel"
              {...register('phoneNumber', {
                required: 'נא להזין מספר טלפון',
                pattern: {
                  value: /^05\d{8}$/,
                  message: 'נא להזין מספר טלפון תקין'
                }
              })}
              className="input"
              placeholder="הזן מספר טלפון"
              dir="ltr"
            />
            {errors.phoneNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.phoneNumber.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תוכן ההודעה
            </label>
            <textarea
              {...register('message', { required: 'נא להזין את תוכן ההודעה' })}
              rows={5}
              className="input"
              placeholder="הזן את תוכן ההודעה"
            />
            {errors.message && (
              <p className="mt-1 text-sm text-red-600">{errors.message.message}</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md">
              ההודעה נשלחה בהצלחה!
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary flex items-center"
            >
              <Send className="h-5 w-5 ml-2" />
              {isSubmitting ? 'שולח...' : 'שלח הודעה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}