import React, { useEffect, useState, useRef } from 'react';

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&*[]{}<>";

interface MatrixTextProps {
  text: string;
  speed?: number;
  className?: string;
  preserveSpace?: boolean;
}

export const MatrixText: React.FC<MatrixTextProps> = ({ 
  text, 
  speed = 30, 
  className = "",
  preserveSpace = true
}) => {
  const [display, setDisplay] = useState(text);
  const iterations = useRef(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // If text hasn't changed (or initial render), just set it
    // But we want to animate on change.
    
    // Reset
    iterations.current = 0;
    
    if (intervalRef.current) window.clearInterval(intervalRef.current);

    intervalRef.current = window.setInterval(() => {
      setDisplay(prev => {
        const result = text.split("").map((char, index) => {
          if (index < iterations.current) {
            return text[index];
          }
          if (preserveSpace && char === " ") return " ";
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        }).join("");

        if (iterations.current >= text.length) {
          if (intervalRef.current) window.clearInterval(intervalRef.current);
        }
        
        iterations.current += 1 / 3; // Slow down the "lock in" effect
        return result;
      });
    }, speed);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [text, speed, preserveSpace]);

  return <span className={className}>{display}</span>;
};