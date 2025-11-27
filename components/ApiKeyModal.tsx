import React, { useState, useEffect } from 'react';
import type { ApiKeyDef } from '../types';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (keys: { gemini: ApiKeyDef[], zenodo: string, xai: string }) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave }) => {
    const [geminiKeys, setGeminiKeys] = useState<ApiKeyDef[]>([]);
    const [zenodoKey, setZenodoKey] = useState('');
    const [xaiKey, setXaiKey] = useState('');
    
    // Form state
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyValue, setNewKeyValue] = useState('');

    useEffect(() => {
        if (isOpen) {
            // Load list of keys
            const storedList = localStorage.getItem('gemini_api_keys_list');
            let keys: ApiKeyDef[] = [];
            
            if (storedList) {
                try {
                    const parsed = JSON.parse(storedList);
                    if (Array.isArray(parsed)) {
                        // Compatibility with old string[] format
                        if (parsed.length > 0 && typeof parsed[0] === 'string') {
                            keys = parsed.map((k, i) => ({ key: k, name: `Chave Antiga ${i + 1}` }));
                        } else {
                            keys = parsed as ApiKeyDef[];
                        }
                    }
                } catch {
                    keys = [];
                }
            } else {
                // Fallback for legacy single key
                const legacyKey = localStorage.getItem('gemini_api_key');
                if (legacyKey) keys = [{ key: legacyKey, name: 'Minha Chave Padrão' }];
            }
            
            setGeminiKeys(keys);
            setZenodoKey(localStorage.getItem('zenodo_api_key') || '');
            setXaiKey(localStorage.getItem('xai_api_key') || '');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleAddKey = () => {
        if (newKeyValue.trim()) {
            // Check for duplicates based on the KEY value
            if (!geminiKeys.some(k => k.key === newKeyValue.trim())) {
                const name = newKeyName.trim() || `API Key ${geminiKeys.length + 1}`;
                setGeminiKeys([...geminiKeys, { key: newKeyValue.trim(), name }]);
            }
            setNewKeyValue('');
            setNewKeyName('');
        }
    };

    const handleRemoveKey = (index: number) => {
        setGeminiKeys(geminiKeys.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        // If the user typed a key but didn't click add, add it automatically
        let finalKeys = [...geminiKeys];
        if (newKeyValue.trim() && !geminiKeys.some(k => k.key === newKeyValue.trim())) {
             const name = newKeyName.trim() || `API Key ${geminiKeys.length + 1}`;
            finalKeys.push({ key: newKeyValue.trim(), name });
        }
        
        onSave({ gemini: finalKeys, zenodo: zenodoKey, xai: xaiKey });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg transform transition-all duration-300 p-8 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Configurações de API</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close settings">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <p className="text-gray-600 mb-6 text-sm">
                    Gerencie suas chaves de API. Nomeie suas chaves para identificar qual está sendo usada durante a rotação automática.
                </p>
                
                <div className="space-y-6">
                    {/* Gemini Keys Section */}
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                        <label className="block text-sm font-bold text-indigo-900 mb-2">
                            🔑 Chaves da API Google Gemini (Rotação Automática)
                        </label>
                        
                        {/* List of existing keys */}
                        <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                            {geminiKeys.map((item, index) => (
                                <div key={index} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                                    <div className="flex-grow flex flex-col">
                                        <span className="font-bold text-sm text-gray-800">{item.name}</span>
                                        <span className="font-mono text-xs text-gray-500 truncate">
                                            {item.key.substring(0, 8)}...{item.key.substring(item.key.length - 6)}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => handleRemoveKey(index)}
                                        className="text-red-500 hover:text-red-700 p-1"
                                        title="Remover chave"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                            {geminiKeys.length === 0 && (
                                <p className="text-xs text-red-500 italic">Nenhuma chave cadastrada. O sistema não funcionará.</p>
                            )}
                        </div>

                        {/* Input for new key */}
                        <div className="grid grid-cols-1 gap-2">
                            <input
                                type="text"
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                                placeholder="Nome/Apelido (ex: Pessoal, Trabalho)"
                                className="p-2 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value={newKeyValue}
                                    onChange={(e) => setNewKeyValue(e.target.value)}
                                    placeholder="Colar API Key aqui..."
                                    className="flex-grow p-2 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <button
                                    onClick={handleAddKey}
                                    disabled={!newKeyValue.trim()}
                                    className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 disabled:bg-gray-400 text-sm font-semibold"
                                >
                                    Adicionar
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-indigo-800 mt-2">
                            Dica: Se uma chave atingir o limite de cota, o sistema pulará automaticamente para a próxima chave da lista.
                        </p>
                    </div>

                    {/* x.ai Key */}
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
                    </div>

                    {/* Zenodo Token */}
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
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex items-center justify-center gap-2 px-6 py-2 font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-md hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105"
                    >
                        Salvar Configurações
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;