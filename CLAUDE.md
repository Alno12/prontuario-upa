# prontuario-upa

Ferramenta de registro SOAP para atendimento em UPA/Pronto Atendimento. O médico
preenche um formulário e a prévia à direita monta o texto do prontuário ao vivo,
pronto para copiar e colar no sistema da unidade.

O usuário é médico, não programador. Ele descreve o que quer em termos clínicos
("no exame físico, quando clicar normal, aparecer o texto na caixa a frente") —
traduza para a implementação, não peça especificação técnica.
Converse em português.

## Arquitetura

`prontuario-upa.html` é **um arquivo único**: HTML + CSS + JS inline, sem
framework, sem build, sem dependências. `index.html` só redireciona para ele
(o GitHub Pages serve a raiz). Mantenha assim — o valor da ferramenta está em
abrir no navegador do plantão sem instalar nada.

Nada é persistido. Fechou a aba, os dados somem. Não adicione localStorage sem
o usuário pedir: é prontuário de paciente.

O estado vive todo no objeto `E`, reconstruído por `zerar()`. `render()` redesenha
o formulário inteiro e chama `gerar()`, que monta o texto. Como o formulário é
recriado a cada interação, o foco é restaurado via `data-foco` — preserve esse
atributo em campos novos, senão o cursor pula enquanto se digita.

## Convenções do texto gerado

**Campo vazio não aparece.** Nada de valor padrão que entra sozinho no prontuário:
o médico assina o que está escrito ali, então só sai o que ele de fato marcou ou
digitou. Isso vale para todo bloco — se nenhuma linha de uma seção foi respondida,
a seção inteira some.

A **única** exceção são as quatro letras do mnemônico `S` / `O` / `A` / `P`, que
saem sempre, como esqueleto do registro. Elas não afirmam nada sobre o paciente;
qualquer frase abaixo delas, sim — por isso nenhuma frase pode ser gerada sozinha.
Com o formulário em branco a saída inteira é `S\nO\n\nA\n\nP\n` e mais nada.

**Padrão "Rótulo = valor".** Cada linha sai como `Ausculta cardíaca = BNF R 2T SS`,
não como a frase solta. Vale para exame físico, sinais vitais e antecedentes.

**Concordância de gênero.** O seletor Feminino/Masculino no topo (`E.sexo`) muda
as frases que descrevem o paciente. Hoje duas coisas dependem dele: os quatro
marcadores de "Estado geral" ("Hidratada, corada" / "Hidratado, corado"), montados
ao vivo em `linhaGeral()`, e a frase de nível de consciência ("orientada" /
"orientado"), cuja `n()` consulta `E.sexo`.

Ao adicionar qualquer frase com adjetivo referente ao paciente, use a mesma técnica —
`n()` consultando `E.sexo`, nunca a string fixa. Trocar o sexo depois precisa
atualizar o texto já preenchido: é o que `resyncExameNormal()` faz, para as linhas
ainda marcadas como "Normal" e não editadas à mão. Enquanto nenhuma `n()` consultar
`E.sexo`, esse resync não faz nada visível — foi assim que a frase de consciência
ficou fixa no masculino sem ninguém notar.

**`E.sexo` tem um dono só.** O seletor é pintado por `pintarSexo()` a partir do
estado, chamado dentro de `render()`. Não ajuste `aria-pressed` à mão em handler
nenhum: foi exatamente essa duplicação que fez "Limpar tudo" mostrar Feminino na
tela enquanto o texto saía no masculino.

**Itens que só existem para paciente feminino** ficam em `SO_FEMININO` e passam
por `alertasVis()` / `comorbVis()`. O filtro precisa valer na tela **e** na geração
do texto — filtrar só na tela deixa um "Gestante" marcado antes da troca continuar
saindo no prontuário de um paciente masculino.

**As duas opções da prévia:**
- `CAIXA ALTA` (ligada por padrão) — converte a saída para maiúsculas na hora de
  exibir. Por isso as frases no código são escritas em caixa normal e acentuadas
  corretamente; a conversão é apresentação, não conteúdo.
- `Sem acento` — para sistemas que embaralham acentuação.

## Exame físico: como funciona

Cada linha tem uma caixa de marcar **"Normal"** e um campo de texto:

