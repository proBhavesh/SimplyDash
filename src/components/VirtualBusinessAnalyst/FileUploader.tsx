import React from 'react';

interface FileUploaderProps {
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  selectedFile: File | null;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onFileChange,
  onUpload,
  selectedFile,
}) => {
  return (
    <div className="mb-6">
      <label className="block mb-2 font-semibold">Upload Blueprint PDF:</label>
      <input
        type="file"
        accept=".pdf"
        onChange={onFileChange}
        className="block w-full text-sm text-gray-600
                              file:mr-4 file:py-2 file:px-4
                              file:rounded-full file:border-0
                              file:text-sm file:font-semibold
                              file:bg-blue-50 file:text-blue-700
                              hover:file:bg-blue-100"
      />
      {selectedFile && (
        <button
          onClick={onUpload}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full shadow-md transition duration-300"
        >
          Upload PDF
        </button>
      )}
    </div>
  );
};

export default FileUploader;
