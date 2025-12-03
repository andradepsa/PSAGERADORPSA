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
            const storedMultiKeys = localStorage.getItem('gemini_api_keys');
            if (storedMultiKeys) {
                try {
                    const parsed = JSON.parse(storedMultiKeys);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setGeminiKeys(parsed);
                    } else {
                        setGeminiKeys(['']);
                    }
                } catch {
                    setGeminiKeys(['']);
                }
            } else {
                 setGeminiKeys(['']);
            }

            setZenodoKey(localStorage.getItem('zenodo_api_key') || '');
            setXaiKey(localStorage.getItem('xai_api_key') || '');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave({ 
            gemini: geminiKeys.map(k => k.trim()).filter(k => k), 
            zenodo: zenodoKey, 
            xai: xaiKey 
        });
    };
    
    const handleGeminiKeyChange = (index: number, value: string) => {
        const newKeys = [...geminiKeys];
        newKeys[index] = value;
        setGeminiKeys(newKeys);
    };

    const handleAddKey = () => {
        setGeminiKeys([...geminiKeys, '']);
    };
    
    const handleRemoveKey = (index: number) => {
        if (geminiKeys.length > 1) {
            const newKeys = geminiKeys.filter((_, i) => i !== index);
            setGeminiKeys(newKeys);
        }
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md transform transition-all duration-300 p-8 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Configurações de API Key</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close settings">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <p className="text-gray-600 mb-6">
                   Configure suas chaves de API. Adicione múltiplas chaves Gemini para rotação automática em caso de esgotamento de cota.
                </p>
                
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            🔑 Gemini API Key(s)
                        </label>
                        <div className="space-y-2">
                             {geminiKeys.map((key, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input
                                        type="password"
                                        value={key}
                                        onChange={(e) => handleGeminiKeyChange(index, e.target.value)}
                                        placeholder={`Cole a Gemini API Key #${index + 1} aqui`}
                                        className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    <button 
                                        onClick={() => handleRemoveKey(index)}
                                        disabled={geminiKeys.length <= 1}
                                        className="p-2 text-red-500 rounded-full hover:bg-red-100 disabled:text-gray-400 disabled:hover:bg-transparent"
                                        aria-label="Remove API Key"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleAddKey} className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-semibold">+ Adicionar outra chave</button>
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
                            placeholder="Cole sua x.ai API Key aqui"
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
                            placeholder="Cole seu Token Zenodo aqui"
                            className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-4 mt-8">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex items-center justify-center gap-2 px-6 py-2 font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-md hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105"
                    >
                        Salvar e Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;