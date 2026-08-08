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

**Padrão "Rótulo = valor".** Cada linha sai como `Ausculta cardíaca = BNF R 2T SS`,
não como a frase solta. Vale para exame físico, sinais vitais e antecedentes.

**Concordância de gênero.** O seletor Feminino/Masculino no topo (`E.sexo`) muda
as frases que descrevem o paciente ("Hidratada, corada" / "Hidratado, corado").
Ao adicionar qualquer frase com adjetivo referente ao paciente, use a mesma
técnica das linhas existentes (função `n()` que consulta `E.sexo`), e lembre que
trocar o sexo depois precisa atualizar o texto já preenchido — é o que
`resyncExameNormal()` faz, para as linhas que ainda estão marcadas como "Normal"
e não foram editadas à mão.

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

## Antes de abrir qualquer PR

1. **Validar a sintaxe**: extraia os `<script>` e rode `node --check`.
2. **Testar no navegador de verdade**, com Playwright
   (`executablePath: '/opt/pw-browsers/chromium'`, servindo o arquivo por
   `python3 -m http.server`). Verificar o texto gerado em `#saida`, não só se a
   página carrega. Cheque `pageerror` — erro de JS silencioso passa despercebido.
3. **Rodar a regressão**: os testes das mudanças anteriores, não só os da atual.
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
