// services/latexTemplates.ts

export const LATEX_TEMPLATES: string[] = [
// TEMPLATE 1: Standard 5-Section Structure
`\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{times}
\\usepackage[brazilian]{babel}
\\usepackage[a4paper, left=3cm, right=2cm, top=3cm, bottom=2cm]{geometry}
\\usepackage{amsmath, amssymb, setspace, url, verbatim}
\\usepackage{ragged2e}
\\usepackage{hyperref}

\\hypersetup{
  pdftitle={[TÍTULO DO ARTIGO AQUI]},
  pdfauthor={SÉRGIO DE ANDRADE, PAULO},
  pdfsubject={[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]},
  pdfkeywords={[PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3]}
}
\\title{[TÍTULO DO ARTIGO AQUI]}

\\begin{document}
\\onehalfspacing

\\begin{center}
  \\textbf{\\MakeUppercase{[TÍTULO DO ARTIGO AQUI]}}
\\end{center}
\\vspace{1.5cm}
\\begin{flushright}
  SÉRGIO DE ANDRADE, PAULO \\\\
  \\small ORCID: \\url{https://orcid.org/0009-0004-2555-3178}
\\end{flushright}
\\vspace{1.5cm}

\\begin{center}\\textbf{RESUMO}\\end{center}
\\justifying
[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]

\\noindent\\textbf{Palavras-chave:} [PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3].

\\section{INTRODUÇÃO}
[CONTEÚDO DA INTRODUÇÃO AQUI. APRESENTE O TEMA, O PROBLEMA DE PESQUISA, A JUSTIFICATIVA E OS OBJETIVOS DO TRABALHO. ESTA SEÇÃO DEVE SER EXTENSA PARA GARANTIR O NÚMERO DE PÁGINAS.]

\\section{REVISÃO DA LITERATURA}
[CONTEÚDO DA REVISÃO DA LITERATURA AQUI. DISCUTA OS TRABALHOS ANTERIORES RELEVANTES, IDENTIFIQUE LACUNAS E POSICIONE O SEU TRABALHO DENTRO DO CAMPO DE ESTUDO. ESTA SEÇÃO DEVE SER EXTENSA E BEM DETALHADA.]
\\subsection{FUNDAMENTOS TEÓRICOS}
[DETALHE OS CONCEITOS TEÓRICOS QUE EMBASAM A PESQUISA.]
\\subsection{TRABALHOS CORRELATOS}
[ANALISE CRITICAMENTE OUTROS ESTUDOS DIRETAMENTE RELACIONADOS AO SEU.]

\\section{METODOLOGIA}
[CONTEÚDO DA METODOLOGIA AQUI. DESCREVA EM DETALHES OS MÉTODOS, TÉCNICAS E PROCEDIMENTOS UTILIZADOS NA PESQUISA. A DESCRIÇÃO DEVE SER CLARA E PRECISA PARA PERMITIR A REPLICABILIDADE DO ESTUDO.]

\\section{RESULTADOS E DISCUSSÃO}
[APRESENTE E ANALISE OS RESULTADOS OBTIDOS. INTERPRETE OS DADOS, COMPARE-OS COM A LITERATURA E DISCUTA SUAS IMPLICAÇÕES. ESTA É UMA DAS SEÇÕES MAIS IMPORTANTES E DEVE SER BASTANTE EXTENSA.]
\\subsection{ANÁLISE PRELIMINAR}
[APRESENTE OS RESULTADOS INICIAIS OU DADOS BRUTOS.]
\\subsection{ANÁLISE APROFUNDADA}
[DISCUTA AS DESCOBERTAS MAIS SIGNIFICATIVAS E SUAS CONSEQUÊNCIAS TEÓRICAS E PRÁTICAS.]

\\section{CONCLUSÃO}
[CONTEÚDO DA CONCLUSÃO AQUI. RECAPITULE OS PONTOS PRINCIPAIS DO ARTIGO, REAFIRME A CONTRIBUIÇÃO DO TRABALHO E SUGIRA PESQUISAS FUTURAS.]

\\section*{REFERÊNCIAS}
\\begin{justify}
[ITEM DA BIBLIOGRAFIA 1]

[ITEM DA BIBLIOGRAFIA 2]

[ITEM DA BIBLIOGRAFIA 3]

[ITEM DA BIBLIOGRAFIA 4]

[ITEM DA BIBLIOGRAFIA 5]

[ITEM DA BIBLIOGRAFIA 6]

[ITEM DA BIBLIOGRAFIA 7]

[ITEM DA BIBLIOGRAFIA 8]

[ITEM DA BIBLIOGRAFIA 9]

[ITEM DA BIBLIOGRAFIA 10]

[ITEM DA BIBLIOGRAFIA 11]

[ITEM DA BIBLIOGRAFIA 12]

[ITEM DA BIBLIOGRAFIA 13]

[ITEM DA BIBLIOGRAFIA 14]

[ITEM DA BIBLIOGRAFIA 15]

[ITEM DA BIBLIOGRAFIA 16]

[ITEM DA BIBLIOGRAFIA 17]

[ITEM DA BIBLIOGRAFIA 18]

[ITEM DA BIBLIOGRAFIA 19]

[ITEM DA BIBLIOGRAFIA 20]
\\end{justify}

\\end{document}`,

// TEMPLATE 2: Structure with dedicated Theoretical Framework section
`\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{times}
\\usepackage[brazilian]{babel}
\\usepackage[a4paper, left=3cm, right=2cm, top=3cm, bottom=2cm]{geometry}
\\usepackage{amsmath, amssymb, setspace, url, verbatim}
\\usepackage{ragged2e}
\\usepackage{hyperref}

\\hypersetup{
  pdftitle={[TÍTULO DO ARTIGO AQUI]},
  pdfauthor={SÉRGIO DE ANDRADE, PAULO},
  pdfsubject={[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]},
  pdfkeywords={[PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3], [PALAVRA-CHAVE 4]}
}
\\title{[TÍTULO DO ARTIGO AQUI]}

\\begin{document}
\\onehalfspacing

\\begin{center}
  \\textbf{\\MakeUppercase{[TÍTULO DO ARTIGO AQUI]}}
\\end{center}
\\vspace{1.5cm}
\\begin{flushright}
  SÉRGIO DE ANDRADE, PAULO \\\\
  \\small ORCID: \\url{https://orcid.org/0009-0004-2555-3178}
\\end{flushright}
\\vspace{1.5cm}

\\begin{center}\\textbf{RESUMO}\\end{center}
\\justifying
[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]

\\noindent\\textbf{Palavras-chave:} [PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3], [PALAVRA-CHAVE 4].

\\section{INTRODUÇÃO}
[CONTEÚDO DA INTRODUÇÃO AQUI. Apresente o contexto geral, a relevância do tema, a formulação do problema e os objetivos específicos da pesquisa. A estrutura do restante do artigo deve ser brevemente mencionada.]

\\section{FUNDAMENTAÇÃO TEÓRICA}
[CONTEÚDO DA FUNDAMENTAÇÃO TEÓRICA AQUI. Apresente em profundidade os conceitos, teorias e modelos que formam a base da sua pesquisa. Esta seção deve ser bem desenvolvida para fornecer o alicerce necessário para a metodologia e análise.]
\\subsection{CONCEITOS CHAVE}
[Defina e explique os principais conceitos utilizados no trabalho.]
\\subsection{MODELOS ANALÍTICOS}
[Descreva os modelos ou frameworks teóricos que serão aplicados ou discutidos.]

\\section{TRABALHOS RELACIONADOS}
[CONTEÚDO DOS TRABALHOS RELACIONADOS AQUI. Realize uma revisão crítica da literatura, comparando e contrastando diferentes abordagens e resultados de outros autores, e identificando a lacuna que seu trabalho pretende preencher.]

\\section{METODOLOGIA DE PESQUISA}
[CONTEÚDO DA METODOLOGIA AQUI. Detalhe o desenho da pesquisa, os instrumentos utilizados, os procedimentos de coleta e análise de dados. A clareza e o rigor metodológico são cruciais nesta seção.]

\\section{ANÁLISE E INTERPRETAÇÃO DOS DADOS}
[APRESENTE OS DADOS COLETADOS E A ANÁLISE REALIZADA. Utilize subseções para organizar os diferentes aspectos da análise. Discuta o significado dos resultados à luz da fundamentação teórica.]
\\subsection{RESULTADOS QUANTITATIVOS}
[Apresente análises estatísticas, gráficos ou tabelas, se aplicável.]
\\subsection{RESULTADOS QUALITATIVOS}
[Apresente análises de conteúdo, estudos de caso, ou outras abordagens qualitativas.]

\\section{CONCLUSÕES}
[SINTETIZE AS PRINCIPAIS DESCOBERTAS DO ESTUDO, RETOMANDO OS OBJETIVOS PROPOSTOS NA INTRODUÇÃO. DISCUTA AS LIMITAÇÕES DA PESQUISA E APONTE CAMINHOS PARA TRABALHOS FUTUROS.]

\\section*{REFERÊNCIAS}
\\begin{justify}
[ITEM DA BIBLIOGRAFIA 1]

[ITEM DA BIBLIOGRAFIA 2]

[ITEM DA BIBLIOGRAFIA 3]

[ITEM DA BIBLIOGRAFIA 4]

[ITEM DA BIBLIOGRAFIA 5]

[ITEM DA BIBLIOGRAFIA 6]

[ITEM DA BIBLIOGRAFIA 7]

[ITEM DA BIBLIOGRAFIA 8]

[ITEM DA BIBLIOGRAFIA 9]

[ITEM DA BIBLIOGRAFIA 10]

[ITEM DA BIBLIOGRAFIA 11]

[ITEM DA BIBLIOGRAFIA 12]

[ITEM DA BIBLIOGRAFIA 13]

[ITEM DA BIBLIOGRAFIA 14]

[ITEM DA BIBLIOGRAFIA 15]

[ITEM DA BIBLIOGRAFIA 16]

[ITEM DA BIBLIOGRAFIA 17]

[ITEM DA BIBLIOGRAFIA 18]

[ITEM DA BIBLIOGRAFIA 19]

[ITEM DA BIBLIOGRAFIA 20]
\\end{justify}

\\end{document}`,

// TEMPLATE 3: Separate Results and Discussion
`\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{times}
\\usepackage[brazilian]{babel}
\\usepackage[a4paper, left=3cm, right=2cm, top=3cm, bottom=2cm]{geometry}
\\usepackage{amsmath, amssymb, setspace, url, verbatim}
\\usepackage{ragged2e}
\\usepackage{hyperref}

\\hypersetup{
  pdftitle={[TÍTULO DO ARTIGO AQUI]},
  pdfauthor={SÉRGIO DE ANDRADE, PAULO},
  pdfsubject={[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]},
  pdfkeywords={[PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2]}
}
\\title{[TÍTULO DO ARTIGO AQUI]}

\\begin{document}
\\onehalfspacing

\\begin{center}
  \\textbf{\\MakeUppercase{[TÍTULO DO ARTIGO AQUI]}}
\\end{center}
\\vspace{1.5cm}
\\begin{flushright}
  SÉRGIO DE ANDRADE, PAULO \\\\
  \\small ORCID: \\url{https://orcid.org/0009-0004-2555-3178}
\\end{flushright}
\\vspace{1.5cm}

\\begin{center}\\textbf{RESUMO}\\end{center}
\\justifying
[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]

\\noindent\\textbf{Palavras-chave:} [PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2].

\\section{INTRODUÇÃO}
[CONTEÚDO DA INTRODUÇÃO. Deve ser bem robusto, contextualizando o leitor sobre o tema e a importância da pesquisa.]

\\section{REVISÃO BIBLIOGRÁFICA}
[CONTEÚDO DA REVISÃO. Apresente uma análise aprofundada da literatura existente, mostrando o estado da arte e onde seu trabalho se encaixa.]
\\subsection{ESTADO DA ARTE}
[Descreva as pesquisas mais recentes e relevantes na área.]
\\subsection{LACUNAS E OPORTUNIDADES}
[Identifique claramente o que ainda não foi explorado e como seu trabalho contribui.]

\\section{MATERIAIS E MÉTODOS}
[CONTEÚDO DA METODOLOGIA. Detalhe os materiais, a amostra, os procedimentos e as ferramentas de análise de forma extremamente clara.]

\\section{RESULTADOS}
[APRESENTAÇÃO DOS RESULTADOS. Esta seção deve ser puramente descritiva, apresentando os dados encontrados sem interpretação. Use subseções para cada grupo de resultados.]
\\subsection{RESULTADO EXPERIMENTAL 1}
[Descreva o primeiro conjunto de resultados.]
\\subsection{RESULTADO EXPERIMENTAL 2}
[Descreva o segundo conjunto de resultados.]

\\section{DISCUSSÃO}
[DISCUSSÃO DOS RESULTADOS. Aqui você deve interpretar os resultados apresentados na seção anterior, compará-los com a literatura, discutir suas implicações e explicar suas descobertas.]

\\section{CONSIDERAÇÕES FINAIS}
[CONCLUSÃO DO TRABALHO. Retome a questão de pesquisa, sumarize as conclusões, aponte as limitações e sugira trabalhos futuros.]

\\section*{REFERÊNCIAS}
\\begin{justify}
[ITEM DA BIBLIOGRAFIA 1]

[ITEM DA BIBLIOGRAFIA 2]

[ITEM DA BIBLIOGRAFIA 3]

[ITEM DA BIBLIOGRAFIA 4]

[ITEM DA BIBLIOGRAFIA 5]

[ITEM DA BIBLIOGRAFIA 6]

[ITEM DA BIBLIOGRAFIA 7]

[ITEM DA BIBLIOGRAFIA 8]

[ITEM DA BIBLIOGRAFIA 9]

[ITEM DA BIBLIOGRAFIA 10]

[ITEM DA BIBLIOGRAFIA 11]

[ITEM DA BIBLIOGRAFIA 12]

[ITEM DA BIBLIOGRAFIA 13]

[ITEM DA BIBLIOGRAFIA 14]

[ITEM DA BIBLIOGRAFIA 15]

[ITEM DA BIBLIOGRAFIA 16]

[ITEM DA BIBLIOGRAFIA 17]

[ITEM DA BIBLIOGRAFIA 18]

[ITEM DA BIBLIOGRAFIA 19]

[ITEM DA BIBLIOGRAFIA 20]
\\end{justify}

\\end{document}`,

// TEMPLATE 4: More Subsections for Deeper Detail
`\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{times}
\\usepackage[brazilian]{babel}
\\usepackage[a4paper, left=3cm, right=2cm, top=3cm, bottom=2cm]{geometry}
\\usepackage{amsmath, amssymb, setspace, url, verbatim}
\\usepackage{ragged2e}
\\usepackage{hyperref}

\\hypersetup{
  pdftitle={[TÍTULO DO ARTIGO AQUI]},
  pdfauthor={SÉRGIO DE ANDRADE, PAULO},
  pdfsubject={[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]},
  pdfkeywords={[PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3], [PALAVRA-CHAVE 4], [PALAVRA-CHAVE 5]}
}
\\title={[TÍTULO DO ARTIGO AQUI]}

\\begin{document}
\\onehalfspacing

\\begin{center}
  \\textbf{\\MakeUppercase{[TÍTULO DO ARTIGO AQUI]}}
\\end{center}
\\vspace{1.5cm}
\\begin{flushright}
  SÉRGIO DE ANDRADE, PAULO \\\\
  \\small ORCID: \\url{https://orcid.org/0009-0004-2555-3178}
\\end{flushright}
\\vspace{1.5cm}

\\begin{center}\\textbf{RESUMO}\\end{center}
\\justifying
[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]

\\noindent\\textbf{Palavras-chave:} [PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3], [PALAVRA-CHAVE 4], [PALAVRA-CHAVE 5].

\\section{INTRODUÇÃO}
[CONTEÚDO DA INTRODUÇÃO.]
\\subsection{CONTEXTUALIZAÇÃO}
[Apresente o contexto mais amplo da pesquisa.]
\\subsection{PROBLEMATIZAÇÃO E JUSTIFICATIVA}
[Exponha o problema de pesquisa e por que ele é importante.]
\\subsection{OBJETIVOS}
[Liste o objetivo geral e os objetivos específicos.]

\\section{REFERENCIAL TEÓRICO}
[CONTEÚDO DO REFERENCIAL TEÓRICO. Deve ser uma seção densa e longa.]
\\subsection{TEORIA PRINCIPAL}
[Aprofunde a teoria central que guia o estudo.]
\\subsection{TEORIAS SECUNDÁRIAS}
[Discuta outras teorias que complementam a análise.]
\\subsection{ESTUDOS EMPÍRICOS RELEVANTES}
[Apresente e critique estudos de caso ou pesquisas empíricas anteriores.]

\\section{PROCEDIMENTOS METODOLÓGICOS}
[CONTEÚDO DA METODOLOGIA.]
\\subsection{ABORDAGEM DA PESQUISA}
[Qualitativa, quantitativa ou mista?]
\\subsection{UNIVERSO E AMOSTRA}
[Descreva a população e a amostra estudada.]
\\subsection{COLETA E ANÁLISE DE DADOS}
[Detalhe as técnicas e ferramentas utilizadas.]

\\section{ANÁLISE E DISCUSSÃO DOS RESULTADOS}
[CONTEÚDO DOS RESULTADOS E DISCUSSÃO.]
\\subsection{DESCRIÇÃO DOS DADOS}
[Apresente uma visão geral dos dados coletados.]
\\subsection{INTERPRETAÇÃO DOS ACHADOS}
[Interprete os resultados à luz da teoria.]
\\subsection{IMPLICAÇÕES DOS RESULTADOS}
[Discuta as consequências práticas e teóricas das suas descobertas.]

\\section{CONCLUSÃO}
[SÍNTESE FINAL DO TRABALHO. Retome os principais pontos, reafirme a contribuição, indique limitações e sugestões para o futuro.]

\\section*{REFERÊNCIAS}
\\begin{justify}
[ITEM DA BIBLIOGRAFIA 1]

[ITEM DA BIBLIOGRAFIA 2]

[ITEM DA BIBLIOGRAFIA 3]

[ITEM DA BIBLIOGRAFIA 4]

[ITEM DA BIBLIOGRAFIA 5]

[ITEM DA BIBLIOGRAFIA 6]

[ITEM DA BIBLIOGRAFIA 7]

[ITEM DA BIBLIOGRAFIA 8]

[ITEM DA BIBLIOGRAFIA 9]

[ITEM DA BIBLIOGRAFIA 10]

[ITEM DA BIBLIOGRAFIA 11]

[ITEM DA BIBLIOGRAFIA 12]

[ITEM DA BIBLIOGRAFIA 13]

[ITEM DA BIBLIOGRAFIA 14]

[ITEM DA BIBLIOGRAFIA 15]

[ITEM DA BIBLIOGRAFIA 16]

[ITEM DA BIBLIOGRAFIA 17]

[ITEM DA BIBLIOGRAFIA 18]

[ITEM DA BIBLIOGRAFIA 19]

[ITEM DA BIBLIOGRAFIA 20]
\\end{justify}

\\end{document}`,

// TEMPLATE 5: Case Study Structure
`\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{times}
\\usepackage[brazilian]{babel}
\\usepackage[a4paper, left=3cm, right=2cm, top=3cm, bottom=2cm]{geometry}
\\usepackage{amsmath, amssymb, setspace, url, verbatim}
\\usepackage{ragged2e}
\\usepackage{hyperref}

\\hypersetup{
  pdftitle={[TÍTULO DO ARTIGO AQUI]},
  pdfauthor={SÉRGIO DE ANDRADE, PAULO},
  pdfsubject={[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]},
  pdfkeywords={[PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3]}
}
\\title{[TÍTULO DO ARTIGO AQUI]}

\\begin{document}
\\onehalfspacing

\\begin{center}
  \\textbf{\\MakeUppercase{[TÍTULO DO ARTIGO AQUI]}}
\\end{center}
\\vspace{1.5cm}
\\begin{flushright}
  SÉRGIO DE ANDRADE, PAULO \\\\
  \\small ORCID: \\url{https://orcid.org/0009-0004-2555-3178}
\\end{flushright}
\\vspace{1.5cm}

\\begin{center}\\textbf{RESUMO}\\end{center}
\\justifying
[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]

\\noindent\\textbf{Palavras-chave:} [PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3].

\\section{INTRODUÇÃO}
[CONTEÚDO DA INTRODUÇÃO. Contextualize o estudo de caso, sua relevância e as questões de pesquisa que ele busca responder.]

\\section{REFERENCIAL TEÓRICO E CONCEITUAL}
[BASE TEÓRICA para a análise do estudo de caso. Apresente os conceitos que serão usados para interpretar o caso.]

\\section{METODOLOGIA: O ESTUDO DE CASO}
[METODOLOGIA. Descreva por que o estudo de caso foi escolhido, como o caso foi selecionado, e como os dados foram coletados e analisados.]

\\section{APRESENTAÇÃO DO CASO}
[DESCRIÇÃO DO CASO. Apresente o caso em detalhes, fornecendo todo o contexto necessário para a análise subsequente. Esta seção deve ser rica em detalhes descritivos.]
\\subsection{CONTEXTO HISTÓRICO E ORGANIZACIONAL}
[Descreva o ambiente e a história do caso estudado.]
\\subsection{O FENÔMENO OBSERVADO}
[Detalhe o evento, processo ou situação que é o foco do estudo.]

\\section{ANÁLISE E DISCUSSÃO DO CASO}
[ANÁLISE DO CASO. Aplique o referencial teórico para analisar o caso apresentado. Interprete os eventos e discuta as implicações.]

\\section{CONCLUSÕES E RECOMENDAÇÕES}
[CONCLUSÃO. Sumarize as lições aprendidas com o estudo de caso, discuta a generalização dos achados e forneça recomendações práticas ou teóricas.]

\\section*{REFERÊNCIAS}
\\begin{justify}
[ITEM DA BIBLIOGRAFIA 1]

[ITEM DA BIBLIOGRAFIA 2]

[ITEM DA BIBLIOGRAFIA 3]

[ITEM DA BIBLIOGRAFIA 4]

[ITEM DA BIBLIOGRAFIA 5]

[ITEM DA BIBLIOGRAFIA 6]

[ITEM DA BIBLIOGRAFIA 7]

[ITEM DA BIBLIOGRAFIA 8]

[ITEM DA BIBLIOGRAFIA 9]

[ITEM DA BIBLIOGRAFIA 10]

[ITEM DA BIBLIOGRAFIA 11]

[ITEM DA BIBLIOGRAFIA 12]

[ITEM DA BIBLIOGRAFIA 13]

[ITEM DA BIBLIOGRAFIA 14]

[ITEM DA BIBLIOGRAFIA 15]

[ITEM DA BIBLIOGRAFIA 16]

[ITEM DA BIBLIOGRAFIA 17]

[ITEM DA BIBLIOGRAFIA 18]

[ITEM DA BIBLIOGRAFIA 19]

[ITEM DA BIBLIOGRAFIA 20]
\\end{justify}

\\end{document}`,

// TEMPLATE 6: 7-Section structure for more granularity
`\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{times}
\\usepackage[brazilian]{babel}
\\usepackage[a4paper, left=3cm, right=2cm, top=3cm, bottom=2cm]{geometry}
\\usepackage{amsmath, amssymb, setspace, url, verbatim}
\\usepackage{ragged2e}
\\usepackage{hyperref}

\\hypersetup{
  pdftitle={[TÍTULO DO ARTIGO AQUI]},
  pdfauthor={SÉRGIO DE ANDRADE, PAULO},
  pdfsubject={[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]},
  pdfkeywords={[PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3], [PALAVRA-CHAVE 4]}
}
\\title{[TÍTULO DO ARTIGO AQUI]}

\\begin{document}
\\onehalfspacing

\\begin{center}
  \\textbf{\\MakeUppercase{[TÍTULO DO ARTIGO AQUI]}}
\\end{center}
\\vspace{1.5cm}
\\begin{flushright}
  SÉRGIO DE ANDRADE, PAULO \\\\
  \\small ORCID: \\url{https://orcid.org/0009-0004-2555-3178}
\\end{flushright}
\\vspace{1.5cm}

\\begin{center}\\textbf{RESUMO}\\end{center}
\\justifying
[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]

\\noindent\\textbf{Palavras-chave:} [PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3], [PALAVRA-CHAVE 4].

\\section{APRESENTAÇÃO INICIAL}
[INTRODUÇÃO. Apresente o tema de forma ampla e cativante para o leitor.]

\\section{CONTEXTO DA PESQUISA}
[REVISÃO DA LITERATURA. Detalhe o contexto científico e os trabalhos anteriores que levaram à sua pesquisa.]

\\section{DELINEAMENTO METODOLÓGICO}
[METODOLOGIA. Explique a abordagem e o design da pesquisa de forma clara e justificada.]

\\section{COLETA E PREPARAÇÃO DOS DADOS}
[PROCEDIMENTOS. Descreva como os dados foram coletados, organizados e preparados para a análise.]

\\section{ANÁLISE DOS DADOS}
[RESULTADOS. Apresente a análise dos dados de forma objetiva, usando subseções para organizar as diferentes etapas da análise.]
\\subsection{ANÁLISE DESCRITIVA}
[Estatísticas descritivas ou descrição inicial dos dados.]
\\subsection{ANÁLISE INFERENCIAL}
[Testes de hipótese, modelagem ou outras análises mais profundas.]

\\section{DISCUSSÃO E IMPLICAÇÕES}
[DISCUSSÃO. Conecte seus achados com a literatura e discuta as implicações teóricas e práticas do seu estudo.]

\\section{CONSIDERAÇÕES FINAIS E TRABALHOS FUTUROS}
[CONCLUSÃO. Finalize o artigo com uma síntese forte, reconhecendo limitações e apontando para o futuro.]

\\section*{REFERÊNCIAS}
\\begin{justify}
[ITEM DA BIBLIOGRAFIA 1]

[ITEM DA BIBLIOGRAFIA 2]

[ITEM DA BIBLIOGRAFIA 3]

[ITEM DA BIBLIOGRAFIA 4]

[ITEM DA BIBLIOGRAFIA 5]

[ITEM DA BIBLIOGRAFIA 6]

[ITEM DA BIBLIOGRAFIA 7]

[ITEM DA BIBLIOGRAFIA 8]

[ITEM DA BIBLIOGRAFIA 9]

[ITEM DA BIBLIOGRAFIA 10]

[ITEM DA BIBLIOGRAFIA 11]

[ITEM DA BIBLIOGRAFIA 12]

[ITEM DA BIBLIOGRAFIA 13]

[ITEM DA BIBLIOGRAFIA 14]

[ITEM DA BIBLIOGRAFIA 15]

[ITEM DA BIBLIOGRAFIA 16]

[ITEM DA BIBLIOGRAFIA 17]

[ITEM DA BIBLIOGRAFIA 18]

[ITEM DA BIBLIOGRAFIA 19]

[ITEM DA BIBLIOGRAFIA 20]
\\end{justify}

\\end{document}`,

// TEMPLATE 7: Simple and Direct Structure
`\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{times}
\\usepackage[brazilian]{babel}
\\usepackage[a4paper, left=3cm, right=2cm, top=3cm, bottom=2cm]{geometry}
\\usepackage{amsmath, amssymb, setspace, url, verbatim}
\\usepackage{ragged2e}
\\usepackage{hyperref}

\\hypersetup{
  pdftitle={[TÍTULO DO ARTIGO AQUI]},
  pdfauthor={SÉRGIO DE ANDRADE, PAULO},
  pdfsubject={[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]},
  pdfkeywords={[PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3]}
}
\\title={[TÍTULO DO ARTIGO AQUI]}

\\begin{document}
\\onehalfspacing

\\begin{center}
  \\textbf{\\MakeUppercase{[TÍTULO DO ARTIGO AQUI]}}
\\end{center}
\\vspace{1.5cm}
\\begin{flushright}
  SÉRGIO DE ANDRADE, PAULO \\\\
  \\small ORCID: \\url{https://orcid.org/0009-0004-2555-3178}
\\end{flushright}
\\vspace{1.5cm}

\\begin{center}\\textbf{RESUMO}\\end{center}
\\justifying
[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]

\\noindent\\textbf{Palavras-chave:} [PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3].

\\section{INTRODUÇÃO}
[CONTEÚDO DA INTRODUÇÃO. Apresentação do tema, problema, justificativa e objetivos.]

\\section{FUNDAMENTAÇÃO}
[CONTEÚDO DO REFERENCIAL TEÓRICO. Uma seção robusta combinando revisão de literatura e conceitos teóricos.]
\\subsection{PRINCIPAIS AUTORES E TEORIAS}
[Discuta os autores e teorias seminais na área.]
\\subsection{ESTUDOS RECENTES}
[Analise as contribuições mais atuais para o tema.]

\\section{MÉTODO}
[CONTEÚDO DA METODologia. Descrição clara e concisa do caminho percorrido na pesquisa.]

\\section{ANÁLISE E DISCUSSÃO}
[CONTEÚDO DE RESULTADOS E DISCUSSÃO. Apresente os resultados e imediatamente os discuta em relação à teoria. Esta seção deve ser a mais longa do artigo.]

\\section{CONCLUSÃO}
[CONTEÚDO DA CONCLUSÃO. Síntese final, limitações e sugestões para pesquisas futuras.]

\\section*{REFERÊNCIAS}
\\begin{justify}
[ITEM DA BIBLIOGRAFIA 1]

[ITEM DA BIBLIOGRAFIA 2]

[ITEM DA BIBLIOGRAFIA 3]

[ITEM DA BIBLIOGRAFIA 4]

[ITEM DA BIBLIOGRAFIA 5]

[ITEM DA BIBLIOGRAFIA 6]

[ITEM DA BIBLIOGRAFIA 7]

[ITEM DA BIBLIOGRAFIA 8]

[ITEM DA BIBLIOGRAFIA 9]

[ITEM DA BIBLIOGRAFIA 10]

[ITEM DA BIBLIOGRAFIA 11]

[ITEM DA BIBLIOGRAFIA 12]

[ITEM DA BIBLIOGRAFIA 13]

[ITEM DA BIBLIOGRAFIA 14]

[ITEM DA BIBLIOGRAFIA 15]

[ITEM DA BIBLIOGRAFIA 16]

[ITEM DA BIBLIOGRAFIA 17]

[ITEM DA BIBLIOGRAFIA 18]

[ITEM DA BIBLIOGRAFIA 19]

[ITEM DA BIBLIOGRAFIA 20]
\\end{justify}

\\end{document}`,

// TEMPLATE 8: Review Article Structure
`\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{times}
\\usepackage[brazilian]{babel}
\\usepackage[a4paper, left=3cm, right=2cm, top=3cm, bottom=2cm]{geometry}
\\usepackage{amsmath, amssymb, setspace, url, verbatim}
\\usepackage{ragged2e}
\\usepackage{hyperref}

\\hypersetup{
  pdftitle={[TÍTULO DO ARTIGO AQUI]},
  pdfauthor={SÉRGIO DE ANDRADE, PAULO},
  pdfsubject={[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]},
  pdfkeywords={[PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3], [PALAVRA-CHAVE 4]}
}
\\title={[TÍTULO DO ARTIGO AQUI]}

\\begin{document}
\\onehalfspacing

\\begin{center}
  \\textbf{\\MakeUppercase{[TÍTULO DO ARTIGO AQUI]}}
\\end{center}
\\vspace{1.5cm}
\\begin{flushright}
  SÉRGIO DE ANDRADE, PAULO \\\\
  \\small ORCID: \\url{https://orcid.org/0009-0004-2555-3178}
\\end{flushright}
\\vspace{1.5cm}

\\begin{center}\\textbf{RESUMO}\\end{center}
\\justifying
[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]

\\noindent\\textbf{Palavras-chave:} [PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3], [PALAVRA-CHAVE 4].

\\section{INTRODUÇÃO}
[Introduza o tema da revisão, sua importância e os critérios de seleção da literatura.]

\\section{EVOLUÇÃO HISTÓRICA DO CAMPO}
[Apresente uma perspectiva histórica sobre o desenvolvimento do tema de pesquisa.]

\\section{PRINCIPAIS CORRENTES TEÓRICAS}
[Discuta e compare as principais escolas de pensamento ou abordagens teóricas sobre o tema.]
\\subsection{ABORDAGEM A}
[Detalhe a primeira corrente teórica.]
\\subsection{ABORDAGEM B}
[Detalhe a segunda corrente teórica.]

\\section{ANÁLISE CRÍTICA DA LITERATURA RECENTE}
[Analise os estudos mais recentes (últimos 5-10 anos), identificando tendências, consensos e controvérsias.]

\\section{DEBATES ATUAIS E QUESTÕES EM ABERTO}
[Destaque os principais debates e as perguntas de pesquisa que ainda não foram respondidas.]

\\section{AGENDA DE PESQUISA FUTURA}
[Proponha direções para futuras investigações, sugerindo novos problemas, métodos ou abordagens.]

\\section*{REFERÊNCIAS}
\\begin{justify}
[ITEM DA BIBLIOGRAFIA 1]

[ITEM DA BIBLIOGRAFIA 2]

[ITEM DA BIBLIOGRAFIA 3]

[ITEM DA BIBLIOGRAFIA 4]

[ITEM DA BIBLIOGRAFIA 5]

[ITEM DA BIBLIOGRAFIA 6]

[ITEM DA BIBLIOGRAFIA 7]

[ITEM DA BIBLIOGRAFIA 8]

[ITEM DA BIBLIOGRAFIA 9]

[ITEM DA BIBLIOGRAFIA 10]

[ITEM DA BIBLIOGRAFIA 11]

[ITEM DA BIBLIOGRAFIA 12]

[ITEM DA BIBLIOGRAFIA 13]

[ITEM DA BIBLIOGRAFIA 14]

[ITEM DA BIBLIOGRAFIA 15]

[ITEM DA BIBLIOGRAFIA 16]

[ITEM DA BIBLIOGRAFIA 17]

[ITEM DA BIBLIOGRAFIA 18]

[ITEM DA BIBLIOGRAFIA 19]

[ITEM DA BIBLIOGRAFIA 20]
\\end{justify}

\\end{document}`,

// TEMPLATE 9: Problem-Solution Structure
`\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{times}
\\usepackage[brazilian]{babel}
\\usepackage[a4paper, left=3cm, right=2cm, top=3cm, bottom=2cm]{geometry}
\\usepackage{amsmath, amssymb, setspace, url, verbatim}
\\usepackage{ragged2e}
\\usepackage{hyperref}

\\hypersetup{
  pdftitle={[TÍTULO DO ARTIGO AQUI]},
  pdfauthor={SÉRGIO DE ANDRADE, PAULO},
  pdfsubject={[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]},
  pdfkeywords={[PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3]}
}
\\title={[TÍTULO DO ARTIGO AQUI]}

\\begin{document}
\\onehalfspacing

\\begin{center}
  \\textbf{\\MakeUppercase{[TÍTULO DO ARTIGO AQUI]}}
\\end{center}
\\vspace{1.5cm}
\\begin{flushright}
  SÉRGIO DE ANDRADE, PAULO \\\\
  \\small ORCID: \\url{https://orcid.org/0009-0004-2555-3178}
\\end{flushright}
\\vspace{1.5cm}

\\begin{center}\\textbf{RESUMO}\\end{center}
\\justifying
[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]

\\noindent\\textbf{Palavras-chave:} [PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3].

\\section{DESCRIÇÃO DO PROBLEMA}
[INTRODUÇÃO. Apresente em detalhes o problema que será abordado, sua relevância e as dificuldades associadas a ele.]

\\section{ANÁLISE DE SOLUÇÕES EXISTENTES}
[REVISÃO DA LITERATURA. Discuta as tentativas anteriores de resolver este problema, destacando suas forças e fraquezas.]

\\section{A PROPOSTA DE SOLUÇÃO}
[METODOLOGIA. Apresente sua nova solução, modelo ou algoritmo em detalhes. Esta seção deve ser o coração do artigo.]
\\subsection{ARQUITETURA DA SOLUÇÃO}
[Descreva os componentes da sua proposta.]
\\subsection{FUNDAMENTAÇÃO DA PROPOSTA}
[Explique por que sua proposta é inovadora e teoricamente sólida.]

\\section{VALIDAÇÃO DA PROPOSTA}
[RESULTADOS. Apresente os resultados da aplicação da sua solução. Isso pode incluir experimentos, simulações, provas, etc.]
\\subsection{CENÁRIO DE TESTE}
[Descreva como a solução foi testada.]
\\subsection{ANÁLISE COMPARATIVA}
[Compare o desempenho da sua solução com as existentes.]

\\section{DISCUSSÃO E LIMITAÇÕES}
[DISCUSSÃO. Discuta o que os resultados significam e quais são as limitações da sua proposta.]

\\section{CONCLUSÃO}
[CONCLUSÃO. Sumarize a contribuição do trabalho e aponte direções futuras.]

\\section*{REFERÊNCIAS}
\\begin{justify}
[ITEM DA BIBLIOGRAFIA 1]

[ITEM DA BIBLIOGRAFIA 2]

[ITEM DA BIBLIOGRAFIA 3]

[ITEM DA BIBLIOGRAFIA 4]

[ITEM DA BIBLIOGRAFIA 5]

[ITEM DA BIBLIOGRAFIA 6]

[ITEM DA BIBLIOGRAFIA 7]

[ITEM DA BIBLIOGRAFIA 8]

[ITEM DA BIBLIOGRAFIA 9]

[ITEM DA BIBLIOGRAFIA 10]

[ITEM DA BIBLIOGRAFIA 11]

[ITEM DA BIBLIOGRAFIA 12]

[ITEM DA BIBLIOGRAFIA 13]

[ITEM DA BIBLIOGRAFIA 14]

[ITEM DA BIBLIOGRAFIA 15]

[ITEM DA BIBLIOGRAFIA 16]

[ITEM DA BIBLIOGRAFIA 17]

[ITEM DA BIBLIOGRAFIA 18]

[ITEM DA BIBLIOGRAFIA 19]

[ITEM DA BIBLIOGRAFIA 20]
\\end{justify}

\\end{document}`,

// TEMPLATE 10: Theoretical/Conceptual Paper Structure
`\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{times}
\\usepackage[brazilian]{babel}
\\usepackage[a4paper, left=3cm, right=2cm, top=3cm, bottom=2cm]{geometry}
\\usepackage{amsmath, amssymb, setspace, url, verbatim}
\\usepackage{ragged2e}
\\usepackage{hyperref}

\\hypersetup{
  pdftitle={[TÍTULO DO ARTIGO AQUI]},
  pdfauthor={SÉRGIO DE ANDRADE, PAULO},
  pdfsubject={[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]},
  pdfkeywords={[PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3], [PALAVRA-CHAVE 4]}
}
\\title={[TÍTULO DO ARTIGO AQUI]}

\\begin{document}
\\onehalfspacing

\\begin{center}
  \\textbf{\\MakeUppercase{[TÍTULO DO ARTIGO AQUI]}}
\\end{center}
\\vspace{1.5cm}
\\begin{flushright}
  SÉRGIO DE ANDRADE, PAULO \\\\
  \\small ORCID: \\url{https://orcid.org/0009-0004-2555-3178}
\\end{flushright}
\\vspace{1.5cm}

\\begin{center}\\textbf{RESUMO}\\end{center}
\\justifying
[RESUMO COMPLETO DO ARTIGO, EM UM ÚNICO PARÁGRAFO, VAI AQUI]

\\noindent\\textbf{Palavras-chave:} [PALAVRA-CHAVE 1], [PALAVRA-CHAVE 2], [PALAVRA-CHAVE 3], [PALAVRA-CHAVE 4].

\\section{PROPOSIÇÃO INTRODUTÓRIA}
[INTRODUÇÃO. Apresente o conceito ou a teoria que será desenvolvida no artigo.]

\\section{CONTEXTO FILOSÓFICO E CIENTÍFICO}
[REVISÃO. Discuta as ideias e teorias que levaram à sua proposição.]

\\section{DESENVOLVIMENTO DO NOVO CONCEITO}
[DESENVOLVIMENTO. Elabore a sua nova teoria ou conceito em detalhes. Esta é a seção principal e deve ser densa e bem argumentada.]
\\subsection{AXIOMAS E PRINCÍPIOS}
[Liste os fundamentos da sua teoria.]
\\subsection{COROLÁRIOS E DEDUÇÕES}
[Desenvolva as consequências lógicas da sua teoria.]
\\subsection{COMPARAÇÃO COM MODELOS EXISTENTES}
[Mostre como seu conceito se diferencia e avança em relação às teorias atuais.]

\\section{IMPLICAÇÕES E APLICAÇÕES POTENCIAIS}
[DISCUSSÃO. Explore as possíveis consequências da sua teoria para o campo de estudo e outras áreas.]

\\section{CONCLUSÃO E PERSPECTIVAS FUTURAS}
[CONCLUSÃO. Recapitule a importância do novo conceito e sugira como ele pode ser testado ou desenvolvido no futuro.]

\\section*{REFERÊNCIAS}
\\begin{justify}
[ITEM DA BIBLIOGRAFIA 1]

[ITEM DA BIBLIOGRAFIA 2]

[ITEM DA BIBLIOGRAFIA 3]

[ITEM DA BIBLIOGRAFIA 4]

[ITEM DA BIBLIOGRAFIA 5]

[ITEM DA BIBLIOGRAFIA 6]

[ITEM DA BIBLIOGRAFIA 7]

[ITEM DA BIBLIOGRAFIA 8]

[ITEM DA BIBLIOGRAFIA 9]

[ITEM DA BIBLIOGRAFIA 10]

[ITEM DA BIBLIOGRAFIA 11]

[ITEM DA BIBLIOGRAFIA 12]

[ITEM DA BIBLIOGRAFIA 13]

[ITEM DA BIBLIOGRAFIA 14]

[ITEM DA BIBLIOGRAFIA 15]

[ITEM DA BIBLIOGRAFIA 16]

[ITEM DA BIBLIOGRAFIA 17]

[ITEM DA BIBLIOGRAFIA 18]

[ITEM DA BIBLIOGRAFIA 19]

[ITEM DA BIBLIOGRAFIA 20]
\\end{justify}

\\end{document}`
];