import React, { useEffect, useRef, useState } from 'react';

declare const ace: any; // Declara a variável global ace

interface LatexCompilerProps {
    code: string;
    onCodeChange: (newCode: string) => void;
}

const ACE_THEMES = [
    {
        group: 'Bright',
        themes: [
            { name: 'Chrome', value: 'chrome' },
            { name: 'Clouds', value: 'clouds' },
            { name: 'Crimson Editor', value: 'crimson_editor' },
            { name: 'Dawn', value: 'dawn' },
            { name: 'Dreamweaver', value: 'dreamweaver' },
            { name: 'Eclipse', value: 'eclipse' },
            { name: 'GitHub', value: 'github' },
            { name: 'IPlastic', value: 'iplastic' },
            { name: 'Solarized Light', value: 'solarized_light' },
            { name: 'TextMate', value: 'textmate' },
            { name: 'Tomorrow', value: 'tomorrow' },
            { name: 'Xcode', value: 'xcode' },
            { name: 'Kuroir', value: 'kuroir' },
            { name: 'KatzenMilch', value: 'katzenmilch' },
            { name: 'SQL Server', value: 'sqlserver' },
        ]
    },
    {
        group: 'Dark',
        themes: [
            { name: 'Ambiance', value: 'ambiance' },
            { name: 'Chaos', value: 'chaos' },
            { name: 'Clouds Midnight', value: 'clouds_midnight' },
            { name: 'Dracula', value: 'dracula' },
            { name: 'Cobalt', value: 'cobalt' },
            { name: 'Gruvbox', value: 'gruvbox' },
            { name: 'Green on Black', value: 'green_on_black' },
            { name: 'idle Fingers', value: 'idle_fingers' },
            { name: 'krTheme', value: 'kr_theme' },
            { name: 'Merbivore', value: 'merbivore' },
            { name: 'Merbivore Soft', value: 'merbivore_soft' },
            { name: 'Mono Industrial', value: 'mono_industrial' },
            { name: 'Monokai', value: 'monokai' },
            { name: 'Nord Dark', value: 'nord_dark' },
            { name: 'Pastel on dark', value: 'pastel_on_dark' },
            { name: 'Solarized Dark', value: 'solarized_dark' },
            { name: 'Terminal', value: 'terminal' },
            { name: 'Tomorrow Night', value: 'tomorrow_night' },
            { name: 'Tomorrow Night Blue', value: 'tomorrow_night_blue' },
            { name: 'Tomorrow Night Bright', value: 'tomorrow_night_bright' },
            { name: 'Tomorrow Night 80s', value: 'tomorrow_night_eighties' },
            { name: 'Twilight', value: 'twilight' },
            { name: 'Vibrant Ink', value: 'vibrant_ink' },
        ]
    }
];

const LatexCompiler: React.FC<LatexCompilerProps> = ({ code, onCodeChange }) => {
    const editorInstanceRef = useRef<any>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);

    const [currentTheme, setCurrentTheme] = useState('textmate');

    useEffect(() => {
        if (typeof ace !== 'undefined' && editorContainerRef.current && !editorInstanceRef.current) {
            const editor = ace.edit(editorContainerRef.current);
            editorInstanceRef.current = editor;

            const params = new URLSearchParams(window.location.search);
            const codeFromUrl = params.get('code');
            const themeFromUrl = params.get('theme') || 'textmate';

            setCurrentTheme(themeFromUrl);
            editor.setTheme("ace/theme/" + themeFromUrl);
            editor.session.setMode("ace/mode/latex");
            editor.setOptions({
                fontSize: "14px",
                showPrintMargin: false,
                enableBasicAutocompletion: true,
                enableLiveAutocompletion: true,
                wrap: true,
            });
            
            let initialCode = code;
            if (codeFromUrl) {
                const decodedCode = decodeURIComponent(codeFromUrl);
                initialCode = decodedCode;
                onCodeChange(decodedCode);
            }
            
            editor.setValue(initialCode, -1);
            
            editor.session.on('change', () => {
                if (editorInstanceRef.current) {
                    const newCode = editor.getValue();
                    if (newCode !== code) {
                        onCodeChange(newCode);
                    }
                }
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); 

    useEffect(() => {
        // Only update editor if its content is different from the prop to prevent cursor jumps
        if (editorInstanceRef.current && editorInstanceRef.current.getValue() !== code) {
            const pos = editorInstanceRef.current.getCursorPosition();
            editorInstanceRef.current.setValue(code, -1);
            editorInstanceRef.current.moveCursorToPosition(pos);
        }
    }, [code]);

    const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTheme = e.target.value;
        setCurrentTheme(newTheme);
        if (editorInstanceRef.current) {
            editorInstanceRef.current.setTheme("ace/theme/" + newTheme);
        }
    };

    return (
        <div className="space-y-4">
             <div className="p-4 rounded-lg bg-blue-50 border-l-4 border-blue-500" role="complementary">
                <p className="font-bold">💡 How to use:</p>
                <p>1. <strong>Edit the LaTeX code</strong> directly in the editor below.</p>
                <p>2. You can use the "Fixer" button above to apply common LaTeX corrections.</p>
                <p>3. Click "Extract Metadata & Proceed to Compile" to continue.</p>
            </div>

            <div className="p-4 rounded-lg bg-yellow-50 border-l-4 border-yellow-500" role="complementary">
                <p className="font-bold">🔑 URL Parameter for Pre-loading:</p>
                <p>Pass LaTeX code via the <code>code</code> parameter in the URL. </p>
                <p className="text-xs mt-1 bg-gray-100 p-1 rounded"><code>?code=\documentclass...</code></p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm" aria-label="LaTeX Code Editor">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <h2 className="text-lg font-semibold text-gray-700">LaTeX Editor</h2>
                     <div className="controls flex items-center gap-2">
                        <label htmlFor="theme" className="text-sm font-medium text-gray-700">Theme:</label>
                        <select 
                            id="theme" 
                            value={currentTheme} 
                            onChange={handleThemeChange} 
                            className="bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
                            aria-label="Select editor theme"
                        >
                            {ACE_THEMES.map(group => (
                                <optgroup label={group.group} key={group.group}>
                                    {group.themes.map(theme => (
                                        <option key={theme.value} value={theme.value}>{theme.name}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                </div>

                <div ref={editorContainerRef} style={{ height: '400px', border: '1px solid #ddd', borderRadius: '4px' }} aria-label="LaTeX editor content"></div>

                <div className="ace-spacer"></div>
            </div>
        </div>
    );
};

export default LatexCompiler;