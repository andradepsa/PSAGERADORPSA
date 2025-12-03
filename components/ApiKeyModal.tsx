import React, { useState, useEffect } from 'react';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (keys: { gemini: string, zenodo: string, xai: string }) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave }) => {
    const [geminiKey, setGeminiKey] = useState('');
    const [zenodoKey, setZenodoKey] = useState('');
    const [xaiKey, setXaiKey] = useState('');

    useEffect(() => {
        if (isOpen) {
            setGeminiKey(localStorage.getItem('gemini_api_key') || '');
            setZenodoKey(localStorage.getItem('zenodo_api_key') || '');
            setXaiKey(localStorage.getItem('xai_api_key') || '');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave({ gemini: geminiKey, zenodo: zenodoKey, xai: xaiKey });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md transform transition-all duration-300 p-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">API Key Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close settings">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <p className="text-gray-600 mb-6">
                    Enter your API keys below. They will be saved in your browser's local storage for future use.
                </p>
                
                <div className="space-y-4">
                    <div>
                        <label htmlFor="gemini-key" className="block text-sm font-medium text-gray-700 mb-1">
                            🔑 Gemini API Key
                        </label>
                        <input
                            id="gemini-key"
                            type="password"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="Enter your Gemini API Key"
                            className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                     <div>
                        <label htmlFor="xai-key" className="block text-sm font-medium text-gray-700 mb-1">
                           🤖 x.ai (Grok) API Key
                        </label>
                        <input
                            id="xai-key"
                            type="password"
                            value={xaiKey}
                            onChange={(e) => setXaiKey(e.target.value)}
                            placeholder="Enter your x.ai API Key"
                            className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <details className="text-xs text-gray-500 mt-1 cursor-pointer">
                            <summary>API Request Example (cURL)</summary>
                            <pre className="bg-gray-100 p-2 rounded mt-1 text-xs overflow-x-auto">
                                <code>
                                    {`curl https://api.x.ai/v1/chat/completions \\
-H "Content-Type: application/json" \\
-H "Authorization: Bearer YOUR_API_KEY" \\
-d '{
  "messages": [{"role": "user", "content": "..."}],
  "model": "grok-4-latest"
}'`}
                                </code>
                            </pre>
                        </details>
                    </div>
                    <div>
                        <label htmlFor="zenodo-key" className="block text-sm font-medium text-gray-700 mb-1">
                            ☁️ Zenodo Token
                        </label>
                        <input
                            id="zenodo-key"
                            type="password"
                            value={zenodoKey}
                            onChange={(e) => setZenodoKey(e.target.value)}
                            placeholder="Enter your Zenodo Token"
                            className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-4 mt-8">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex items-center justify-center gap-2 px-6 py-2 font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-md hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105"
                    >
                        Save and Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;