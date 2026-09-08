
import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Logo: React.FC<LogoProps> = ({ className = "", size = 'md' }) => {
  const sizes = {
    sm: 'w-10 h-10',
    md: 'w-24 h-24',
    lg: 'w-40 h-40',
    xl: 'w-56 h-56'
  };

  const currentSize = sizes[size] || sizes.md;
  
  // Link direto para a nova imagem no Google Drive
  const logoUrl = "https://lh3.googleusercontent.com/d/1YRNr9wiQMq0uazkWk3KY8ERoabtlTW5O";

  return (
    <div className={`${currentSize} flex items-center justify-center ${className}`}>
      <img 
        src={logoUrl} 
        alt="CTBMF Logo" 
        className="w-full h-full object-contain drop-shadow-2xl"
        referrerPolicy="no-referrer"
        onError={(e) => {
          // Fallback se o link do Drive falhar
          e.currentTarget.src = "https://placehold.co/400x400/24282b/c89b3c.png?text=CTBMF";
        }}
      />
    </div>
  );
};

export default Logo;
