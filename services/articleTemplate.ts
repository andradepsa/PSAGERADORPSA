// services/articleTemplate.ts

export const ARTICLE_TEMPLATE = `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath, amssymb, geometry, setspace, url, verbatim}
\\usepackage{hyperref}
% Babel package will be added dynamically based on language

\\hypersetup{
  pdftitle={[INSERT NEW TITLE HERE]},
  pdfauthor={SÉRGIO DE ANDRADE, PAULO},
  pdfsubject={[INSERT NEW COMPLETE ABSTRACT HERE]},
  pdfkeywords={[INSERT COMMA-SEPARATED KEYWORDS HERE]}
}

\\title{[INSERT NEW TITLE HERE]}

\\author{
  SÉRGIO DE ANDRADE, PAULO \\\\
  \\small ORCID: \\url{https://orcid.org/0009-0004-2555-3178}
}

\\date{}

\\begin{document}

\\maketitle

\\begin{abstract}
[INSERT NEW COMPLETE ABSTRACT HERE. This must be plain text without LaTeX commands.]
\\end{abstract}

\\vspace{1cm}

\\noindent \\textbf{Keywords:} [INSERT COMMA-SEPARATED KEYWORDS HERE]

\\onehalfspacing

\\section{Introduction}
[INSERT NEW CONTENT FOR INTRODUCTION SECTION HERE. The content must be extensive and detailed to meet the required page count.]

\\section{Literature Review}
[INSERT NEW CONTENT FOR LITERATURE REVIEW SECTION HERE. The content must be extensive and detailed to meet the required page count.]

\\section{Methodology}
[INSERT NEW CONTENT FOR METHODOLOGY SECTION HERE. The content must be extensive and detailed to meet the required page count.]

\\section{Results}
[INSERT NEW CONTENT FOR RESULTS SECTION HERE. The content must be extensive and detailed to meet the required page count.]

\\section{Discussion}
[INSERT NEW CONTENT FOR DISCUSSION SECTION HERE. The content must be extensive and detailed to meet the required page count.]

\\section{Conclusion}
[INSERT NEW CONTENT FOR CONCLUSION SECTION HERE. The content must be extensive and detailed to meet the required page count.]

\\section{Referências}
% Provide exactly [INSERT REFERENCE COUNT] entries as a plain, unnumbered list.
% Each reference must start with \\noindent and end with \\par.
% CRITICAL: Absolutely DO NOT use \\begin{thebibliography} or \\bibitem.
[INSERT NEW REFERENCE LIST HERE]

\\end{document}`;
