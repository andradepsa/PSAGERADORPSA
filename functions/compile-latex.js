
/**
 * Cloudflare Pages Function to proxy LaTeX compilation requests to TeXLive.net.
 * This is necessary to bypass browser CORS (Cross-Origin Resource Sharing) restrictions.
 */

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function onRequestPost(context) {
    try {
        const { request } = context;
        const body = await request.json();
        const { latex } = body;

        if (!latex) {
            return new Response(JSON.stringify({ error: 'LaTeX code is missing from the request body.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const formData = new FormData();
        formData.append('filecontents[]', latex);
        formData.append('filename[]', 'document.tex');
        formData.append('engine', 'pdflatex');
        formData.append('return', 'pdf');
        
        const texliveResponse = await fetch('https://texlive.net/cgi-bin/latexcgi', {
            method: 'POST',
            body: formData,
        });

        const contentType = texliveResponse.headers.get('content-type');

        if (!texliveResponse.ok || !contentType || !contentType.includes('application/pdf')) {
            const errorLogHtml = await texliveResponse.text();
            console.error(`TeXLive.net compilation failed. Status: ${texliveResponse.status}.`);

            // Try to extract the log from the <pre> tag which latexcgi usually returns
            const logMatch = errorLogHtml.match(/<pre>([\s\S]*?)<\/pre>/);
            let detailedError = "Compilation failed. The TeXLive.net server did not return a PDF.";
            
            if (logMatch && logMatch[1]) {
                // Return a generous chunk of the log so the AI can analyze it. 
                // Increased from 3000 to 15000 to ensure we catch errors buried deep in verbose logs.
                detailedError = `TeX Live Error Log:\n${logMatch[1].substring(0, 15000)}`; 
            } else {
                // Fallback: return the raw HTML (truncated less aggressively)
                // Increased from 1000 to 5000.
                detailedError = `Compilation failed. Upstream response:\n${errorLogHtml.substring(0, 5000)}`;
            }
            
            return new Response(JSON.stringify({ error: detailedError }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const pdfArrayBuffer = await texliveResponse.arrayBuffer();
        const base64Pdf = arrayBufferToBase64(pdfArrayBuffer);

        return new Response(base64Pdf, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
        });

    } catch (error) {
        console.error('Cloudflare function error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return new Response(JSON.stringify({ error: `Proxy function error: ${errorMessage}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }    
}
