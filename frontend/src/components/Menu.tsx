import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const Menu = () => {
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const downloadsRef = useRef<HTMLDivElement>(null);

  // Close the downloads popover when clicking anywhere outside of it.
  useEffect(() => {
    if (!downloadsOpen) return;
    const onClick = (e: MouseEvent) => {
      if (downloadsRef.current && !downloadsRef.current.contains(e.target as Node)) {
        setDownloadsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [downloadsOpen]);

  return (
    <>
      <div className="fixed mx-auto bottom-10 flex justify-center z-40">
        <Link to="/">
          <img className="plus w-12" src="/plus.svg" alt="plus" />
        </Link>
      </div>
      <div className="forms flex px-4 sm:px-10 bottom-0 left-0 justify-around fixed w-full items-center h-24 bg-#081b29 z-10">
        <Link to="/search">
          <img className="w-8 search" src="/search.svg" alt="search" />
        </Link>
        <Link to="/profile">
          <img className=" w-8 persons" src="/person.svg" alt="person" />
        </Link>
        <Link to="/messenger">
          <img className="w-8 message" src="/message.svg" alt="message" />
        </Link>
        <Link to="/settings">
          <img className=" w-8 settings" src="/settings.svg" alt="settings" />
        </Link>
        <div className="relative" ref={downloadsRef}>
          <button
            type="button"
            onClick={() => setDownloadsOpen((open) => !open)}
            aria-haspopup="true"
            aria-expanded={downloadsOpen}
            aria-label="Download files from your manager"
            className="flex items-center bg-transparent border-none cursor-pointer p-0"
          >
            <img className="w-8 download" src="/download.svg" alt="download" />
          </button>
          {downloadsOpen && (
            <div className="absolute bottom-12 right-0 w-52 rounded-lg border border-gray-700 bg-gray-900 shadow-lg overflow-hidden">
              <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-800">
                Files from your manager
              </div>
              <a
                href="/manager-file.xlsx"
                download
                onClick={() => setDownloadsOpen(false)}
                className="block px-3 py-2 text-sm text-gray-100 hover:bg-gray-800"
              >
                Excel file (.xlsx)
              </a>
              <a
                href="/manager-file.docx"
                download
                onClick={() => setDownloadsOpen(false)}
                className="block px-3 py-2 text-sm text-gray-100 hover:bg-gray-800"
              >
                Word file (.docx)
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Menu;
