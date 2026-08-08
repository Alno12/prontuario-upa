// Suíte de regressão Playwright para prontuario-upa.html
// Não edita o repositório — só lê a página servida em localhost.
"use strict";
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

// A suíte sobe o próprio servidor na raiz do repositório. Servir da pasta errada
// faz todo seletor falhar e parecer bug do código — esse passo manual já custou
// tempo, então some daqui.
const RAIZ = path.resolve(__dirname, "..");
let URL = "";

function servidor() {
  const tipos = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
    const arq = path.join(RAIZ, rel);
    if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) {
      res.writeHead(404); return res.end("nao encontrado");
    }
    res.writeHead(200, { "content-type": tipos[path.extname(arq)] || "application/octet-stream" });
    fs.createReadStream(arq).pipe(res);
  });
  return new Promise(ok => srv.listen(0, "127.0.0.1", () => ok(srv)));
}

// O binário do Chromium tem o número da versão no caminho e muda a cada
// atualização; procura em vez de fixar. Sem achar, usa o do próprio Playwright.
function acharChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    for (const d of fs.readdirSync(base)) {
      if (!/^chromium-/.test(d)) continue;
      const c = path.join(base, d, "chrome-linux", "chrome");
      if (fs.existsSync(c)) return c;
    }
  } catch (e) { /* usa o padrão do Playwright */ }
  return undefined;
}

const resultados = []; // {id, desc, pass, observado}
const jsErrors = [];   // pageerror
const consoleErrors = []; // console type=error

function reg(id, desc, pass, observado) {
  resultados.push({ id, desc, pass, observado });
  const tag = pass ? "PASS" : "FALHA";
  console.log(`[${tag}] ${id} — ${desc}`);
  console.log(`       observado: ${JSON.stringify(observado)}`);
}

function attachDiagnostics(p, tag) {
  p.on("pageerror", (err) => {
    jsErrors.push({ tag, err: String(err && err.stack || err) });
    console.log(`  !! pageerror (${tag}): ${err}`);
  });
  p.on("console", (msg) => {
    if (msg.type() === "error") {
      // pedido automático de favicon do navegador, não é erro da página
      const origem = (msg.location() && msg.location().url) || "";
      if (/favicon\.ico/.test(msg.text()) || /favicon\.ico/.test(origem)) return;
      consoleErrors.push({ tag, text: msg.text() });
      console.log(`  !! console.error (${tag}): ${msg.text()}`);
    }
  });
  p.on("dialog", (d) => d.accept());
}

async function freshPage(browser, tag) {
  const p = await browser.newPage();
  attachDiagnostics(p, tag);
  await p.goto(URL);
  return p;
}

async function desligarCaixaAlta(p) {
  await p.click("#optCaixa");
}

