# Propostas de melhoria

Companheiro de [`auditoria.md`](auditoria.md). Ordenadas por **risco clínico
evitado por hora de trabalho**. As ondas são independentes — dá para parar depois
de qualquer uma.

**Estado:** a Onda 1 e o item P13 foram entregues no PR #1. O restante está aberto.
Estimativas são de implementação + teste, na base atual.

---

## ✅ Onda 1 — Integridade do texto assinado · CONCLUÍDA

| # | Proposta | Corrige |
|---|---|---|
| P1 | Nunca emitir texto que o médico não escreveu | G1 |
| P2 | Limpar o detalhe quando o sinal de alerta muda de estado | G2 |
| P3 | Detalhe digitado marca o alerta como PRESENTE | G3 |
| P4 | Um único ponto de verdade para o sexo (3 partes) | G4, G8 |
| P5 | Concordância de gênero de verdade | G5 |
| P6 | Rótulo de saída fiel ao campo | G6 |
| P7 | Copiar nunca pode falhar em silêncio | G7 |
| P8a | Exemplo da queixa passa a ser adulto | G9 (parcial) |

Entregue junto, fora da lista original: **blocos recolhíveis** (a pedido) e a
correção do marcador "Normal" preso na tela.

### Decisões tomadas na implementação

**P1 — o mnemônico fica.** As quatro letras `S`/`O`/`A`/`P` saem sempre; nenhuma
frase abaixo delas é gerada sozinha. As letras não afirmam nada sobre o paciente.
Formulário em branco gera exatamente `S\nO\n\nA\n\nP\n`.

**P2 — apagar sempre.** O detalhe é apagado em qualquer troca de estado da pílula,
sem exceção de conveniência. Preservar o texto entre estados foi justamente o que
produzia `Nega dor torácica ... - irradia para MSE`.

**P3 — marcar sozinho.** Escrever no detalhe define `PRESENTE`. Coerente com o
exame físico, onde escrever no campo já registra o achado.

> **Efeito colateral a considerar:** escrever no detalhe de um alerta marcado
> **AUSENTE** faz ele virar **PRESENTE**. É a leitura literal das regras P2+P3 e é
> internamente coerente — o campo descreve um achado presente —, mas na prática
> significa que não há como anotar observação num sinal negado. Se esse caso for
> necessário, é ajuste pequeno.

**Blocos recolhíveis — recolher é só visual.** Um bloco recolhido com conteúdo
continua contribuindo para o prontuário, e o cabeçalho avisa com a etiqueta
"contém dados". Fazer o recolhimento suprimir texto transformaria um controle de
layout em algo que muda o que o médico assina sem ele ver — a mesma classe de
defeito que toda a Onda 1 existe para eliminar.

Ganho medido não previsto: recolher os blocos não usados leva a página no celular
de 4.332px para 1.660px, e a prévia de y=3.982 para y=1.255.

---

## ⏳ Onda 2 — Não perder trabalho, e caber no plantão

*≈ 3 horas.*

### P9. Avisar antes de perder o registro · corrige M1
`beforeunload` que só dispara se houver conteúdo preenchido. **Não persiste nada** —
apenas devolve a decisão ao médico antes do navegador descartar tudo. Compatível com
a política de privacidade do projeto, e é a melhoria de maior retorno da onda.

*Esforço: 30 min.*

### P10. Poder ler o que se assina · corrige M2
Trocar os `<input>` do exame físico por campo que cresce com o conteúdo. Hoje 36% do
texto é visível no celular. Assinar o que não se consegue ler é o oposto do objetivo
da ferramenta.

Ao implementar, preservar `data-foco` (senão o cursor pula) e o desligamento de
`E.exameNormal` na edição manual — as duas regressões que o `CLAUDE.md` avisa, e que
os casos `T15a` e `T15b` agora travam.

*Esforço: 1h.*

### P11. Prévia acessível no celular · corrige M3
Barra fixa no rodapé em telas < 1120px, com contador, botão **Copiar** e um botão
**Ver prévia** em painel deslizante.

Versão barata (~20 min): só um botão flutuante "ir para a prévia". Resolve metade do
problema por um sexto do custo. Os blocos recolhíveis já reduziram bastante a
urgência disso.

*Esforço: 1h30 (ou 20 min na versão barata).*

### P12. Foco e teclado · corrige M4, M5
1. Dar `data-foco` aos botões marcadores, como já têm os botões de recolher. Os 90
   TABs viram zero.
2. Dar `id` e `<label for>` (ou `aria-label`) aos campos do exame físico e aos
   detalhes de alerta.

Ganho duplo: preencher o formulário inteiro sem mouse — o modo mais rápido em
plantão — e leitor de tela passando a anunciar os campos.

*Esforço: 45 min.*

---

## Onda 3 — Sustentar o que foi corrigido

### ✅ P13. Suíte de testes no repositório · corrige R1 · CONCLUÍDA
`testes/regressao.js`, 18 casos, um por defeito que já existiu nesta base.

Sobe o próprio servidor HTTP na raiz do repositório e procura o binário do Chromium
em vez de fixar o caminho — os dois passos manuais que faziam o teste falhar por
motivo errado (servidor na pasta errada; número da versão do navegador mudando a
cada atualização).

