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
    sm: "h-14 w-14",
    md: "h-12 w-12", 
    lg: "h-16 w-16"
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
      <h1 className={`font-bold ${sizeClasses[size]} text-black`}>
        SalesCoach
      </h1>
    </div>
  );
}