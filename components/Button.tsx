import React from 'react';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'danger' | 'neon'; isLoading?: boolean }
export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', isLoading, disabled, className = '', ...props }) => {
  const baseStyles = 'relative w-full py-4 px-6 rounded-xl font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';
  const variants = {
    primary: 'bg-white text-spartan-black hover:bg-gray-200 border-2 border-transparent',
    secondary: 'bg-spartan-gray text-white border-2 border-gray-600 hover:border-gray-400',
    danger: 'bg-spartan-red/10 text-spartan-red border-2 border-spartan-red hover:bg-spartan-red hover:text-white',
    neon: 'bg-spartan-neon/10 text-spartan-neon border-2 border-spartan-neon hover:bg-spartan-neon hover:text-spartan-black shadow-[0_0_15px_rgba(0,240,255,0.3)] hover:shadow-[0_0_25px_rgba(0,240,255,0.6)]',
  };
  return <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props} type={props.type ?? 'button'} disabled={isLoading || disabled} aria-busy={isLoading || undefined}>{isLoading ? <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : children}</button>;
};