- Marcar "Normal" preenche o campo com a frase padrão daquela linha, editável
  dali em diante.
- Desmarcar limpa o campo.
- Escrever direto no campo, sem marcar "Normal", é como se registra um achado.
- Nada marcado e nada escrito → a linha não aparece no prontuário.

Editar o campo à mão desliga a marca "Normal" (`E.exameNormal[k] = false`), e a
partir daí o texto é do médico: troca de sexo ou de idade não sobrescreve mais.
Esse detalhe já causou regressão duas vezes no projeto irmão — não o remova ao
mexer no bloco.

"Estado geral" é a exceção: em vez de uma frase única, são quatro marcadores
independentes (Hidratado / Corado / Anictérico / Acianótico), para que desmarcar
um só já registre o achado.

## Silêncio não é "nega": o padrão de negação explícita

Campo vazio já significa "o médico não tocou nisso" — mas não distingue "não
perguntei" de "perguntei e o paciente nega". Comorbidades, alergia a medicamentos,
medicações em uso, tabagismo e etilismo têm um botão **Nega** explícito para essa
segunda situação, e o texto gerado diferencia as duas: campo vazio não aparece,
"Nega" marcado sai como `Rótulo = nega` (ou `Comorbidades: nega`).

O botão Nega é sempre **mutuamente exclusivo** com o dado positivo, mesma lógica já
usada entre o detalhe e o estado dos sinais de alerta:

- **Marcar o dado positivo desliga o Nega.** Marcar qualquer comorbidade desliga
  `E.negaHpp`; escrever em Alergia a medicamentos ou Medicações em uso desliga
  `E.negaAlergias` / `E.negaMeds` (mesmo handler que já desligava o marcador
  "Normal" do exame físico ao editar à mão).
- **Ligar o Nega apaga o dado positivo.** Ativar `E.negaHpp` limpa todas as marcas
  de `COMORB` (inclusive Gestante, e sua IG); ativar `E.negaAlergias` /
  `E.negaMeds` limpa o texto do campo correspondente.

Sem essa exclusão, dava pra ter "Hipertensão" marcada e "Comorbidades: nega" saindo
juntos no mesmo prontuário — a mesma classe de contradição que motivou a regra dos
sinais de alerta.

**Tabagismo e Etilismo não entram nessa exclusão geral.** Ficaram fora da grade de
`COMORB` de propósito: `E.negaHpp` (Nega comorbidades) só cobre a lista médica
(Hipertensão, Diabetes, Dislipidemia, Cardiopatia, Asma, DPOC, Gestante), porque na
prática é comum marcar "Hipertensão" presente e ainda assim precisar registrar "nega
tabagismo, nega etilismo" — uma negação geral não serve pra esse caso. Os dois viram
`E.social{}`, um tri-state próprio (`PRESENTE`/`NEGA`) que reaproveita o mesmo padrão
de pílulas e o mesmo handler genérico `data-tri` dos sinais de alerta.

## Gestante: idade gestacional é detalhe do achado, não campo à parte

A caixa de semanas/dias (`E.gestIdade`) só aparece na tela quando `Gestante` está
marcado, e só entra na saída se pelo menos um dos dois campos tiver conteúdo —
"Gestante" sozinho continua válido, sem IG obrigatória. Desmarcar Gestante limpa
`E.gestIdade`; marcar de novo começa em branco (idade gestacional muda a cada
plantão, não é seguro reaproveitar valor antigo). A limpeza ao trocar de sexo para
Masculino (já existente para `SO_FEMININO`) também zera `E.gestIdade` pelo mesmo
motivo.

## Sinais de alerta: o campo de detalhe descreve um achado presente

O campo ao lado de cada alerta não é uma anotação neutra — ele descreve o achado.
Duas regras saem daí, e as duas existem porque o texto ia parar no lugar errado:

- **Escrever no detalhe marca o alerta como PRESENTE.** Antes, detalhe digitado sem
  marcar nada era descartado em silêncio: o médico via o texto na tela e ele não
  existia no prontuário.
