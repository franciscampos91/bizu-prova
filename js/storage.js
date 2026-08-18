const STORAGE_KEY = "bizuProvaProgresso";

const estadoInicial = {
  nome: "",
  respondidas: {},
  marcadas: [],
  ultimoAcesso: null
};

export function carregarProgresso() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);

    if (!salvo) {
      return structuredClone(estadoInicial);
    }

    return {
      ...structuredClone(estadoInicial),
      ...JSON.parse(salvo)
    };
  } catch {
    return structuredClone(estadoInicial);
  }
}

export function salvarProgresso(progresso) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...progresso,
      ultimoAcesso: new Date().toISOString()
    })
  );
}

export function registrarResposta(progresso, questaoId, acertou) {
  const atual = progresso.respondidas[questaoId] || {
    acertos: 0,
    erros: 0
  };

  if (acertou) {
    atual.acertos += 1;
  } else {
    atual.erros += 1;
  }

  atual.ultimaResposta = new Date().toISOString();
  progresso.respondidas[questaoId] = atual;

  salvarProgresso(progresso);
}