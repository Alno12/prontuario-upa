# Regressão

Suíte que trava os defeitos já corrigidos. Cada caso corresponde a um bug real que
chegou a existir nesta base — se um deles voltar a falhar, o texto do prontuário
voltou a divergir do que o médico registrou.

## Rodar

```sh
npm install playwright     # só na primeira vez
node testes/regressao.js
```

Sai `0` se tudo passar, `1` se algum caso falhar ou houver erro de JavaScript na
página. Não precisa subir servidor: a suíte serve a raiz do repositório sozinha,
numa porta livre, e desliga no fim.

O Chromium é procurado em `/opt/pw-browsers` (o nome da pasta tem o número da
versão e muda a cada atualização, por isso é busca e não caminho fixo). Para
apontar outro binário:

```sh
CHROMIUM_PATH=/caminho/para/chrome node testes/regressao.js
```

## O que cada caso protege

| Caso | Protege contra |
|---|---|
| T1 | Frase entrando sozinha no prontuário. O mnemônico `S`/`O`/`A`/`P` sai sempre; qualquer outra linha, só se o médico registrou |
| T2 | Detalhe de sinal de alerta sobrevivendo à troca de estado e colando na frase de negação (`Nega dor torácica ... - irradia para MSE`) |
| T3 | Comportamento do "Todos ausentes" sobre detalhes já escritos |
| T4 | Achado digitado no detalhe sendo descartado em silêncio por não estar marcado |
| T5 | "Limpar tudo" mostrando Feminino na tela e gerando texto no masculino |
| T6, T7 | Item só-feminino (Gestante) saindo no prontuário de paciente masculino |
| T8 | Concordância de gênero fixa no masculino na linha de nível de consciência |
| T9 | História familiar/cirúrgica sendo assinada como comorbidade do paciente |
| T10 | Botão de copiar falhando em silêncio — o médico cola no sistema o conteúdo anterior da área de transferência |
| T11 | Exemplo pediátrico convidando a um uso que as frases de exame normal (todas adultas) não atendem |
| T12, T13, T14 | Recolher um bloco alterando o texto gerado, ou conteúdo escondido sem aviso |
| T15a–d | Regressões antigas: marcador "Normal", edição manual sobrevivendo à troca de sexo, "Sem acento" e "CAIXA ALTA" |

## Ao mexer na ferramenta

Rode a suíte **inteira**, não só o caso da mudança da vez. Vários defeitos desta
base foram encontrados exatamente por um caso antigo voltando a falhar.
