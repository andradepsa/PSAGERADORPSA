import React, { useState, useEffect } from 'react';
import { PersonalData } from '../types';

interface PersonalDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: PersonalData) => void;
    initialData: PersonalData;
}

const PersonalDataModal: React.FC<PersonalDataModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const [name, setName] = useState(initialData.name);
    const [affiliation, setAffiliation] = useState(initialData.affiliation);
    const [orcid, setOrcid] = useState(initialData.orcid);

    useEffect(() => {
        if (isOpen) {
            setName(initialData.name);
            setAffiliation(initialData.affiliation);
            setOrcid(initialData.orcid);
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave({ name, affiliation, orcid });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md transform transition-all duration-300 p-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">⚙️ Dados Pessoais do Autor</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Fechar configurações de dados pessoais">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <p className="text-gray-600 mb-6">
                    Insira seus dados de autor para o artigo e publicação no Zenodo. Eles serão salvos no seu navegador.
                </p>
                
                <div className="space-y-4">
                    <div>
                        <label htmlFor="author-name" className="block text-sm font-medium text-gray-700 mb-1">
                            👤 Nome Completo (ex: DE ANDRADE, PAULO SÉRGIO)
                        </label>
                        <input
                            id="author-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Seu nome completo"
                            className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="author-affiliation" className="block text-sm font-medium text-gray-700 mb-1">
                            🏢 Afiliação (ex: Faculdade de Guarulhos (FG))
                        </label>
                        <input
                            id="author-affiliation"
                            type="text"
                            value={affiliation}
                            onChange={(e) => setAffiliation(e.target.value)}
                            placeholder="Sua instituição de afiliação"
                            className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="author-orcid" className="block text-sm font-medium text-gray-700 mb-1">
                            🔗 ORCID (ex: 0000-0000-0000-0000)
                        </label>
                        <input
                            id="author-orcid"
                            type="text"
                            value={orcid}
                            onChange={(e) => setOrcid(e.target.value)}
                            placeholder="Seu ORCID (opcional)"
                            className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <small className="text-xs text-gray-500 mt-1 block">
                            Seu ORCID é um identificador digital persistente para pesquisadores.
                            Obtenha um em <a href="https://orcid.org/register" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">orcid.org/register</a>.
                        </small>
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

export default PersonalDataModal;