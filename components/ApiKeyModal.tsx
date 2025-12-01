import React, { useState, useEffect } from 'react';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (keys: { gemini: string[], zenodo: string, xai: string }) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave }) => {
    const [geminiKeys, setGeminiKeys] = useState<string[]>(['']);
    const [zenodoKey, setZenodoKey] = useState('');
    const [xaiKey, setXaiKey] = useState('');

    useEffect(() => {
        if (isOpen) {
            // Load multiple keys
            const storedGeminiKeys = localStorage.getItem('gemini_api_keys');
            const oldSingleKey = localStorage.getItem('gemini_api_key');

            if (storedGeminiKeys) {
                try {
                    const parsed = JSON.parse(storedGeminiKeys);
                    setGeminiKeys(Array.isArray(parsed) && parsed.length > 0 ? parsed : ['']);
                } catch {
                    setGeminiKeys(['']);
                }
            } else if (oldSingleKey) {
                // Migration support
                setGeminiKeys([oldSingleKey]);
            } else {
                setGeminiKeys(['']);
            }

            setZenodoKey(localStorage.getItem('zenodo_api_key') || '');
            setXaiKey(localStorage.getItem('xai_api_key') || '');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        // Filter out empty keys
        const validGeminiKeys = geminiKeys.map(k => k.trim()).filter(k => k !== '');
        // Ensure at least one key is present for the logic, even if empty string (to show error later)
        const finalGeminiKeys = validGeminiKeys.length > 0 ? validGeminiKeys : [];
        
        onSave({ gemini: finalGeminiKeys, zenodo: zenodoKey, xai: xaiKey });
    };

    const handleAddGeminiKey = () => {
        setGeminiKeys([...geminiKeys, '']);
    };

    const handleRemoveGeminiKey = (index: number) => {
        const newKeys = geminiKeys.filter((_, i) => i !== index);
        setGeminiKeys(newKeys.length > 0 ? newKeys : ['']);
    };

    const handleGeminiKeyChange = (index: number, value: string) => {
        const newKeys = [...geminiKeys];
        newKeys[index] = value;
        setGeminiKeys(newKeys);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md transform transition-all duration-300 p-8 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">API Key Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close settings">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <p className="text-gray-600 mb-6">
                    Configure your API keys. You can add multiple Gemini keys to handle quota limits automatically.
                </p>
                
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            🔑 Gemini API Keys (Multi-Key Support)
                        </label>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {geminiKeys.map((key, index) => (
                                <div key={index} className="flex gap-2 items-center">
                                    <span className="text-xs text-gray-400 font-mono w-6 text-right">{index + 1}.</span>
                                    <input
                                        type="password"
                                        value={key}
                                        onChange={(e) => handleGeminiKeyChange(index, e.target.value)}
                                        placeholder={`Gemini API Key #${index + 1}`}
                                        className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    />
                                    {geminiKeys.length > 1 && (
                                        <button 
                                            onClick={() => handleRemoveGeminiKey(index)}
                                            className="text-red-500 hover:text-red-700 p-2"
                                            title="Remove this key"
                                        >
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={handleAddGeminiKey}
                            className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            Add Another Key
                        </button>
                        <p className="text-xs text-gray-500 mt-2">
                            If one key runs out of quota, the system will automatically switch to the next one.
                        </p>
                    </div>

                    <div className="border-t pt-4">
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