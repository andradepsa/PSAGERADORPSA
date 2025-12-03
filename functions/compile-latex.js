
/**
 * Cloudflare Pages Function to proxy LaTeX compilation requests.
 * Uses texlive.net as primary and latexonline.cc as fallback.
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

        let pdfArrayBuffer = null;
        let compilationError = null;

        // --- ATTEMPT 1: TeXLive.net ---
        try {
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
            if (texliveResponse.ok && contentType && contentType.includes('application/pdf')) {
                pdfArrayBuffer = await texliveResponse.arrayBuffer();
            } else {
                const errorText = await texliveResponse.text();
                compilationError = `TeXLive Error: ${errorText.substring(0, 500)}`;
                console.warn("TeXLive compilation failed, trying fallback...");
            }
        } catch (e) {
            compilationError = `TeXLive Network Error: ${e.message}`;
            console.warn("TeXLive network failed, trying fallback...");
        }

        // --- ATTEMPT 2: LatexOnline.cc (Fallback) ---
        if (!pdfArrayBuffer) {
            try {
                // LatexOnline supports POST with 'text' query param or form data.
                // For large files, query param can hit 414. We use URLSearchParams in POST body or FormData.
                // However, latexonline.cc expects 'text' as a parameter.
                // Let's try constructing a URL with params but sending as POST to avoid URL length limit if server supports it,
                // otherwise strictly URL params.
                // Actually, latexonline.cc source shows it accepts file upload named 'text' or 'tar.gz'.
                
                const fallbackUrl = `https://latexonline.cc/compile?text=${encodeURIComponent(latex)}`;
                
                // If the latex is huge, this URL will be too long. 
                // Let's try sending as a file upload which is standard.
                const fallbackFormData = new FormData();
                const blob = new Blob([latex], { type: 'application/x-tex' });
                fallbackFormData.append('file', blob, 'main.tex'); // latexonline often expects 'file' or 'text'

                // Let's try the direct text param via POST first if supported, or just the URL.
                // Most robust for latexonline is ?text=... but has limit. 
                // Let's try a different known mirror or just report the error if huge.
                // Alternative: https://rtex.probablyaweb.site/api/v2
                
                // Let's just try the text param. If it fails, we fail.
                const fallbackResponse = await fetch(fallbackUrl, { method: 'POST' }); // POST might work for larger payloads on some forks
                
                if (fallbackResponse.ok && fallbackResponse.headers.get('content-type')?.includes('pdf')) {
                    pdfArrayBuffer = await fallbackResponse.arrayBuffer();
                    compilationError = null; // Clear error if fallback succeeded
                } else {
                     // Try sending as form data 'text'
                     const fd = new FormData();
                     fd.append('text', latex);
                     const fdResponse = await fetch('https://latexonline.cc/compile', { method: 'POST', body: fd });
                     if (fdResponse.ok && fdResponse.headers.get('content-type')?.includes('pdf')) {
                         pdfArrayBuffer = await fdResponse.arrayBuffer();
                         compilationError = null;
                     }
                }
            } catch (e) {
                console.warn("Fallback compilation failed: " + e.message);
            }
        }

        if (!pdfArrayBuffer) {
            // Return the original error from TeXLive (or fallback) to help the AI fix it
            return new Response(JSON.stringify({ error: compilationError || 'Compilation failed on both primary and fallback servers.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

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