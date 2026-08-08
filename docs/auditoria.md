# Auditoria do repositório

**Realizada em:** 08/08/2026, sobre o commit `f14b250`
**Escopo:** todos os arquivos do repositório, sem exceção, mais o histórico git
**Método:** leitura integral do código seguida de **verificação empírica em navegador**
(Chromium via Playwright, arquivo servido por HTTP). Nenhum achado abaixo é
suposição de leitura: cada um foi reproduzido, e a evidência está transcrita.

A coluna **Situação** reflete o estado após as correções da Onda 1
(PR #1). O texto do achado é preservado como estava no dia da auditoria — é o
registro do que aconteceu e é o que justifica as regras hoje escritas no
`CLAUDE.md` e os casos de `testes/regressao.js`.

---

## Veredito

A ferramenta funcionava, era rápida, não tinha erro de JavaScript no uso normal e
fazia bem o que prometia. A arquitetura de arquivo único foi uma boa decisão e
estava bem executada.

O problema não era a engenharia. **Era que a regra clínica central do projeto
estava quebrada no código.** O `CLAUDE.md` dizia, com todas as letras:

> *"Campo vazio não aparece. Nada de valor padrão que entra sozinho no prontuário:
> o médico assina o que está escrito ali, então só sai o que ele de fato marcou ou
> digitou."*

Abrindo a página em branco, sem tocar em nada, a prévia já continha 45 caracteres
prontos para copiar:

```
S
O

A
- Hipóteses diagnósticas a definir

P
```

Essa linha de hipótese não foi escrita pelo médico. Entrava sozinha, saía no texto
copiado e ia assinada.

Não era caso isolado: foram encontradas **oito situações em que o texto gerado
dizia algo que o médico não escreveu, ou deixava de dizer algo que ele escreveu.**
Num formulário comum isso é defeito de usabilidade. Num gerador de prontuário, é o
produto inteiro falhando na única coisa que precisa acertar.

---

## O que já estava certo

Decisões acertadas e não óbvias, que devem ser preservadas:

- **Zero requisições externas.** Medido com monitor de rede: a página faz
  exatamente **uma** requisição, a dela mesma. Nenhuma fonte de CDN, nenhum
  analytics, nenhum framework. Dado de paciente não vaza nem por acidente, e a
  ferramenta funciona com a internet do plantão caída. É a característica mais
  valiosa do projeto.
- **Nada persistido, de verdade.** Recarregando a página com a queixa preenchida,
  ela volta vazia.
- **Escape de HTML correto.** `esc()` aplicado consistentemente. Testado
  especificamente o alerta que contém aspas — `Cefaleia súbita e intensa ("a pior
  da vida")` — que é o caso capaz de quebrar atributo. Passa limpo.
- **Modo "Sem acento" íntegro.** Os escapes `\u0300-\u036f` estão preservados no
  arquivo (conferido byte a byte com `od -c`) — a armadilha documentada no
  `CLAUDE.md` não se materializou.
- **`Estado geral` era o bloco mais bem feito da aplicação:** quatro marcadores
  independentes com concordância de gênero ao vivo. Virou o modelo para o resto.
- **Restauração de foco por `data-foco`** funciona: dá para digitar sem o cursor
  pular, apesar do `render()` reconstruir o DOM inteiro.
- **Ação destrutiva protegida:** "Limpar tudo" pede confirmação.
- **Sem overflow horizontal no celular** (390px).

---

## Achados graves — o texto assinado não correspondia ao registrado

| # | Achado | Situação |
|---|---|---|
| G1 | Texto padrão entra sozinho no prontuário | ✅ Corrigido |
| G2 | Detalhe de alerta migra para dentro da frase de negação | ✅ Corrigido |
| G3 | Informação digitada é descartada em silêncio | ✅ Corrigido |
| G4 | "Limpar tudo" dessincroniza o sexo do paciente | ✅ Corrigido |
| G5 | Concordância de gênero quebrada no nível de consciência | ✅ Corrigido |
| G6 | "Outros antecedentes" sai rotulado como "Comorbidades" | ✅ Corrigido |
| G7 | O botão "Copiar" pode falhar sem dizer nada | ✅ Corrigido |
| G8 | Nega sinais de gestação em paciente masculino | ✅ Corrigido |
| G9 | "Tudo normal" produz exame de adulto para paciente pediátrico | ⚠️ Parcial |

### G1. Texto padrão entra sozinho no prontuário
Formulário em branco já produzia `- Hipóteses diagnósticas a definir`. Também
aparecia em qualquer registro sem hipóteses preenchidas — inclusive quando só o
desfecho tinha sido preenchido.
**Correção:** a frase saiu; o mnemônico `S`/`O`/`A`/`P` permanece como esqueleto do
registro, porque não afirma nada sobre o paciente. Trava: teste `T1`.

### G2. Detalhe de alerta migra para dentro da frase de negação
Sequência reproduzida: `Dor torácica típica ou opressiva` marcada como **PRESENTE**,
detalhe `iniciou ha 2h, irradia para MSE`, depois mudada para **AUSENTE**.

| momento | texto gerado |
|---|---|
| PRESENTE | `Sinais de alerta presentes = Dor torácica típica ou opressiva - iniciou ha 2h, irradia para MSE.` |
| AUSENTE | `Nega dor torácica típica ou opressiva - iniciou ha 2h, irradia para MSE.` |

O prontuário passava a dizer que o paciente **nega** uma dor que irradia para o
membro superior esquerdo há 2 horas. Inversão do sentido clínico de um dado de
síndrome coronariana.
**Correção:** o detalhe é apagado sempre que a pílula muda de estado. Trava: `T2`.

### G3. Informação digitada é descartada em silêncio
`epistaxe volumosa ha 30min` escrito no detalhe de `Sangramento ativo importante`
**sem** marcar PRESENTE nem AUSENTE não aparecia na saída. O médico digitava um
achado, via o texto no campo, e ele não existia no prontuário.
**Correção:** escrever no detalhe marca o alerta como PRESENTE. Trava: `T4`.

### G4. "Limpar tudo" dessincroniza o sexo do paciente
Com o seletor em **Masculino**, após "Limpar tudo": botão **Feminino** com
`aria-pressed="true"`, rótulo do marcador **"Hidratado"**, texto
`Estado geral = Hidratado`. O médico limpava a tela para o próximo paciente, via
"Feminino" selecionado, e o prontuário saía no masculino.
**Correção:** `E.sexo` passou a ter um dono só — `pintarSexo()` desenha o seletor a
partir do estado, dentro do `render()`; `zerar()` reseta o sexo. Trava: `T5`.

### G5. Concordância de gênero quebrada no nível de consciência
Paciente feminina, marcador "Normal":
`Nível de consciência = Consciente, orientado em tempo e espaço, Glasgow 15`.

Consequência de arquitetura: o `CLAUDE.md` afirmava que as funções `n()`
"consultam `E.sexo`" e que `resyncExameNormal()` atualizava o texto na troca.
**Nenhuma `n()` consultava `E.sexo`** — o resync reatribuía strings idênticas. A
rede de proteção que a documentação descrevia não existia.
**Correção:** a frase passou a consultar `E.sexo`, e o `resyncExameNormal()` deixou
de ser decorativo. Trava: `T8`.

### G6. "Outros antecedentes" sai rotulado como "Comorbidades"
`- mãe com câncer de mama aos 50 anos` no campo **Outros antecedentes** gerava
`Comorbidades: mãe com câncer de mama aos 50 anos`. História familiar virava
comorbidade da paciente. Valia para qualquer antecedente não-comórbido —
cirúrgico, obstétrico, social, familiar.
**Correção:** rótulos separados. Trava: `T9`.

### G7. O botão "Copiar" pode falhar sem dizer nada
Simulada a ausência de `navigator.clipboard` (contexto não seguro: `http://` de
rede interna, `file://` em parte dos navegadores). Rótulo do botão após o clique:
**inalterado**. Erro real lançado e engolido:
`Cannot read properties of undefined (reading 'writeText')`. Não havia `.catch()`.

O médico clicava, o botão não reagia, ele colava no sistema da unidade **o que
estava na área de transferência antes** — possivelmente o prontuário do paciente
anterior.
**Correção:** reserva com `execCommand` e, se ainda assim falhar, aviso visível com
o texto selecionado para `Ctrl+C`. Trava: `T10`.

### G8. Nega sinais de gestação em paciente masculino
Com o seletor em Masculino, "Todos ausentes" gerava
`... Nega [...] sinais de gravidade em gestante.` `E.sexo` não filtrava nem a lista
de alertas nem a de comorbidades — "Gestante" também aparecia como opção para homem.
**Correção:** `SO_FEMININO` + `alertasVis()` / `comorbVis()`, filtrando na tela **e**
na geração do texto. Travas: `T6`, `T7`.

### G9. "Tudo normal" produz exame de adulto para paciente pediátrico ⚠️
Idade `2 meses` + "tudo normal" gerava
`Consciente, orientado em tempo e espaço, Glasgow 15` e
`Giordano negativo`. Um lactente de 2 meses não é orientado em tempo e espaço,
Glasgow 15 em lactente exige escala modificada, e Giordano não se pesquisa nessa
idade. O campo `idade` é coletado e **não influencia nenhuma frase**.

Agravante: o *placeholder* da queixa era `- mãe refere choro excessivo à noite`, um
exemplo **pediátrico** — a ferramenta convidava ao uso em pediatria e entregava
texto normativo exclusivamente adulto.

**Correção parcial:** o exemplo passou a ser adulto (trava: `T11`). **Continua
pendente** o aviso ao detectar idade pediátrica e, se for o caso, um conjunto de
frases pediátricas — decisão clínica, não técnica.

---

## Achados médios — perda de trabalho e barreira de uso

| # | Achado | Situação |
|---|---|---|
| M1 | Fechar ou recarregar a aba apaga tudo, sem aviso | ⏳ Pendente |
| M2 | No celular, só 36% do texto do exame é visível | ⏳ Pendente |
| M3 | No celular, a prévia fica a ~4.000px de rolagem | 🟡 Mitigado |
| M4 | Navegação por teclado impraticável | ⏳ Pendente |
| M5 | Campos do exame físico sem rótulo acessível | ⏳ Pendente |

**M1.** Confirmado: `window.onbeforeunload` é `null`, e a queixa preenchida volta
vazia após reload. Não persistir é decisão correta e deliberada; **não avisar não
é.** Um F5 acidental apaga um registro completo em plena madrugada.

**M2.** Medido em 390px, campo `Abdome` com o texto normal padrão: **214px visíveis
de 599px de texto — 36%.** O médico assina uma frase que não consegue ler inteira.
Remedido após a Onda 1: inalterado.

**M3.** Página de 4.332px; prévia começa em y=3.982 — ~10 telas de rolagem até o
botão de copiar. **Mitigado** pelos blocos recolhíveis: recolhendo o que não se usa,
a página cai para 1.660px e a prévia sobe para y=1.255. Continua ruim no estado
padrão.

**M4.** Após clicar num marcador do bloco Conduta, o foco vai para o `<body>` e são
necessários **90 TABs** para alcançar o marcador seguinte do mesmo bloco (eram 83
na auditoria original; subiu porque os botões de recolher acrescentaram 7 elementos
focáveis). Os botões de recolher **têm** `data-foco` e preservam o foco corretamente
— é o modelo a estender aos demais.

**M5.** Campo de Ausculta cardíaca: sem `id`, sem `aria-label`, sem `<label>` — só
*placeholder*, que some ao digitar. Leitor de tela anuncia campo sem identificação.

---

## Achados menores

| # | Achado | Situação |
|---|---|---|
| M6 | Código morto (`hoje`, `nB`) | 🟡 Parcial — `nB` removido, `hoje` permanece |
| M7 | `resyncExameNormal()` inócua na prática | ✅ Corrigido junto com G5 |
| M8 | Ordem das condutas segue o clique, não a lista | ⏳ Pendente |
| M9 | "Outras observações" do exame sem formatação | ⏳ Pendente |
| M10 | Linhas em branco espúrias na saída | ⏳ Pendente |
| M11 | Estilo inline idêntico repetido 3× | ⏳ Pendente |
| M12 | `minusc()` inútil sob CAIXA ALTA (padrão) | ⏳ Pendente |
| M13 | Frase de negação com ~450 caracteres corridos | ⏳ Pendente |
| M14 | `##` markdown sai literal no texto | ❓ Questão em aberto, pode ser intencional |
| M15 | `esc()` não escapa aspa simples | ⏳ Pendente — hoje inofensivo, armadilha latente |
| M16 | Favicon ausente → 404 a cada carregamento | ⏳ Pendente |
| M17 | `index.html` usa meta-refresh | ⏳ Pendente |

Além disso, **encontrado durante os testes da Onda 1** e corrigido no mesmo PR:
editar um campo do exame à mão desligava o marcador "Normal" internamente, mas o
botão continuava marcado na tela — exibindo "Normal ✓" ao lado de um achado
alterado. Defeito anterior às mudanças (confirmado em `git show HEAD:`).
Trava: `T15a`.

---

## Repositório e processo

| # | Achado | Situação |
|---|---|---|
| R1 | Zero testes automatizados | ✅ Corrigido — `testes/regressao.js`, 18 casos |
| R2 | Sem `LICENSE` | ⏳ Pendente |
| R3 | Sem aviso de finalidade (não é dispositivo médico) | ⏳ Pendente |
| R4 | `README.md` raso | ⏳ Pendente |
| R5 | `CLAUDE.md` com afirmações desatualizadas | ✅ Corrigido |
| R6 | Sem CI e sem `.gitignore` | ⏳ Pendente |
| R7 | Histórico git limpo | Sem ressalva |
| R8 | `.nojekyll` correto | Sem ressalva |

**R1** era a contradição mais séria do processo: o `CLAUDE.md` exigia *"rodar a
regressão: os testes das mudanças anteriores"* — e esses testes não existiam. O
procedimento documentado era impossível de executar, e a proteção que prometia era
ilusória. Os testes escritos durante a auditoria encontraram 8 defeitos reais numa
tarde.

**R5:** documentação que descreve proteção inexistente é pior que documentação
ausente — induz quem for mexer a confiar numa rede que não está lá.

---

## Segurança e privacidade

Sem vulnerabilidade explorável. Não há entrada de rede, não há `eval`, não há
`innerHTML` com dado de usuário sem escape, não há armazenamento. A superfície de
ataque é essencialmente nula, e isso é mérito direto da arquitetura escolhida.

Duas ressalvas de baixo risco:

- **Recuperação de sessão do navegador.** `autocomplete="off"` está nos campos de
  identificação, mas a restauração pós-travamento do Chrome pode reter valores de
  formulário independentemente disso. Fora do controle da aplicação — vale a
  orientação de fechar a aba em máquina compartilhada.
- **Sem CSP.** Uma meta-tag restritiva tornaria explícito que a página não carrega
  nada externo. Endurecimento opcional, não correção de falha.

---

## Sobre o método

Foram levantadas 8 hipóteses de defeito antes de testar. **Sete se confirmaram; uma
foi descartada** — a suspeita de que a prévia perdia a posição de rolagem a cada
tecla digitada não se sustentou (`scrollTop` medido antes e depois: 66 → 66). Fica
registrada porque uma auditoria que só lista o que deu certo esconde o quanto foi
verificado.

Os demais achados vieram de rodadas seguintes de teste sobre o mesmo arquivo.
