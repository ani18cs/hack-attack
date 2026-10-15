import React from 'react';

interface BigButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  ariaDescription?: string;
  variant?: 'primary' | 'danger' | 'warning' | 'neutral';
  icon?: React.ReactNode;
}

export const BigButton: React.FC<BigButtonProps> = ({
  label,
  ariaDescription,
  variant = 'primary',
  icon,
  className = '',
  ...props
}) => {
  const variantStyles = {
    primary: 'bg-yellow-400 text-black hover:bg-yellow-300 border-4 border-yellow-200 active:bg-yellow-500',
    danger: 'bg-red-600 text-white hover:bg-red-500 border-4 border-red-300 active:bg-red-700',
    warning: 'bg-orange-500 text-white hover:bg-orange-400 border-4 border-orange-200 active:bg-orange-600',
    neutral: 'bg-zinc-800 text-white hover:bg-zinc-700 border-4 border-zinc-500 active:bg-zinc-900',
  }[variant];

  return (
    <button
      type="button"
      className={`touch-target flex flex-col items-center justify-center p-6 rounded-3xl font-extrabold text-2xl md:text-3xl tracking-wide shadow-2xl transition-transform active:scale-95 focus:outline-none focus:ring-8 focus:ring-white focus:ring-offset-4 focus:ring-offset-black ${variantStyles} ${className}`}
      aria-label={label}
      aria-description={ariaDescription}
      {...props}
    >
      {icon && <div className="mb-2 text-4xl">{icon}</div>}
      <span>{label}</span>
    </button>
  );
};
