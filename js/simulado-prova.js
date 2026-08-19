/* simulado-prova.js
 * Simulado geral com 20 questões, uma por vez.
 * Coloque em: js/simulado-prova.js
 */

const INDEX_URL = "./data/index.json";
const TOTAL_QUESTOES = 20;

let estado = criarEstado();

function criarEstado() {
  return {
    questoes: [],
    indice: 0,
    acertos: 0,
    respondida: false,
    respostas: []
  };
}

export async function iniciarSimuladoProva({
  container,
  aoFinalizar = () => {},
  quantidade = TOTAL_QUESTOES
}) {
  if (!container) {
    throw new Error("O simulado precisa de um elemento container.");
  }

  container.innerHTML = `
    <section class="card simulado-carregando">
      <p>Preparando seu simulado...</p>
      <small>Carregando questões das matérias disponíveis.</small>
    </section>
  `;

  try {
    const todas = await carregarTodasAsQuestoes();

    if (todas.length === 0) {
      throw new Error("Nenhuma questão foi encontrada.");
    }

    const quantidadeFinal = Math.min(quantidade, todas.length);

    estado = {
      ...criarEstado(),
      questoes: embaralhar(todas).slice(0, quantidadeFinal)
    };

    renderizarQuestao(container, aoFinalizar);
  } catch (erro) {
    renderizarErro(container, erro);
  }
}

async function carregarTodasAsQuestoes() {
  const catalogo = await carregarJson(INDEX_URL);

  if (!Array.isArray(catalogo.conteudos)) {
    throw new Error("O index.json não possui a lista de conteúdos.");
  }

  const itens = catalogo.conteudos.filter(item => {
    return item.ativo !== false && (item.tipo === "quiz" || !item.tipo);
  });

  const resultados = await Promise.all(
    itens.map(async item => {
      try {
        const conteudo = await carregarJson(`./data/${item.arquivo}`);

        return (conteudo.questoes || []).map(questao => ({
          ...questao,
          disciplinaId: item.id,
          disciplinaNome: item.nome,
          semana: item.semana
        }));
      } catch (erro) {
        console.warn(`Questionário ignorado: ${item.arquivo}`, erro);
        return [];
      }
    })
  );

  return resultados.flat();
}

function renderizarQuestao(container, aoFinalizar) {
  const questao = estado.questoes[estado.indice];
  const numero = estado.indice + 1;
  const total = estado.questoes.length;
  const percentual = Math.round((numero / total) * 100);

  estado.respondida = false;

  container.innerHTML = `
    <section class="simulado-prova">
      <header class="simulado-cabecalho">
        <div>
          <p class="eyebrow">Simulado de prova</p>
          <h1>Questão ${numero} de ${total}</h1>
        </div>
        <button class="button-secondary" data-acao="sair">Sair</button>
      </header>

      <div class="simulado-barra" aria-label="Progresso">
        <span style="width: ${percentual}%"></span>
      </div>

      <article class="card simulado-card-questao">
        <div class="simulado-identificacao">
          <span>${escaparHTML(questao.disciplinaNome)}</span>
          <span>${escaparHTML(questao.tema || "Revisão geral")}</span>
        </div>

        <p class="questao-numero">Questão ${numero}</p>
        <h2>${escaparHTML(questao.enunciado)}</h2>

        <div class="alternativas simulado-opcoes">
          ${questao.alternativas.map((alternativa, indice) => `
            <button
              class="alternativa"
              data-indice="${indice}"
              type="button"
            >
              <span class="letra-alternativa">${String.fromCharCode(65 + indice)}</span>
              <span>${escaparHTML(alternativa)}</span>
            </button>
          `).join("")}
        </div>

        <div class="simulado-retorno" hidden></div>

        <button
          class="button-primary simulado-avancar"
          data-acao="avancar"
          type="button"
          hidden
        >
          ${numero === total ? "Finalizar simulado" : "Próxima questão"}
        </button>
      </article>
    </section>
  `;

  container.querySelector('[data-acao="sair"]').addEventListener("click", () => {
    aoFinalizar({ tipo: "cancelado" });
  });

  container.querySelectorAll(".simulado-opcoes .alternativa").forEach(botao => {
    botao.addEventListener("click", () => {
      responder(container, botao, aoFinalizar);
    });
  });

  container.querySelector('[data-acao="avancar"]').addEventListener("click", () => {
    if (estado.indice === estado.questoes.length - 1) {
      renderizarResultado(container, aoFinalizar);
      return;
    }

    estado.indice += 1;
    renderizarQuestao(container, aoFinalizar);
  });
}

