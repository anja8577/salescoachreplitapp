import logoPath from "@assets/Sales Coach icon 11339b.png";

interface SalesCoachHeaderProps {
  className?: string;
  showLogo?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function SalesCoachHeader({ 
  className = "", 
  showLogo = true, 
  size = "md" 
}: SalesCoachHeaderProps) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl", 
    lg: "text-3xl"
  };

  const logoSizes = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12"
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showLogo && (
        <img 
          src={logoPath} 
          alt="SalesCoach" 
          className={`${logoSizes[size]} object-contain`}
        />
      )}
      <h1 className={`font-bold ${sizeClasses[size]}`} style={{ color: '#11339b' }}>
        SalesCoach
      </h1>
    </div>
  );
}