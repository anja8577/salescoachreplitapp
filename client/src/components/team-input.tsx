import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TeamInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function TeamInput({ value, onChange, placeholder = "Enter team name", className }: TeamInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data: teams = [] } = useQuery<string[]>({
    queryKey: ['/api/teams'],
  });

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const filteredTeams = teams.filter(team => 
    team.toLowerCase().includes(inputValue.toLowerCase()) && 
    team.toLowerCase() !== inputValue.toLowerCase()
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setShowSuggestions(newValue.length > 0 && filteredTeams.length > 0);
  };

  const handleSuggestionClick = (team: string) => {
    setInputValue(team);
    onChange(team);
    setShowSuggestions(false);
  };

  const handleFocus = () => {
    if (inputValue.length > 0 && filteredTeams.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow clicks
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full"
      />
      
      {showSuggestions && filteredTeams.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filteredTeams.map((team) => (
            <div
              key={team}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
              onMouseDown={(e) => e.preventDefault()} // Prevent blur on click
              onClick={() => handleSuggestionClick(team)}
            >
              {team}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}