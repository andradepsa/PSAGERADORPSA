
import React from 'react';

interface ModelOption {
    name: string;
    description: string;
}

interface ModelSelectorProps {
    models: ModelOption[];
    selectedModel: string;
    onSelect: (model: string) => void;
    label: string;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ models, selectedModel, onSelect, label }) => {
    return (
        <div className="my-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
                {label}
            </label>
            <div className="relative">
                <select
                    value={selectedModel}
                    onChange={(e) => onSelect(e.target.value)}
                    className="block w-full appearance-none bg-white border border-gray-300 text-gray-900 text-base rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-3 pr-10 shadow-sm transition-all hover:border-indigo-400 cursor-pointer"
                >
                    {models.map((model) => (
                        <option key={model.name} value={model.name}>
                            {model.name} — {model.description}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                    <svg className="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default ModelSelector;