Validada por injeção de regressão: reintroduzindo o vazamento do detalhe de alerta,
a frase padrão de hipóteses e o masculino fixo na linha de consciência, falham `T2`,
`T1` e `T8` respectivamente. Suíte que não detecta regressão dá falsa confiança.

### ⏳ P14. CI no GitHub Actions · corrige R6
Workflow em PR: extrai o `<script>`, roda `node --check`, roda `testes/regressao.js`
com o Chromium do runner. Impede merge com sintaxe quebrada ou regressão. Cerca de
30 linhas de YAML — e a suíte já existe, então é só ligá-la.

*Esforço: 45 min.*

### ✅ P15. Alinhar o `CLAUDE.md` à realidade · corrige R5 · CONCLUÍDA
Corrigidas as afirmações desatualizadas sobre concordância de gênero e
`resyncExameNormal()`, documentadas as regras novas (detalhe de alerta,
recolhimento, cópia, dono único de `E.sexo`) e o comando real da regressão.

### ⏳ P16. Licença e aviso de finalidade · corrige R2, R3
- `LICENSE` — sugestão **MIT**, se a intenção é que colegas de outras unidades possam
  usar e adaptar. Sem arquivo, ninguém pode legalmente.
- Parágrafo no `README` e no rodapé da ferramenta: auxílio de **redação** de
  prontuário; não é dispositivo médico, não faz apoio à decisão clínica, não
  substitui avaliação; o conteúdo é de responsabilidade do profissional que assina.

*Esforço: 20 min. A escolha da licença é do autor.*

### ⏳ P17. `README` utilizável · corrige R4
Link para a versão publicada, captura de tela, como salvar a página para uso offline,
navegadores testados, e o aviso do P16.

*Esforço: 30 min.*

### ⏳ P18. Limpeza de código · corrige M6, M8–M12, M15, M16
Lote único de baixo risco: remover o `hoje` restante; ordenar as condutas pela lista
canônica; formatar as linhas de "Outras observações"; eliminar linhas em branco
espúrias; extrair o estilo inline repetido 3× para uma classe; acrescentar `'` ao
`esc()`; adicionar favicon embutido em data-URI (mantendo a regra de arquivo único).

*Esforço: 1h.*

---

## Aplicativo offline / PWA

A ferramenta **já funciona offline hoje**: salvar a página (`Ctrl+S`) produz um
arquivo que abre do disco e funciona por inteiro, inclusive o botão Copiar
(verificado em `file://`). Consequência direta de não haver nenhuma requisição
externa.

Um PWA acrescentaria ícone na tela inicial, offline automático e **atualização
automática** — este último é o que o arquivo salvo não dá.

**Custo:** ~3 a 4 horas, e 2 arquivos novos (`manifest.json` e `sw.js`). O service
worker, por exigência do navegador, **não pode** ser embutido no HTML: a regra de
arquivo único vira "arquivo único + 2 de empacotamento", e o `CLAUDE.md` precisaria
refletir isso.

**Risco a levar a sério:** cache velho. Um service worker malfeito congela a versão
antiga no aparelho por semanas. Num aplicativo clínico isso significa manter em
campo um defeito já corrigido. Mitigação: estratégia **rede-primeiro, cache como
reserva** (o app tem 32 KB, buscar a versão nova custa nada quando há internet) e
data da versão visível no rodapé.

**Ordem importa:** PWA é o mecanismo que distribui e *fixa* uma versão nos
aparelhos. Empacotar antes de corrigir multiplica defeitos em vez de corrigi-los —
por isso a Onda 1 veio primeiro.

---

## Propostas registradas com ressalva

**P19 — Destaque de sinais vitais fora de faixa.** Tecnicamente trivial e evitaria
erro de digitação, **mas cruza a fronteira do apoio à decisão clínica**, que é
regulatoriamente distinta de formatação de texto. Se for feito: puramente visual,
nunca alterando o texto gerado, sem sugerir conduta, e com o aviso do P16 já
publicado. Não implementar sem decisão explícita do autor.

**P20 — Rascunho de recuperação em `sessionStorage`.** Contraria a decisão de não
persistir nada — e essa decisão está certa: é dado de paciente em máquina
compartilhada de UPA. O P9 resolve o mesmo problema sem gravar nada.
**Recomendação: não fazer.** Registrado para deixar claro que a alternativa foi
considerada e descartada por escolha, não por esquecimento.

---

## Sequência sugerida para o que resta

| Entrega | Esforço | Efeito |
|---|---|---|
| P14 (CI) | ~45 min | Liga a suíte existente ao fluxo de PR |
| P9–P12 (Onda 2) | ~3h | Deixa de perder trabalho; viabiliza celular e teclado |
| P16–P18 (licença, README, limpeza) | ~2h | Higiene do repositório |
| PWA | ~4h | Só depois do acima estar estável |

O P14 vem primeiro porque é barato e porque a Onda 2 mexe exatamente no bloco que o
`CLAUDE.md` diz já ter causado regressão duas vezes.
