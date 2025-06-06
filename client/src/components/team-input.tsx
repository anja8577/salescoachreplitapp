import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function TeamInput({ value, onChange, placeholder = "Enter team name", className }: TeamInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  const { data: teams = [] } = useQuery<string[]>({
    queryKey: ['/api/teams'],
  });

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const filteredTeams = teams.filter(team => 
    team.toLowerCase().includes(inputValue.toLowerCase())
  );

  const handleSelect = (team: string) => {
    setInputValue(team);
    onChange(team);
    setOpen(false);
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    onChange(newValue);
    // Always show dropdown when typing if there are teams available
    setOpen(newValue.length > 0 && teams.length > 0);
  };

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={placeholder}
              onFocus={() => setOpen(inputValue.length > 0 && filteredTeams.length > 0)}
              className="pr-8"
            />
            {filteredTeams.length > 0 && (
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 opacity-50" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandList>
              <CommandGroup>
                {filteredTeams.map((team) => (
                  <CommandItem
                    key={team}
                    value={team}
                    onSelect={() => handleSelect(team)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        inputValue === team ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {team}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}