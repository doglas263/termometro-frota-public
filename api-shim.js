// Site estatico (somente visualizacao) — intercepta as chamadas que o app.js
// faz pra API e responde com os dados congelados em dados.js. Nenhuma acao
// aqui muda dado nenhum: importar/excluir sempre volta com erro amigavel.
(function () {
  "use strict";
  var DADOS = window.DADOS_ESTATICOS || { historico: [], execucoes: {}, evolucao: { periodos: [], cdds: [], serie: [] } };

  function respostaJson(obj) {
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve(obj); } });
  }

  window.fetch = function (url, opts) {
    opts = opts || {};
    if (opts.method === "DELETE") {
      return respostaJson({ ok: false, erro: "Este e um site somente para visualizacao — nao e possivel excluir periodos aqui." });
    }
    if (url === "/api/processar") {
      return respostaJson({ ok: false, erro: "Este e um site somente para visualizacao — nao e possivel importar novos periodos aqui." });
    }
    if (url === "/api/historico") {
      return respostaJson({ ok: true, execucoes: DADOS.historico });
    }
    if (url === "/api/historico/evolucao") {
      return respostaJson(DADOS.evolucao);
    }
    var m = url.match(/^\/api\/execucao\/(\d+)$/);
    if (m) {
      var exe = DADOS.execucoes[m[1]];
      return exe ? respostaJson(exe) : respostaJson({ ok: false, erro: "Periodo nao encontrado." });
    }
    return Promise.reject(new Error("Rota nao disponivel no site estatico: " + url));
  };
})();
