
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Student } from '../../types';
import Avatar from './Avatar';

interface StudentSearchProps {
  students: Student[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}

const StudentSearch: React.FC<StudentSearchProps> = ({ students, value, onChange, error, placeholder = "Buscar alumno..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive selected student object from ID value
  const selectedStudent = useMemo(() => students.find(s => s.id === value), [students, value]);

  // Sync query with selected value when closed or initially
  useEffect(() => {
    if (selectedStudent && !isOpen) {
        setQuery(selectedStudent.name);
    } else if (!value && !isOpen) {
        setQuery('');
    }
  }, [selectedStudent, isOpen, value]);

  // Filter logic
  const filteredStudents = useMemo(() => {
    if (query === '' || (selectedStudent && query === selectedStudent.name)) return students;
    return students.filter((student) =>
      student.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, students, selectedStudent]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Revert query if no valid selection was made
        if (selectedStudent) setQuery(selectedStudent.name);
        else setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedStudent]);

  const handleSelect = (student: Student) => {
    onChange(student.id);
    setQuery(student.name);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % filteredStudents.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + filteredStudents.length) % filteredStudents.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filteredStudents.length > 0) {
        handleSelect(filteredStudents[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Tab') {
        setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <style>
          {`
            input.student-search-input-override {
              padding-left: 56px !important;
            }
          `}
        </style>
        <input
          ref={inputRef}
          type="text"
          className={`w-full rounded-xl border p-4 text-base md:text-sm min-h-[48px] font-medium transition-all shadow-sm student-search-input-override ${
            error 
              ? 'border-red-500 bg-red-500/5 text-red-200 focus:ring-red-500/20' 
              : '!bg-[#050505] !border-zinc-800 text-white focus:!border-red-600 focus:!ring-4 focus:ring-red-600/10'
          } placeholder:text-zinc-800`}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
            if (e.target.value === '') onChange(''); // Clear selection if text is cleared
          }}
          onFocus={() => {
              setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <div className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
            {selectedStudent ? (
                <Avatar src={selectedStudent.avatarUrl} name={selectedStudent.name} className="size-7 rounded-full border border-zinc-800 text-[10px] font-black italic shadow-inner" />
            ) : (
                <span className="material-symbols-outlined text-zinc-700 !text-xl">search</span>
            )}
        </div>
        
        {/* Dropdown Chevron / Clear */}
        <div className="absolute right-3.5 top-3 flex items-center">
            {query && (
                <button 
                    type="button"
                    onClick={() => {
                        onChange('');
                        setQuery('');
                        setIsOpen(true);
                        inputRef.current?.focus();
                    }}
                    className="text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                    <span className="material-symbols-outlined text-lg">close</span>
                </button>
            )}
        </div>
      </div>

      {error && <p className="text-xs text-red-500 mt-1 font-medium animate-in slide-in-from-top-1 fade-in">{error}</p>}

      {/* Dropdown List */}
      {isOpen && (
        <ul className="absolute z-50 w-full mt-2 max-h-60 overflow-auto rounded-xl bg-[#0a0a0a] py-1 shadow-2xl border border-zinc-800 no-scrollbar animate-in fade-in zoom-in-95 duration-200">
          {filteredStudents.length === 0 ? (
            <li className="relative cursor-default select-none py-6 px-4 text-zinc-600 text-center font-black uppercase tracking-widest text-[10px] italic">
              Sin resultados
            </li>
          ) : (
            filteredStudents.map((student, index) => (
              <li
                key={student.id}
                className={`relative cursor-pointer select-none py-3 px-4 flex items-center justify-between transition-all border-b border-zinc-900/50 last:border-0 ${
                  index === highlightedIndex ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/50'
                }`}
                onClick={() => handleSelect(student)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="flex items-center gap-3">
                    <Avatar src={student.avatarUrl} name={student.name} className="size-8 rounded-full border border-zinc-900 shadow-sm" />
                    <div className="flex flex-col">
                        <span className={`text-base md:text-sm font-bold truncate leading-tight ${index === highlightedIndex ? 'text-white' : 'text-zinc-200'}`}>
                            {student.name}
                        </span>
                        <span className={`text-xs md:text-[10px] font-black uppercase tracking-widest ${index === highlightedIndex ? 'text-zinc-500' : 'text-zinc-600'}`}>
                            {student.rank}
                        </span>
                    </div>
                </div>
                
                {/* Debt Indicator */}
                <div className="text-right">
                    {student.balance > 0 ? (
                        <div className="flex flex-col items-end">
                            <span className="text-red-400 font-black text-[11px] md:text-[9px] bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/10 uppercase tracking-widest italic">
                                Deuda: ${student.balance.toFixed(2)}
                            </span>
                        </div>
                    ) : (
                        <span className="text-emerald-500/50 font-black text-[11px] md:text-[9px] flex items-center gap-1 uppercase tracking-widest italic">
                            <span className="material-symbols-outlined text-xs filled">check_circle</span> Al día
                        </span>
                    )}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default StudentSearch;
