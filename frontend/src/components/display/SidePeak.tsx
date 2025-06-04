import { ReactNode } from 'react';

type SidePeakProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
};

export const SidePeak = ({ isOpen, onClose, children }: SidePeakProps) => {
  return (
    <>
      {/* オーバーレイ */}
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity duration-300 z-50 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* サイドパネル */}
      <div
        className={`fixed top-0 right-0 h-full w-[600px] bg-gray-100 transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* ヘッダー */}
          <div className="flex justify-end p-4 border-b border-gray-100">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* コンテンツエリア */}
          <div className="flex-1 px-6 pb-6 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}; 