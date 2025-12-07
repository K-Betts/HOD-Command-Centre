import React, { useEffect } from 'react';

export function Modal({ isOpen, onClose, children, closeOnBackdropClick = true }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
      onClick={closeOnBackdropClick ? onClose : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-in zoom-in-95 fade-in duration-200"
      >
        {children}
      </div>
    </div>
  );
}

export function SlideOverModal({ isOpen, onClose, children, position = 'right' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const positionClass = position === 'right' ? 'ml-auto' : 'mr-auto';
  const animationClass = position === 'right' 
    ? 'animate-in slide-in-from-right duration-300' 
    : 'animate-in slide-in-from-left duration-300';

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${positionClass} ${animationClass} bg-white h-full overflow-y-auto w-full max-w-2xl`}
      >
        {children}
      </div>
    </div>
  );
}
