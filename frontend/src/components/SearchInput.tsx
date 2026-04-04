import type { ChangeEvent } from "react";

interface SearchInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

const SearchInput = ({ value, onChange, placeholder = "Search..." }: SearchInputProps) => {
  const controlled = value !== undefined;

  return (
    <div className="labels relative max-w-3xl mt-4 w-full px-5">
      <div className="input-box">
        <input
          type="text"
          placeholder={placeholder}
          className="py-2 px-2 rounded focus:outline-none w-full"
          {...(controlled
            ? { value, onChange: (e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value) }
            : { onChange: (e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value) })}
        />
      </div>
      <img
        src="/search.svg"
        className="search absolute w-6 top-2 right-7 flex items-center text-gray-500"
        alt=""
      />
    </div>
  );
};

export default SearchInput;
