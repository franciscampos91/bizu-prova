import { carregarProgresso, salvarProgresso } from "./storage.js";
import { iniciarSimuladoProva } from "./simulado-prova.js";

const app = document.querySelector("#app");
const progresso = carregarProgresso();

iniciar();

async function iniciar() {
  try {
    if (!progresso.nome) {
      renderizarLogin();
      return;
    }

    await renderizarPainel();
  } catch (erro) {
    renderizarErro(erro);
  }
}

function renderizarLogin() {
  app.innerHTML = `
    <section class="tela-login">
      <p class="eyebrow">Curso de Gestão em TIC</p>
      <h1>Bizu da Prova</h1>
      <p>Seu espaço rápido de revisão, quizzes e simulados.</p>

      <form id="login-form">
        <label for="nome">Como deseja ser identificado?</label>
        <input id="nome" name="nome" type="text" maxlength="60" placeholder="Digite seu nome" required>
        <button type="submit">Entrar nos estudos</button>
      </form>

      <button id="sem-nome" class="button-secondary" type="button">
        Continuar sem identificação
      </button>
    </section>
  `;

  document.querySelector("#login-form").addEventListener("submit", event => {
    event.preventDefault();
    const nome = new FormData(event.currentTarget).get("nome").trim();
    progresso.nome = nome || "Aluno";
    salvarProgresso(progresso);
    renderizarPainel();
  });

  document.querySelector("#sem-nome").addEventListener("click", () => {
    progresso.nome = "Aluno";
    salvarProgresso(progresso);
    renderizarPainel();
  });
}

async function renderizarPainel() {
  const catalogo = await carregarCatalogo();
  const conteudosAtivos = catalogo.conteudos.filter(item => item.ativo !== false);
  const respondidas = Object.keys(progresso.respondidas || {}).length;

  app.innerHTML = `
    <header class="app-header">
      <div>
        <p class="eyebrow">Bizu da Prova</p>
        <h1>Olá, ${escaparHTML(progresso.nome)}.</h1>
      </div>
      <button id="trocar-nome" class="button-secondary" type="button">
        Trocar identificação
      </button>
    </header>

    <section class="resumo">
      <article class="card destaque">
        <span>Questões respondidas</span>
        <strong>${respondidas}</strong>
      </article>
      <article class="card">
        <span>Conteúdos disponíveis</span>
        <strong>${conteudosAtivos.length}</strong>
      </article>
    </section>

    <section class="card simulado-acesso">
      <p class="eyebrow">Avaliação geral</p>
      <h2>Simulado de prova</h2>
      <p>20 questões misturadas de todas as matérias disponíveis.</p>
      <button id="abrir-simulado" class="button-primary" type="button">
        Iniciar simulado
      </button>
    </section>

    <section>
      <div class="section-heading">
        <p class="eyebrow">Conteúdos</p>
        <h2>Escolha uma disciplina</h2>
      </div>

      <div class="lista-conteudos">
        ${conteudosAtivos.map(item => `
          <button class="conteudo-item" data-arquivo="${escaparHTML(item.arquivo)}" type="button">
            <span>
              <small>Semana ${item.semana}</small>
              <strong>${escaparHTML(item.nome)}</strong>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        `).join("")}
      </div>
    </section>
  `;

  document.querySelector("#trocar-nome").addEventListener("click", () => {
    progresso.nome = "";
    salvarProgresso(progresso);
    renderizarLogin();
  });

  document.querySelector("#abrir-simulado").addEventListener("click", () => {
    iniciarSimuladoProva({
      container: app,
      quantidade: 20,
      aoFinalizar: registrarEventoSimulado
    });
  });

  document.querySelectorAll(".conteudo-item").forEach(botao => {
    botao.addEventListener("click", () => iniciarQuiz(botao.dataset.arquivo));
  });
}

function registrarEventoSimulado(evento) {
  if (evento.tipo !== "resposta" || !evento.questao) return;

  const registro = progresso.respondidas[evento.questao.id] || {
    acertos: 0,
    erros: 0
  };

  if (evento.acertou) {
    registro.acertos += 1;
  } else {
    registro.erros += 1;
  }

  registro.ultimaResposta = new Date().toISOString();
  progresso.respondidas[evento.questao.id] = registro;
  salvarProgresso(progresso);
}

async function carregarCatalogo() {
  const resposta = await fetch("./data/index.json", { cache: "no-cache" });

  if (!resposta.ok) {
    throw new Error(`Falha ao carregar o catálogo — HTTP ${resposta.status}`);
  }

  return resposta.json();
}

async function iniciarQuiz(arquivo) {
  try {
    const resposta = await fetch(`./data/${arquivo}`, { cache: "no-cache" });

    if (!resposta.ok) {
      throw new Error(`Falha ao carregar as questões — HTTP ${resposta.status}`);
    }

    const conteudo = await resposta.json();

    app.innerHTML = `
      <button id="voltar" class="button-secondary" type="button">← Voltar</button>
      <p class="eyebrow">Semana ${conteudo.semana}</p>
      <h1>${escaparHTML(conteudo.nome)}</h1>
      <p>${escaparHTML(conteudo.descricao || "")}</p>
      <div id="quiz">
        ${conteudo.questoes.map((questao, indice) => `
          <article class="questao card">
            <p class="questao-numero">Questão ${indice + 1}</p>
            <h2>${escaparHTML(questao.enunciado)}</h2>
            <div class="alternativas">
              ${questao.alternativas.map((alternativa, alternativaIndex) => `
                <button class="alternativa" data-questao="${escaparHTML(questao.id)}" data-correta="${questao.correta}" data-indice="${alternativaIndex}" type="button">
                  ${escaparHTML(alternativa)}
                </button>
              `).join("")}
            </div>
            <div class="explicacao" hidden></div>
          </article>
        `).join("")}
      </div>
    `;

    document.querySelector("#voltar").addEventListener("click", renderizarPainel);

    document.querySelectorAll(".alternativa").forEach(botao => {
      botao.addEventListener("click", () => responder(botao, conteudo.questoes));
    });
  } catch (erro) {
    renderizarErro(erro);
  }
}

function responder(botao, questoes) {
  const questao = questoes.find(item => item.id === botao.dataset.questao);
  if (!questao) return;

  const alternativas = document.querySelectorAll(`[data-questao="${questao.id}"]`);

  alternativas.forEach(item => {
    item.disabled = true;
    if (Number(item.dataset.indice) === questao.correta) {
      item.classList.add("correta");
    }
  });

  const acertou = Number(botao.dataset.indice) === Number(questao.correta);
  if (!acertou) botao.classList.add("incorreta");

  const explicacao = botao.closest(".questao").querySelector(".explicacao");
  explicacao.hidden = false;
  explicacao.innerHTML = `
    <strong>${acertou ? "Acertou!" : "Revise esta questão."}</strong>
    <p>${escaparHTML(questao.explicacao || "")}</p>
  `;

  const registro = progresso.respondidas[questao.id] || {
    acertos: 0,
    erros: 0
  };

  acertou ? registro.acertos++ : registro.erros++;
  registro.ultimaResposta = new Date().toISOString();
  progresso.respondidas[questao.id] = registro;
  salvarProgresso(progresso);
}

function renderizarErro(erro) {
  app.innerHTML = `
    <section class="card simulado-erro">
      <p class="eyebrow">Erro ao carregar</p>
      <h1>Não foi possível abrir o aplicativo</h1>
      <p>${escaparHTML(erro.message)}</p>
      <button class="button-secondary" type="button" onclick="location.reload()">
        Tentar novamente
      </button>
    </section>
  `;
}

function escaparHTML(valor) {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}