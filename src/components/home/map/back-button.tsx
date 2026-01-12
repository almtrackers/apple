
"use client";

import { useRouter } from 'next/navigation';

export default function BackButton() {
  const router = useRouter();

  const handleClick = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/home/dashboard');
    }
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      aria-label="Go back"
      className="p-0 bg-transparent border-0 rounded-full cursor-pointer leading-0 transition-transform duration-100 ease-in-out hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <svg viewBox="0 0 100 100" width="32" height="32" aria-hidden="true">
        <defs>
          <linearGradient id="backBtnGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6efad8" />
            <stop offset="100%" stopColor="#3a64ff" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="43"
          fill="none"
          stroke="url(#backBtnGrad)"
          strokeWidth="10"
        />
        <path
          d="M58 30 L42 50 L58 70"
          fill="none"
          stroke="url(#backBtnGrad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