function responder(container, botao, aoFinalizar) {
  if (estado.respondida) return;

  const questao = estado.questoes[estado.indice];
  const escolhida = Number(botao.dataset.indice);
  const acertou = escolhida === questao.correta;

  estado.respondida = true;

  if (acertou) {
    estado.acertos += 1;
  }

  estado.respostas.push({
    questaoId: questao.id,
    disciplinaId: questao.disciplinaId,
    escolhida,
    correta: questao.correta,
    acertou
  });

  container.querySelectorAll(".simulado-opcoes .alternativa").forEach(opcao => {
    const indice = Number(opcao.dataset.indice);
    opcao.disabled = true;

    if (indice === questao.correta) {
      opcao.classList.add("correta");
    }

    if (indice === escolhida && !acertou) {
      opcao.classList.add("incorreta");
    }
  });

  const retorno = container.querySelector(".simulado-retorno");
  retorno.hidden = false;
  retorno.innerHTML = `
    <strong>${acertou ? "Resposta correta!" : "Resposta incorreta."}</strong>
    <p>${escaparHTML(questao.explicacao || "Revise este conteúdo.")}</p>
  `;

  container.querySelector('[data-acao="avancar"]').hidden = false;

  aoFinalizar({
    tipo: "resposta",
    questao,
    acertou,
    indice: estado.indice
  });
}

function renderizarResultado(container, aoFinalizar) {
  const total = estado.questoes.length;
  const percentual = Math.round((estado.acertos / total) * 100);

  let mensagem = "Continue revisando as matérias.";

  if (percentual >= 80) {
    mensagem = "Excelente desempenho!";
  } else if (percentual >= 60) {
    mensagem = "Bom resultado. Revise os pontos de erro.";
  }

  container.innerHTML = `
    <section class="card resultado-simulado">
      <p class="eyebrow">Simulado concluído</p>
      <h1>Seu resultado</h1>
      <div class="resultado-percentual">${percentual}%</div>
      <h2>${mensagem}</h2>
      <p>Você acertou <strong>${estado.acertos}</strong> de <strong>${total}</strong> questões.</p>

      <div class="resultado-acoes">
        <button class="button-primary" data-acao="refazer" type="button">
          Refazer simulado
        </button>
        <button class="button-secondary" data-acao="sair" type="button">
          Voltar ao painel
        </button>
      </div>
    </section>
  `;

  container.querySelector('[data-acao="refazer"]').addEventListener("click", () => {
    iniciarSimuladoProva({ container, aoFinalizar });
  });

  container.querySelector('[data-acao="sair"]').addEventListener("click", () => {
    aoFinalizar({ tipo: "encerrado" });
  });

  aoFinalizar({
    tipo: "resultado",
    acertos: estado.acertos,
    total,
    percentual,
    respostas: estado.respostas
  });
}

function renderizarErro(container, erro) {
  container.innerHTML = `
    <section class="card simulado-erro">
      <p class="eyebrow">Atenção</p>
      <h1>Não foi possível iniciar o simulado</h1>
      <p>${escaparHTML(erro.message)}</p>
      <p>Verifique se os caminhos do index.json correspondem aos arquivos existentes.</p>
    </section>
  `;
}

async function carregarJson(url) {
  const resposta = await fetch(url, { cache: "no-cache" });

  if (!resposta.ok) {
    throw new Error(`Não foi possível carregar ${url} — HTTP ${resposta.status}`);
  }

  try {
    return await resposta.json();
  } catch {
    throw new Error(`O arquivo ${url} não contém JSON válido.`);
  }
}

function embaralhar(lista) {
  const resultado = [...lista];

  for (let indice = resultado.length - 1; indice > 0; indice -= 1) {
    const sorteado = Math.floor(Math.random() * (indice + 1));
    [resultado[indice], resultado[sorteado]] = [resultado[sorteado], resultado[indice]];
  }

  return resultado;
}

function escaparHTML(valor) {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