- **Trocar o estado da pílula apaga o detalhe** (`E.alertaDet[chave] = ""`), inclusive
  no "Todos ausentes". Antes, um detalhe escrito com o sinal PRESENTE sobrevivia à
  troca e ia colado na frase de negação — o prontuário dizia
  `Nega dor torácica ... - iniciou há 2h, irradia para MSE`. Inverter o sentido de um
  achado assim é o pior defeito que esta ferramenta pode ter. Não reintroduza a
  "conveniência" de preservar o texto entre estados.

## Blocos recolhíveis

Cada bloco tem um botão de recolher (`data-recolher="<id>"`); o estado mora em
`E.recolhido` e sobrevive ao `render()` e ao "Limpar tudo" — é preferência de
layout do plantão, não dado de paciente.

**Recolher é só visual: nunca altera o texto gerado.** Um bloco recolhido com
conteúdo dentro continua contribuindo para o prontuário, e o cabeçalho avisa com a
etiqueta "contém dados" (`blocoTemConteudo()`). Fazer o recolhimento suprimir texto
transformaria um controle de layout em algo que muda o que o médico assina sem ele
ver — exatamente a classe de defeito que o resto deste documento existe para evitar.

## Copiar

`navigator.clipboard` não existe em todo contexto, e a permissão pode ser negada.
Toda falha precisa virar mensagem visível **e** deixar o texto selecionado para
`Ctrl+C` — há `execCommand("copy")` como segunda tentativa antes de desistir.
O rótulo só vira "Copiado!" quando a cópia de fato ocorreu. Um botão que não reage
faz o médico colar no sistema o que estava na área de transferência antes, que pode
ser o prontuário do paciente anterior.

## Antes de abrir qualquer PR

1. **Validar a sintaxe**: extraia os `<script>` e rode `node --check`.
2. **Testar no navegador de verdade**, com Playwright, servindo o arquivo por
   `python3 -m http.server` **a partir da raiz do repositório** (subir o servidor
   na pasta errada faz todo seletor falhar e parecer bug do código). O binário fica
   em `/opt/pw-browsers/` — confirme o caminho com
   `find /opt/pw-browsers -name chrome`, porque a pasta tem o número da versão
   (`chromium-1194/chrome-linux/chrome`) e muda a cada atualização.
   Verificar o texto gerado em `#saida`, não só se a página carrega.
   Cheque `pageerror` — erro de JS silencioso passa despercebido.
3. **Rodar a regressão**: `node testes/regressao.js` (sobe o próprio servidor, sai
   com código 1 se algum caso falhar). Rode a suíte inteira, não só o caso da
   mudança da vez — e acrescente um caso novo para cada defeito corrigido.
   Várias regressões reais desta base foram pegas exatamente assim.
4. Conferência visual por captura de tela quando o layout mudar.

Nos testes, desligue `CAIXA ALTA` (`await p.click('#optCaixa')`) antes de comparar
strings — senão toda asserção precisa ser em maiúsculas. E re-consulte os
elementos depois de cada clique: `render()` recria o DOM e as referências antigas
ficam órfãs.

## Fluxo de trabalho

Desenvolva em branch, abra PR, **e mande ao usuário um link de preview fixado no
commit** para ele revisar antes de mesclar:

```
https://raw.githack.com/Alno12/prontuario-upa/<sha>/prontuario-upa.html
```

Fixe no SHA, não no nome da branch — o githack cacheia por branch e o usuário
acaba vendo a versão antiga.

Não mescle PR por conta própria: o usuário revisa e mescla. Depois de mesclado,
recomece a branch a partir do `main` atualizado — não empilhe commits novos sobre
histórico já mesclado.

## GitHub Pages

O site sai de `main`, raiz, servido para `https://alno12.github.io/prontuario-upa/`.
O `.nojekyll` é necessário. O deploy não roda sozinho depois de um merge sem push
novo; se precisar forçar uma publicação, um commit vazio no `main` serve de
gatilho — mas peça autorização antes, porque é push direto no `main`.

Se o deploy falhar preso em `deployment_queued` até estourar o tempo, é
infraestrutura do GitHub, não o código: confira https://www.githubstatus.com antes
de investigar o arquivo.

## Armadilha conhecida

Sequências de escape como `\u0001` dentro de strings JS se perdem quando editadas
pela ferramenta de edição — o caractere literal entra no lugar do escape e a
expressão regular quebra silenciosamente. Para essas linhas, edite com um script
Python e confira o resultado com `grep` antes de seguir.