async function main() {
  const srv = await servidor();
  URL = `http://127.0.0.1:${srv.address().port}/prontuario-upa.html`;
  console.log(`servindo ${RAIZ} em ${URL}\n`);
  const browser = await chromium.launch({ executablePath: acharChromium(), headless: true });

  // ---------- T1 ----------
  {
    const p = await freshPage(browser, "T1");
    await desligarCaixaAlta(p);
    const saida = await p.locator("#saida").textContent();
    const temSOAP = /(^|\n)S(\n|$)/.test(saida) && /(^|\n)O(\n|$)/.test(saida) &&
      /(^|\n)A(\n|$)/.test(saida) && /(^|\n)P(\n|$)/.test(saida);
    const semHipoteseFake = !saida.includes("Hipóteses diagnósticas a definir");
    const pass = temSOAP && semHipoteseFake;
    reg("T1", "Formulário em branco: SOAP presente, sem hipótese fake",
      pass, { temSOAP, semHipoteseFake, saida });
    await p.close();
  }

  // ---------- T2 ----------
  {
    const p = await freshPage(browser, "T2");
    await desligarCaixaAlta(p);
    const alerta = "Dor torácica típica ou opressiva";
    await p.locator(`.pil[data-tri="alertas"][data-key="${alerta}"][data-v="PRESENTE"]`).click();
    await p.locator(`input[data-par="alertaDet"][data-key="${alerta}"]`).fill("iniciou ha 2h");
    await p.locator(`.pil[data-tri="alertas"][data-key="${alerta}"][data-v="AUSENTE"]`).click();
    const detValor = await p.locator(`input[data-par="alertaDet"][data-key="${alerta}"]`).inputValue();
    const saida = await p.locator("#saida").textContent();
    const negaLine = (saida.split("\n").find(l => l.startsWith("Nega ")) || "");
    const detVazio = detValor === "";
    const semDetalheNaLinha = !negaLine.includes("iniciou ha 2h");
    const pass = detVazio && semDetalheNaLinha;
    reg("T2", "PRESENTE+detalhe -> AUSENTE limpa o detalhe",
      pass, { detValor, negaLine, saida });
    await p.close();
  }

  // ---------- T3 ----------
  {
    const p = await freshPage(browser, "T3");
    await desligarCaixaAlta(p);
    const alertaMarcado = "Dor torácica típica ou opressiva";
    const outroAlerta = "Dispneia importante / SatO2 baixa";
    await p.locator(`.pil[data-tri="alertas"][data-key="${alertaMarcado}"][data-v="PRESENTE"]`).click();
    await p.locator(`input[data-par="alertaDet"][data-key="${alertaMarcado}"]`).fill("iniciou ha 2h");
    await p.locator(`[data-acao="todosAusentes"]`).click();

    const marcadoPresenteAria = await p.locator(`.pil[data-tri="alertas"][data-key="${alertaMarcado}"][data-v="PRESENTE"]`).getAttribute("aria-pressed");
    const marcadoDet = await p.locator(`input[data-par="alertaDet"][data-key="${alertaMarcado}"]`).inputValue();
    const outroAusenteAria = await p.locator(`.pil[data-tri="alertas"][data-key="${outroAlerta}"][data-v="AUSENTE"]`).getAttribute("aria-pressed");
    const outroDet = await p.locator(`input[data-par="alertaDet"][data-key="${outroAlerta}"]`).inputValue();
    const saida = await p.locator("#saida").textContent();

    // Observação (não há um único "esperado" fechado no enunciado — reportamos o comportamento real)
    const alertaMarcadoPreservado = marcadoPresenteAria === "true" && marcadoDet === "iniciou ha 2h";
    const outrosViraramAusentes = outroAusenteAria === "true" && outroDet === "";
    reg("T3", "PRESENTE+detalhe, depois 'Todos ausentes' — observação do comportamento",
      true, {
        alertaMarcado: { presenteAria: marcadoPresenteAria, detalhe: marcadoDet, preservado: alertaMarcadoPreservado },
        outroAlerta: { ausenteAria: outroAusenteAria, detalhe: outroDet, viraAusente: outrosViraramAusentes },
        saida
      });
    await p.close();
  }

  // ---------- T4 ----------
  {
    const p = await freshPage(browser, "T4");
    await desligarCaixaAlta(p);
    const alerta = "Rebaixamento do nível de consciência";
    await p.locator(`input[data-par="alertaDet"][data-key="${alerta}"]`).fill("sonolento desde manha");
    const presenteAria = await p.locator(`.pil[data-tri="alertas"][data-key="${alerta}"][data-v="PRESENTE"]`).getAttribute("aria-pressed");
    const saida = await p.locator("#saida").textContent();
    const secLine = saida.includes("Sinais de alerta presentes") && saida.includes("sonolento desde manha");
    const pass = presenteAria === "true" && secLine;
    reg("T4", "Digitar no detalhe de alerta não marcado ativa PRESENTE",
      pass, { presenteAria, saidaContemTrecho: secLine, saida });
    await p.close();
  }

  // ---------- T5 ----------
  {
    const p = await freshPage(browser, "T5");
    await desligarCaixaAlta(p);
    await p.locator(`#sexo button[data-s="M"]`).click();
    await p.locator(`[data-map="geralCk"][data-key="hidratado"]`).click();
    await p.locator("#btnLimpar").click();
    // dialog já aceito automaticamente pelo handler global

    const femPressed = await p.locator(`#sexo button[data-s="F"]`).getAttribute("aria-pressed");
    await p.locator(`[data-map="geralCk"][data-key="hidratado"]`).click();
    const saida = await p.locator("#saida").textContent();
    const temHidratada = saida.includes("Hidratada");
    const pass = femPressed === "true" && temHidratada;
    reg("T5", "Limpar tudo restaura sexo Feminino (tela e texto)",
      pass, { femPressed, temHidratada, saida });
    await p.close();
  }

  // ---------- T6 ----------
  {
    const p = await freshPage(browser, "T6");
    await desligarCaixaAlta(p);
    await p.locator(`#sexo button[data-s="M"]`).click();
    const gestanteToggleCount = await p.locator(`[data-map="hpp"][data-key="Gestante"]`).count();
    const alertaGestanteCount = await p.locator(`.rot-alerta:has-text("Sinais de gravidade em gestante")`).count();
    await p.locator(`[data-acao="todosAusentes"]`).click();
    const saida = await p.locator("#saida").textContent();
    const semGestante = !/gestante/i.test(saida);
    const pass = gestanteToggleCount === 0 && alertaGestanteCount === 0 && semGestante;
    reg("T6", "Sexo Masculino: toggle e alerta de gestante somem do DOM e do texto",
      pass, { gestanteToggleCount, alertaGestanteCount, semGestante, saida });
    await p.close();
  }

  // ---------- T7 ----------
  {
    const p = await freshPage(browser, "T7");
    await desligarCaixaAlta(p);
    await p.locator(`[data-map="hpp"][data-key="Gestante"]`).click();
    let saida = await p.locator("#saida").textContent();
    const temGestanteAntes = saida.includes("Gestante");
    await p.locator(`#sexo button[data-s="M"]`).click();
    saida = await p.locator("#saida").textContent();
    const semGestanteDepois = !saida.includes("Gestante");
    const pass = temGestanteAntes && semGestanteDepois;
    reg("T7", "Marcar Gestante (F) e trocar para M remove do texto",
      pass, { temGestanteAntes, semGestanteDepois, saida });
    await p.close();
  }

  // ---------- T8 ----------
  {
    const p = await freshPage(browser, "T8");
    await desligarCaixaAlta(p);
    await p.locator(`[data-normal="consc"]`).click();
    let saida = await p.locator("#saida").textContent();
    const temOrientadaFem = saida.includes("orientada em tempo");
    await p.locator(`#sexo button[data-s="M"]`).click();
    saida = await p.locator("#saida").textContent();
    const temOrientadoMasc = saida.includes("orientado em tempo");
    const pass = temOrientadaFem && temOrientadoMasc;
    reg("T8", "Concordância de gênero na linha de consciência ao trocar sexo",
      pass, { temOrientadaFem, temOrientadoMasc, saida });
    await p.close();
  }

  // ---------- T9 ----------
  {
    const p = await freshPage(browser, "T9");
    await desligarCaixaAlta(p);
    await p.locator("#i_hppTxt").fill("- mãe com câncer de mama");
    let saida = await p.locator("#saida").textContent();
    const temOutrosAntec = saida.includes("Outros antecedentes: mãe com câncer de mama");
    const semComorbFake = !saida.includes("Comorbidades: mãe com câncer");
    await p.locator(`[data-map="hpp"][data-key="Diabetes"]`).click();
    saida = await p.locator("#saida").textContent();
    const temComorbDiabetes = saida.includes("Comorbidades: Diabetes");
    const temOutrosAntecAinda = saida.includes("Outros antecedentes: mãe com câncer de mama");
    const duasLinhasSeparadas = temComorbDiabetes && temOutrosAntecAinda;
    const pass = temOutrosAntec && semComorbFake && duasLinhasSeparadas;
    reg("T9", "Outros antecedentes (hppTxt) vs Comorbidades — linhas separadas",
      pass, { temOutrosAntec, semComorbFake, temComorbDiabetes, temOutrosAntecAinda, saida });
    await p.close();
  }

  // ---------- T10 ----------
  {
    const p = await freshPage(browser, "T10");
    await desligarCaixaAlta(p);
    // o app tem DOIS caminhos de cópia: navigator.clipboard e, se falhar, execCommand.
    // Para exercitar a mensagem de erro é preciso derrubar os dois.
    await p.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { get: () => undefined, configurable: true });
      document.execCommand = () => false;
    });
    const antes = await p.locator("#btnCopiar").textContent();
    await p.locator("#btnCopiar").click();
    await p.waitForTimeout(300);
    const depois = await p.locator("#btnCopiar").textContent();
    const mudou = depois.trim() !== antes.trim();
    const temCtrlC = depois.includes("Ctrl+C");
    const pass = mudou && temCtrlC;
    reg("T10", "Sem Clipboard API, botão copiar deve indicar Ctrl+C",
      pass, { antes, depois, mudou, temCtrlC, houvePageError: jsErrors.some(e => e.tag === "T10") });
    await p.close();
  }

  // ---------- T11 ----------
  {
    const p = await freshPage(browser, "T11");
    await desligarCaixaAlta(p);
    const ph = await p.locator("#i_queixa").getAttribute("placeholder");
    const semChoroExcessivo = !ph.includes("choro excessivo");
    reg("T11", "Placeholder de #i_queixa não é mais o exemplo pediátrico",
      semChoroExcessivo, { placeholderAtual: ph });
    await p.close();
  }

  // ---------- T12 ----------
  {
    const p = await freshPage(browser, "T12");
    await desligarCaixaAlta(p);
    await p.locator("#i_queixa").fill("- teste");
    const saidaAntes = await p.locator("#saida").textContent();
    await p.locator(`[data-recolher="queixa"]`).click();

    const secao = p.locator('section.bloco:has([data-recolher="queixa"])');
    const corpoVisivel = await secao.locator(".corpo").isVisible();
    const ariaExpanded = await p.locator(`[data-recolher="queixa"]`).getAttribute("aria-expanded");
    const saidaDepois = await p.locator("#saida").textContent();
    const saidaIgual = saidaAntes === saidaDepois;
    const temEtiqueta = await secao.locator(".tag-cheio").count();

    const pass = corpoVisivel === false && ariaExpanded === "false" && saidaIgual && temEtiqueta === 1;
    reg("T12", "Recolher bloco 'queixa' é só visual (não muda a saída) e mostra etiqueta",
      pass, { corpoVisivel, ariaExpanded, saidaIgual, temEtiqueta, saidaAntes, saidaDepois });
    await p.close();
  }

  // ---------- T13 ----------
  {
    const p = await freshPage(browser, "T13");
    await desligarCaixaAlta(p);
    await p.locator(`[data-recolher="vitais"]`).click();
    const secao = p.locator('section.bloco:has([data-recolher="vitais"])');
    const temEtiqueta = await secao.locator(".tag-cheio").count();
    const pass = temEtiqueta === 0;
    reg("T13", "Recolher bloco vazio (vitais) não mostra etiqueta 'contém dados'",
      pass, { temEtiqueta });
    await p.close();
  }

  // ---------- T14 ----------
  {
    const p = await freshPage(browser, "T14");
    await desligarCaixaAlta(p);
    await p.locator(`[data-recolher="queixa"]`).click();
    await p.locator(`[data-normal="consc"]`).click(); // dispara novo render
    const secao = p.locator('section.bloco:has([data-recolher="queixa"])');
    const classeSecao = await secao.getAttribute("class");
    const ariaExpanded = await p.locator(`[data-recolher="queixa"]`).getAttribute("aria-expanded");
    const corpoVisivel = await secao.locator(".corpo").isVisible();
    const pass = /fechado/.test(classeSecao) && ariaExpanded === "false" && corpoVisivel === false;
    reg("T14", "Bloco 'queixa' recolhido permanece recolhido após outro render",
      pass, { classeSecao, ariaExpanded, corpoVisivel });
    await p.close();
  }

  // ---------- T15 ----------
  // (a) e (b) — mesma sessão, encadeadas
  {
    const p = await freshPage(browser, "T15ab");
    await desligarCaixaAlta(p);
    await p.locator(`[data-normal="abdome"]`).click();
    const ariaAntesEdicao = await p.locator(`[data-normal="abdome"]`).getAttribute("aria-pressed");
    await p.locator(`input[data-par="exameTxt"][data-key="abdome"]`).fill("abdome distendido");
    const ariaDepoisEdicao = await p.locator(`[data-normal="abdome"]`).getAttribute("aria-pressed");
    const passA = ariaDepoisEdicao === "false";
    reg("T15a", "Editar campo à mão desliga o marcador 'Normal' (aria-pressed=false)",
      passA, { ariaAntesEdicao, ariaDepoisEdicao });

    await p.locator(`#sexo button[data-s="M"]`).click();
    const valorCampoAbdomeApósTroca = await p.locator(`input[data-par="exameTxt"][data-key="abdome"]`).inputValue();
    const passB = valorCampoAbdomeApósTroca === "abdome distendido";
    reg("T15b", "Trocar sexo não sobrescreve texto editado à mão",
      passB, { valorCampoAbdomeApósTroca });
    await p.close();
  }

  // (c) — cenário próprio
  {
    const p = await freshPage(browser, "T15c");
    await desligarCaixaAlta(p);
    await p.locator(`[data-acao="resetExame"]`).click(); // "tudo normal"
    await p.locator("#optAcento").click(); // Sem acento
    const saida = await p.locator("#saida").textContent();
    const semAcentos = !/[áàâãéêíóôõúç]/i.test(saida);
    reg("T15c", "'Sem acento' com exame normal preenchido remove acentuação da saída",
      semAcentos, { saida });
    await p.close();
  }

  // (d) — CAIXA ALTA permanece ligada (não desligamos aqui de propósito)
  {
    const p = await freshPage(browser, "T15d");
    await p.locator(`[data-acao="resetExame"]`).click();
    await p.locator("#i_queixa").fill("- dor no peito");
    const saida = await p.locator("#saida").textContent();
    const todaMaiuscula = saida === saida.toUpperCase();
    reg("T15d", "CAIXA ALTA ligada (padrão) deixa a saída toda em maiúsculas",
      todaMaiuscula, { saida });
    await p.close();
  }

  await browser.close();
  srv.close();

  // ---------- RESUMO ----------
  console.log("\n===================== RESUMO =====================");
  let pass = 0, fail = 0;
  for (const r of resultados) {
    console.log(`${r.pass ? "PASS " : "FALHA"} — ${r.id}: ${r.desc}`);
    if (r.pass) pass++; else fail++;
  }
  console.log(`\nTotal: ${resultados.length} | PASS: ${pass} | FALHA: ${fail}`);
  console.log(`Erros JS (pageerror): ${jsErrors.length}`);
  jsErrors.forEach(e => console.log(`  - [${e.tag}] ${e.err}`));
  console.log(`Erros de console: ${consoleErrors.length}`);
  consoleErrors.forEach(e => console.log(`  - [${e.tag}] ${e.text}`));
  console.log("====================================================");

  process.exit(fail > 0 || jsErrors.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("ERRO FATAL NA SUÍTE:", e);
  process.exit(2);
});
