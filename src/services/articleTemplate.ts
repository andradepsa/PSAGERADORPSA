
// services/articleTemplate.ts

export const ARTICLE_TEMPLATE = `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath, amssymb, geometry, setspace}
\\usepackage{verbatim}
% Babel package will be added dynamically based on language
\\usepackage[unicode=true]{hyperref}

\\hypersetup{
  pdftitle={[[__TITLE__]]},
  pdfauthor={__PDF_AUTHOR_NAMES_PLACEHOLDER__},
  colorlinks=true,
  linkcolor=blue,
  citecolor=blue,
  urlcolor=blue
}

\\title{[[__TITLE__]]}

\\author{
  __ALL_AUTHORS_LATEX_BLOCK__
}

\\date{}

\\begin{document}

\\maketitle

\\begin{abstract}
[[__ABSTRACT_CONTENT__]]
\\end{abstract}

\\vspace{1cm}

\\noindent \\textbf{Keywords:} [[__KEYWORDS__]]

\\onehalfspacing

\\section{Introduction}
[[__INTRODUCTION_CONTENT__]]

\\section{Literature Review}
[[__LITERATURE_REVIEW_CONTENT__]]

\\section{Methodology}
[[__METHODOLOGY_CONTENT__]]

\\section{Results}
[[__RESULTS_CONTENT__]]

\\section{Discussion}
[[__DISCUSSION_CONTENT__]]

\\section{Conclusion}
[[__CONCLUSION_CONTENT__]]

\\section{Referências}
% The AI service will dynamically replace the placeholder below with specific citations.
% Each reference must be a plain paragraph starting with \\noindent and ending with \\par.
[[__REFERENCES_LIST__]]

\\end{document}`;