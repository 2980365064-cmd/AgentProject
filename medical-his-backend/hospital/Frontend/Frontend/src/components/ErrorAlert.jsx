import React, { useEffect, useState } from "react";

const ErrorAlert = ({ message, onClose }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!message) return;

    setProgress(100);

    const progressTimer = setTimeout(() => {
      setProgress(0);
    }, 50);

    const closeTimer = setTimeout(() => {
      if (onClose) onClose();
    }, 3050);

    return () => {
      clearTimeout(progressTimer);
      clearTimeout(closeTimer);
    };
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col justify-center text-red-600 w-80 bg-red-50 border border-red-200 h-12 shadow-lg rounded-md overflow-hidden animate-slide-in-right">
      
      <div className="flex items-center h-full w-full">
        <div className="h-full w-1.5 bg-red-600 shrink-0"></div>
        
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          className="icon line ml-3 shrink-0"
        >
          <path
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.95"
            d="M11.95 16.5h.1"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M3 12a9 9 0 0 1 9-9h0a9 9 0 0 1 9 9h0a9 9 0 0 1-9 9h0a9 9 0 0 1-9-9m9 0V7"
          />
        </svg>
        
        <p className="text-sm ml-2 font-medium truncate pr-3">{message}</p>
      </div>

      <div
        className="absolute bottom-0 left-0 h-1 bg-red-600"
        style={{ 
            width: `${progress}%`, 
            transition: progress === 100 ? 'none' : 'width 3000ms linear'
        }}
      ></div>
      
    </div>
  );
};

export default ErrorAlert;