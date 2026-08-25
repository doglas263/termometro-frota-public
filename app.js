(function () {
  "use strict";

  const MESES = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  let arquivosSelecionados = [];
  let execucaoAtualId = null;
  let execucoesCache = [];

  // ---------------------------------------------------------------- utils

  function fmtPt(v, casas) {
    if (v === null || v === undefined) return "—";
    return Number(v).toFixed(casas === undefined ? 1 : casas).replace(".", ",");
  }

  function el(tag, cls, texto) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function toast(msg, tipo) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = "toast " + (tipo || "");
    requestAnimationFrame(() => t.classList.remove("oculto"));
    clearTimeout(toast._h);
    toast._h = setTimeout(() => t.classList.add("oculto"), 5000);
  }

  function corFaixa(pontos) {
    if (pontos === null || pontos === undefined) return "gray";
    if (pontos >= 90) return "green";
    if (pontos >= 70) return "amber";
    return "red";
  }

  function rankBadge(rank) {
    const b = el("span", "rank-badge", String(rank));
    if (rank === 1) b.classList.add("ouro");
    else if (rank === 2) b.classList.add("prata");
    else if (rank === 3) b.classList.add("bronze");
    return b;
  }

  function nomeBonito(cdd) {
    return cdd.toLowerCase().replace(/(^|\s)([a-zà-ú])/g, (m, sp, c) => sp + c.toUpperCase())
      .replace(/\bCdd\b/g, "CDD").replace(/\bCds\b/g, "CDS")
      .replace(/\bCdl\b/g, "CDL").replace(/\bCdr\b/g, "CDR");
  }

  function rotuloPeriodo(ano, mes, quinzena) {
    const tipo = Number(quinzena) === 2 ? "Oficial" : "Parcial";
    return `${MESES[Number(mes) - 1]}/${ano} - ${quinzena}a quinzena (${tipo})`;
  }

  // ---------------------------------------------------------------- dropdown de filtro (padrao unico)
  // Um so componente pra todos os filtros do app: single-select (clica e
  // troca) ou multiplo (checkbox por item + "Todos"), sempre com a mesma
  // aparencia de botao + painel.

  const _fecharDropdowns = [];

  function criarDropdown(elementoOuId, { multiplo = false, comTodos = true } = {}) {
    const container = typeof elementoOuId === "string" ? document.getElementById(elementoOuId) : elementoOuId;
    container.innerHTML = "";
    const wrap = el("div", "fdrop");
    const btn = el("button", "fdrop-btn");
    btn.type = "button";
    const painel = el("div", "fdrop-painel oculto");
    wrap.append(btn, painel);
    container.appendChild(wrap);

    let opcoes = [];
    let selecionados = new Set();

    function textoBotao() {
      if (!opcoes.length) return "—";
      if (!multiplo) {
        const op = opcoes.find((o) => selecionados.has(String(o.valor)));
        return op ? op.texto : "Selecione";
      }
      if (selecionados.size === opcoes.length) return `Todos (${opcoes.length})`;
      if (selecionados.size === 0) return "Nenhum selecionado";
      if (selecionados.size === 1) {
        const op = opcoes.find((o) => selecionados.has(String(o.valor)));
        return op ? op.texto : "1 selecionado";
      }
      return `${selecionados.size} selecionados`;
    }

    function emitirMudanca() {
      btn.textContent = textoBotao();
      if (typeof instancia.aoMudar === "function") instancia.aoMudar(Array.from(selecionados));
    }

    let chkTodos = null;
    const chkPorValor = new Map();

    function atualizarTodos() {
      if (!chkTodos) return;
      chkTodos.checked = opcoes.length > 0 && selecionados.size === opcoes.length;
      chkTodos.indeterminate = selecionados.size > 0 && selecionados.size < opcoes.length;
    }

    // Reconstroi o painel do zero — chamado so quando a LISTA de opcoes muda
    // (popular()), nunca a cada clique, pra nao perder o item que o usuario
    // acabou de marcar nem re-renderizar o painel embaixo do mouse.
    function renderPainel() {
      painel.innerHTML = "";
      chkPorValor.clear();
      chkTodos = null;
      if (multiplo && comTodos) {
        const itemTodos = el("label", "fdrop-item");
        chkTodos = document.createElement("input");
        chkTodos.type = "checkbox";
        itemTodos.append(chkTodos, el("span", null, "Todos"));
        chkTodos.addEventListener("change", () => {
          selecionados = chkTodos.checked ? new Set(opcoes.map((o) => String(o.valor))) : new Set();
          chkPorValor.forEach((chk) => { chk.checked = chkTodos.checked; });
          emitirMudanca();
        });
        painel.append(itemTodos, el("div", "fdrop-sep"));
        atualizarTodos();
      }
      opcoes.forEach((o) => {
        const valor = String(o.valor);
        if (multiplo) {
          const item = el("label", "fdrop-item");
          const chk = document.createElement("input");
          chk.type = "checkbox";
          chk.checked = selecionados.has(valor);
          item.append(chk, el("span", null, o.texto));
          chk.addEventListener("change", () => {
            if (chk.checked) selecionados.add(valor); else selecionados.delete(valor);
            atualizarTodos();
            emitirMudanca();
          });
          chkPorValor.set(valor, chk);
          painel.appendChild(item);
        } else {
          const item = el("div", "fdrop-item" + (selecionados.has(valor) ? " selecionado" : ""), o.texto);
          item.addEventListener("click", () => {
            selecionados = new Set([valor]);
            fechar();
            painel.querySelectorAll(".fdrop-item.selecionado").forEach((n) => n.classList.remove("selecionado"));
            item.classList.add("selecionado");
            emitirMudanca();
          });
          painel.appendChild(item);
        }
      });
    }

    function abrir() {
      _fecharDropdowns.forEach((f) => f !== fechar && f());
      painel.classList.remove("oculto");
      wrap.classList.add("aberto");
    }
    function fechar() {
      painel.classList.add("oculto");
      wrap.classList.remove("aberto");
    }
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      painel.classList.contains("oculto") ? abrir() : fechar();
    });
    document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) fechar(); });
    _fecharDropdowns.push(fechar);

    const instancia = {
      aoMudar: null,
      popular(novasOpcoes, valoresIniciais) {
        opcoes = novasOpcoes.map((o) => ({ valor: String(o.valor), texto: o.texto }));
        const validos = new Set(opcoes.map((o) => o.valor));
        const iniciais = valoresIniciais !== undefined
          ? valoresIniciais.map(String).filter((v) => validos.has(v))
          : opcoes.map((o) => o.valor);
        selecionados = new Set(multiplo ? iniciais : iniciais.slice(0, 1).length ? [iniciais[0]] : [opcoes[0] && opcoes[0].valor].filter(Boolean));
        btn.textContent = textoBotao();
        renderPainel();
      },
      get() { return Array.from(selecionados); },
      set(valores) {
        selecionados = new Set((multiplo ? valores : valores.slice(0, 1)).map(String));
        btn.textContent = textoBotao();
        renderPainel();
      },
    };
    return instancia;
  }

  // ---------------------------------------------------------------- abas

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => ativarAba(btn.dataset.tab));
  });

  function ativarAba(nome) {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === nome));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + nome));
    if (nome === "historico") carregarEvolucaoPanorama();
    if (nome === "novo") carregarImportados();
    if (nome === "kpis") carregarEvolucaoKpis();
  }

  // ---------------------------------------------------------------- form periodo

  const selMes = document.getElementById("in-mes");
  MESES.forEach((nome, i) => {
    const op = el("option", null, nome);
    op.value = i + 1;
    selMes.appendChild(op);
  });
  const hoje = new Date();
  document.getElementById("in-ano").value = hoje.getFullYear();
  selMes.value = hoje.getMonth() + 1;

  // ---------------------------------------------------------------- dropzone

  const dropzone = document.getElementById("dropzone");
  const inputArquivos = document.getElementById("input-arquivos");
  const dzArquivos = document.getElementById("dz-arquivos");
  const btnProcessar = document.getElementById("btn-processar");

  ["dragenter", "dragover"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("drag"); })
  );
  ["dragleave", "drop"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("drag"); })
  );
  dropzone.addEventListener("drop", (e) => {
    definirArquivos(e.dataTransfer.files);
  });
  inputArquivos.addEventListener("change", (e) => definirArquivos(e.target.files));

  function definirArquivos(fileList) {
    const EXTENSOES = [".xlsb", ".xlsx", ".xlsm", ".xls"];
    const arr = Array.from(fileList).filter((f) => EXTENSOES.some((ext) => f.name.toLowerCase().endsWith(ext)));
    arquivosSelecionados = arr.slice(0, 2);
    dzArquivos.innerHTML = "";
    arquivosSelecionados.forEach((f) => {
      const linha = el("div", "dz-arquivo");
      linha.appendChild(el("span", "tipo", "📄"));
      linha.appendChild(el("span", "nome", `${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`));
      dzArquivos.appendChild(linha);
    });
    atualizarBotaoProcessar();
  }

  function atualizarBotaoProcessar() {
    btnProcessar.disabled = arquivosSelecionados.length !== 2;
  }

  document.getElementById("dropzone").addEventListener("click", (e) => {
    if (e.target.tagName !== "INPUT") inputArquivos.click();
  });

  // ---------------------------------------------------------------- publicar para web

  const btnPublicar = document.getElementById("pub-btn");
  if (btnPublicar) {
    btnPublicar.addEventListener("click", async () => {
      const status = document.getElementById("pub-status");
      btnPublicar.disabled = true;
      status.className = "";
      status.textContent = "Publicando…";
      try {
        const resp = await fetch("/api/publicar", { method: "POST" });
        const dados = await resp.json();
        if (dados.ok) {
          status.className = "ok";
          status.textContent = (dados.mensagem || "Publicado com sucesso.") + " O site atualiza em ~1 minuto.";
        } else {
          status.className = "err";
          status.textContent = dados.erro || "Erro desconhecido.";
        }
      } catch (err) {
        status.className = "err";
        status.textContent = "Erro: " + err;
      } finally {
        btnPublicar.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------- confirmacao + processar

  const modal = document.getElementById("modal-confirmar");
  const modalTexto = document.getElementById("modal-texto");
  const modalAviso = document.getElementById("modal-aviso-sobrescrever");

  btnProcessar.addEventListener("click", async () => {
    if (arquivosSelecionados.length !== 2) return;
    await buscarExecucoes();
    abrirModalConfirmacao();
  });

  function abrirModalConfirmacao() {
    const ano = document.getElementById("in-ano").value;
    const mes = selMes.value;
    const quinzena = document.querySelector('input[name=quinzena]:checked').value;
    const rotulo = rotuloPeriodo(ano, mes, quinzena);
    const nomes = arquivosSelecionados.map((f) => f.name).join(" — ");

    modalTexto.innerHTML = `Deseja realmente importar os arquivos:<br><b>${nomes}</b><br><br>para o periodo <b>${rotulo}</b>?`;

    const existente = execucoesCache.find(
      (e) => Number(e.ano) === Number(ano) && Number(e.mes) === Number(mes) && Number(e.quinzena) === Number(quinzena)
    );
    if (existente) {
      modalAviso.textContent = `Atencao: esse periodo ja foi importado em ${new Date(existente.processado_em).toLocaleString("pt-BR")}. Ao continuar, os dados antigos serao substituidos.`;
      modalAviso.classList.remove("oculto");
    } else {
      modalAviso.classList.add("oculto");
    }

    modal.classList.remove("oculto");
  }

  function fecharModal() {
    modal.classList.add("oculto");
  }
  document.getElementById("modal-fechar").addEventListener("click", fecharModal);
  document.getElementById("modal-cancelar-btn").addEventListener("click", fecharModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) fecharModal(); });
  document.getElementById("modal-confirmar-btn").addEventListener("click", () => {
    fecharModal();
    processarAgora();
  });

  async function processarAgora() {
    const ano = document.getElementById("in-ano").value;
    const mes = selMes.value;
    const quinzena = document.querySelector('input[name=quinzena]:checked').value;
    const status = document.getElementById("status-processamento");

    btnProcessar.disabled = true;
    status.innerHTML = '<span class="spinner"></span>Lendo os arquivos e cruzando os dados... isso pode levar alguns segundos.';

    const fd = new FormData();
    arquivosSelecionados.forEach((f) => fd.append("arquivos", f));
    fd.append("ano", ano);
    fd.append("mes", mes);
    fd.append("quinzena", quinzena);

    try {
      const resp = await fetch("/api/processar", { method: "POST", body: fd });
      const dados = await resp.json();
      if (!dados.ok) {
        status.textContent = "";
        toast(dados.erro || "Falha ao processar.", "err");
        return;
      }
      status.textContent = "";
      toast("Processado com sucesso! " + dados.linhas.length + " CDDs da LOG20 encontrados.", "ok");
      await buscarExecucoes();
      evolucaoCache = null;
      renderRanking(dados.execucao_id, dados.rotulo_periodo, dados.linhas);
      renderKpis(dados.execucao_id, dados.rotulo_periodo, dados.linhas, dados.kpis);
      ativarAba("ranking");
      arquivosSelecionados = [];
      dzArquivos.innerHTML = "";
      inputArquivos.value = "";
      carregarImportados();
    } catch (err) {
      status.textContent = "";
      toast("Erro de comunicacao com o servidor: " + err, "err");
    } finally {
      atualizarBotaoProcessar();
    }
  }

  // ---------------------------------------------------------------- ranking

  function renderRanking(execucaoId, rotulo, linhas) {
    execucaoAtualId = execucaoId;
    document.getElementById("ranking-vazio").style.display = "none";
    document.getElementById("ranking-conteudo").style.display = "block";
    document.getElementById("ranking-titulo").textContent = "Ranking LOG20";
    document.getElementById("ranking-subtitulo").textContent = rotulo + " · " + linhas.length + " CDDs da LOG20";

    document.getElementById("link-excel").href = `/api/execucao/${execucaoId}/excel`;
    document.getElementById("link-imagem").href = `/api/execucao/${execucaoId}/imagem`;
    document.getElementById("img-whatsapp").src = `/api/execucao/${execucaoId}/imagem?t=${Date.now()}`;

    atualizarFiltroPeriodo(execucaoId);

    const media = linhas.reduce((s, l) => s + l.panorama_medio, 0) / (linhas.length || 1);
    const melhor = linhas.slice().sort((a, b) => b.panorama_medio - a.panorama_medio)[0];
    const cards = document.getElementById("ranking-cards");
    cards.innerHTML = "";
    const c1 = el("div", "card accent"); c1.appendChild(el("div", "v", linhas.length)); c1.appendChild(el("div", "l", "CDDs LOG20")); cards.appendChild(c1);
    const c2 = el("div", "card accent"); c2.appendChild(el("div", "v", fmtPt(media))); c2.appendChild(el("div", "l", "Media geral (panorama)")); cards.appendChild(c2);
    if (melhor) {
      const c3 = el("div", "card accent"); c3.appendChild(el("div", "v", nomeBonito(melhor.cdd))); c3.appendChild(el("div", "l", "Melhor colocado")); cards.appendChild(c3);
    }

    // Painel (panorama)
    const painel = linhas.slice().sort((a, b) => a.rank_interno_panorama - b.rank_interno_panorama);
    preencherTabela("tabela-painel", painel, (l, tr) => {
      tdRank(tr, l.rank_interno_panorama);
      tdTexto(tr, nomeBonito(l.cdd));
      tdTexto(tr, l.geo || "—");
      tdBadge(tr, l.tier, "purple");
      tdNum(tr, fmtPt(l.pontos_armazem));
      tdNum(tr, fmtPt(l.pontos_rota));
      tdBadgeNum(tr, fmtPt(l.panorama_medio), corFaixa(l.panorama_medio));
    });

    // Interno: armazem / rota / media
    const intArm = linhas.filter((l) => l.pontos_armazem !== null).sort((a, b) => a.rank_interno_armazem - b.rank_interno_armazem);
    preencherTabela("tabela-interno-armazem", intArm, (l, tr) => {
      tdRank(tr, l.rank_interno_armazem); tdTexto(tr, nomeBonito(l.cdd)); tdNum(tr, fmtPt(l.pontos_armazem));
    });
    const intRota = linhas.filter((l) => l.pontos_rota !== null).sort((a, b) => a.rank_interno_rota - b.rank_interno_rota);
    preencherTabela("tabela-interno-rota", intRota, (l, tr) => {
      tdRank(tr, l.rank_interno_rota); tdTexto(tr, nomeBonito(l.cdd)); tdNum(tr, fmtPt(l.pontos_rota));
    });
    preencherTabela("tabela-interno-media", painel, (l, tr) => {
      tdRank(tr, l.rank_interno_panorama); tdTexto(tr, nomeBonito(l.cdd)); tdNum(tr, fmtPt(l.panorama_medio));
    });

    // Nacional por tier
    ["T1", "T2"].forEach((tier) => {
      const linhasTier = linhas.filter((l) => l.tier === tier).sort((a, b) => a.rank_nacional_panorama - b.rank_nacional_panorama);
      preencherTabela("tabela-nacional-" + tier.toLowerCase(), linhasTier, (l, tr) => {
        tdTexto(tr, nomeBonito(l.cdd));
        tdNum(tr, fmtPt(l.pontos_armazem), "grupo-armazem divisor"); tdNum(tr, l.rank_nacional_armazem ?? "—", "grupo-armazem");
        tdNum(tr, fmtPt(l.pontos_rota), "grupo-rota divisor"); tdNum(tr, l.rank_nacional_rota ?? "—", "grupo-rota");
        tdNum(tr, fmtPt(l.panorama_medio), "grupo-panorama divisor"); tdNum(tr, l.rank_nacional_panorama ?? "—", "grupo-panorama");
      });
    });
  }

  function preencherTabela(idTabela, linhas, montarLinha) {
    const tbody = document.querySelector("#" + idTabela + " tbody");
    tbody.innerHTML = "";
    linhas.forEach((l) => {
      const tr = document.createElement("tr");
      montarLinha(l, tr);
      tbody.appendChild(tr);
    });
  }
  function tdTexto(tr, texto) { tr.appendChild(el("td", null, texto)); }
  function tdNum(tr, texto, extraClasse) { tr.appendChild(el("td", extraClasse ? "num " + extraClasse : "num", String(texto))); }
  function tdRank(tr, rank) { const td = el("td", "center"); td.appendChild(rankBadge(rank)); tr.appendChild(td); }
  function tdBadge(tr, texto, cor) { const td = el("td", "center"); const b = el("span", "badge " + cor, texto); td.appendChild(b); tr.appendChild(td); }
  function tdBadgeNum(tr, texto, cor) { const td = el("td", "num"); const b = el("span", "badge " + cor, texto); td.appendChild(b); tr.appendChild(td); }

  // ---------------------------------------------------------------- analise de KPIs

  function _hex2(n) { const h = Math.max(0, Math.min(255, Math.round(n))).toString(16); return h.length === 1 ? "0" + h : h; }
  function _interpolarCor(c1, c2, t) {
    const parse = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
    const [r1, g1, b1] = parse(c1);
    const [r2, g2, b2] = parse(c2);
    return "#" + _hex2(r1 + (r2 - r1) * t) + _hex2(g1 + (g2 - g1) * t) + _hex2(b1 + (b2 - b1) * t);
  }
  // Gradiente continuo vermelho -> amarelo -> verde, para que valores
  // intermediarios (ex.: 50%) caiam de fato em amarelo, nao em vermelho.
  function corPercentual(pct) {
    if (pct === null || pct === undefined) return "#5b6b7c";
    const p = Math.max(0, Math.min(100, pct));
    const vermelho = "#ef5b6a", amarelo = "#f4a92e", verde = "#38c172";
    return p <= 50 ? _interpolarCor(vermelho, amarelo, p / 50) : _interpolarCor(amarelo, verde, (p - 50) / 50);
  }

  function renderRankingKpis(idAlvo, kpisFonte) {
    const alvo = document.getElementById(idAlvo);
    alvo.innerHTML = "";
    const ordenado = Object.entries(kpisFonte || {}).sort((a, b) => (a[1].media_percentual || 0) - (b[1].media_percentual || 0));
    if (!ordenado.length) {
      alvo.appendChild(el("p", "hint", "Sem dados de KPI para este periodo."));
      return;
    }
    ordenado.forEach(([nome, dado]) => {
      const linha = el("div", "kpi-linha");
      linha.appendChild(el("div", "nome", nome));
      const fundo = el("div", "barra-fundo");
      const barra = el("div", "barra-preenchida");
      const pct = dado.media_percentual || 0;
      barra.style.width = Math.max(2, pct) + "%";
      barra.style.background = corPercentual(pct);
      fundo.appendChild(barra);
      linha.appendChild(fundo);
      linha.appendChild(el("div", "pct", fmtPt(pct, 0) + "%"));
      alvo.appendChild(linha);
    });
  }

  function renderHeatmap(idTabela, linhas, kpisFonte, campoKpis) {
    const nomesKpis = Object.keys(kpisFonte || {});
    const tabela = document.getElementById(idTabela);
    tabela.className = "heatmap";
    const theadTr = tabela.querySelector("thead tr");
    theadTr.innerHTML = "";
    theadTr.appendChild(el("th", null, "CDD"));
    nomesKpis.forEach((nome) => theadTr.appendChild(el("th", null, nome)));
    theadTr.appendChild(el("th", "col-total", "Total"));

    const tbody = tabela.querySelector("tbody");
    tbody.innerHTML = "";
    const comDados = linhas.filter((l) => l[campoKpis]);
    if (!comDados.length) {
      const tr = document.createElement("tr");
      const td = el("td", "hint", "Sem dados para este periodo.");
      td.colSpan = nomesKpis.length + 2;
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    // Calcula o total de cada linha primeiro, pra poder ordenar a tabela
    // pelo seu proprio total (maior pro menor) — nao pelo rank do panorama.
    const linhasComTotal = comDados.map((l) => {
      let totalPontos = 0;
      let totalMaximo = 0;
      nomesKpis.forEach((nome) => {
        const dadoKpi = l[campoKpis][nome];
        if (dadoKpi) {
          totalPontos += dadoKpi.pontos;
          totalMaximo += (kpisFonte[nome] && kpisFonte[nome].maximo_pontos) || dadoKpi.pontos;
        }
      });
      return { l, totalPontos, totalMaximo };
    });
    linhasComTotal.sort((a, b) => b.totalPontos - a.totalPontos);

    linhasComTotal.forEach(({ l, totalPontos, totalMaximo }) => {
      const tr = document.createElement("tr");
      tdTexto(tr, nomeBonito(l.cdd));
      nomesKpis.forEach((nome) => {
        const dadoKpi = l[campoKpis][nome];
        const td = el("td", "heat");
        if (dadoKpi) {
          const maximo = (kpisFonte[nome] && kpisFonte[nome].maximo_pontos) || dadoKpi.pontos;
          const pct = maximo ? (100 * dadoKpi.pontos) / maximo : 0;
          td.style.background = corPercentual(pct) + "40"; // preenchimento suave (25% opacidade)
          td.style.color = corPercentual(pct);
          td.textContent = fmtPt(dadoKpi.pontos, 0);
        } else {
          td.textContent = "—";
        }
        tr.appendChild(td);
      });
      // Totalizador da linha: soma os pontos de todos os KPIs daquele CDD
      // (reconstroi o Total Pontos original do G-Info).
      const tdTotal = el("td", "heat total");
      const pctTotal = totalMaximo ? (100 * totalPontos) / totalMaximo : 0;
      tdTotal.style.background = corPercentual(pctTotal) + "70";
      tdTotal.style.color = corPercentual(pctTotal);
      tdTotal.textContent = fmtPt(totalPontos, 0);
      tr.appendChild(tdTotal);
      tbody.appendChild(tr);
    });
  }

  function renderKpis(execucaoId, rotulo, linhas, kpisResumo) {
    document.getElementById("kpis-vazio").style.display = "none";
    document.getElementById("kpis-conteudo").style.display = "block";
    document.getElementById("kpis-subtitulo").textContent = rotulo + " · " + linhas.length + " CDDs da LOG20";

    renderRankingKpis("ranking-kpis-armazem", kpisResumo.armazem);
    renderRankingKpis("ranking-kpis-rota", kpisResumo.rota);
    renderHeatmap("tabela-detalhe-armazem", linhas, kpisResumo.armazem, "kpis_armazem");
    renderHeatmap("tabela-detalhe-rota", linhas, kpisResumo.rota, "kpis_rota");
  }

  // ---------------------------------------------------------------- grafico interativo de evolucao (SVG)
  // Usado tanto pelo panorama medio (aba Historico) quanto pelos KPIs (aba
  // Analise de KPIs). So considera periodos OFICIAIS (2a quinzena) — a 1a
  // quinzena e uma previa antes do fechamento do mes e fica de fora.

  const PALETA_SERIES = [
    "#3da9fc", "#38c172", "#f4a92e", "#9d7bff", "#ef5b6a", "#2dd4bf",
    "#f472b6", "#a3e635", "#fb923c", "#60a5fa", "#c084fc", "#4ade80",
    "#facc15", "#f87171", "#22d3ee",
  ];
  function corParaIndice(i) { return PALETA_SERIES[i % PALETA_SERIES.length]; }

  function rotuloCurtoPeriodo(p) {
    return `${MESES[p.mes - 1].slice(0, 3)}/${String(p.ano).slice(-2)} Q${p.quinzena}`;
  }

  const tooltipGrafico = (() => {
    const div = document.createElement("div");
    div.className = "grafico-tooltip";
    document.body.appendChild(div);
    return div;
  })();
  function mostrarTooltip(x, y, html) {
    tooltipGrafico.innerHTML = html;
    tooltipGrafico.style.display = "block";
    tooltipGrafico.style.left = x + 16 + "px";
    tooltipGrafico.style.top = y + 16 + "px";
  }
  function esconderTooltip() { tooltipGrafico.style.display = "none"; }

  function svgEl(tag, attrs) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // periodos: [{id, ano, mes, quinzena}]
  // series: [{nome, cor, destaque, valores: {periodoId: valor|null}}]
  function renderizarGrafico(containerId, legendaId, periodos, series, opts) {
    opts = opts || {};
    const maxY = opts.maxY || 110;
    const sufixo = opts.sufixo || "";
    const container = document.getElementById(containerId);
    const legenda = document.getElementById(legendaId);
    container.innerHTML = "";
    legenda.innerHTML = "";

    const comDados = series.filter((s) => periodos.some((p) => s.valores[p.id] !== null && s.valores[p.id] !== undefined));
    if (!periodos.length || !comDados.length) {
      container.appendChild(el("p", "hint", "Sem dados para os filtros selecionados."));
      return;
    }

    const W = 920, H = 340;
    const M = { top: 20, right: 24, bottom: 46, left: 44 };
    const larguraUtil = W - M.left - M.right;
    const alturaUtil = H - M.top - M.bottom;
    const x = (i) => M.left + (periodos.length === 1 ? larguraUtil / 2 : (i * larguraUtil) / (periodos.length - 1));
    const y = (v) => M.top + alturaUtil - (Math.max(0, Math.min(maxY, v)) / maxY) * alturaUtil;

    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid meet" });

    const passos = 5;
    for (let i = 0; i <= passos; i++) {
      const valor = (maxY / passos) * i;
      const yy = y(valor);
      svg.appendChild(svgEl("line", { x1: M.left, x2: W - M.right, y1: yy, y2: yy, class: "grade" }));
      const t = svgEl("text", { x: M.left - 8, y: yy + 4, "text-anchor": "end" });
      t.textContent = Math.round(valor) + sufixo;
      svg.appendChild(t);
    }
    svg.appendChild(svgEl("line", { x1: M.left, x2: M.left, y1: M.top, y2: H - M.bottom, class: "eixo" }));
    svg.appendChild(svgEl("line", { x1: M.left, x2: W - M.right, y1: H - M.bottom, y2: H - M.bottom, class: "eixo" }));

    periodos.forEach((p, i) => {
      const t = svgEl("text", { x: x(i), y: H - M.bottom + 18, "text-anchor": "middle" });
      t.textContent = rotuloCurtoPeriodo(p);
      svg.appendChild(t);
    });

    const grupos = [];
    comDados.forEach((serie, si) => {
      const cor = serie.cor || corParaIndice(si);
      const pontosValidos = periodos
        .map((p, i) => ({ i, p, v: serie.valores[p.id] }))
        .filter((pt) => pt.v !== null && pt.v !== undefined);
      if (!pontosValidos.length) return;

      const g = svgEl("g", {});
      const d = pontosValidos.map((pt, idx) => `${idx === 0 ? "M" : "L"} ${x(pt.i)} ${y(pt.v)}`).join(" ");
      g.appendChild(svgEl("path", { d, class: "linha-serie" + (serie.destaque ? " linha-media" : ""), stroke: cor }));

      pontosValidos.forEach((pt) => {
        const c = svgEl("circle", { cx: x(pt.i), cy: y(pt.v), r: 3.6, fill: cor, class: "ponto" });
        c.addEventListener("mousemove", (e) => {
          mostrarTooltip(e.clientX, e.clientY, `<b>${serie.nome}</b><br>${rotuloCurtoPeriodo(pt.p)}: <b>${fmtPt(pt.v)}${sufixo}</b>`);
        });
        c.addEventListener("mouseleave", esconderTooltip);
        g.appendChild(c);
      });

      svg.appendChild(g);
      grupos.push({ nome: serie.nome, cor, g });
    });

    container.appendChild(svg);

    grupos.forEach((grp) => {
      const item = el("span", "item");
      const dot = el("span", "dot");
      dot.style.background = grp.cor;
      item.appendChild(dot);
      item.appendChild(el("span", null, grp.nome));
      item.addEventListener("click", () => {
        item.classList.toggle("apagado");
        grp.g.style.display = item.classList.contains("apagado") ? "none" : "";
      });
      legenda.appendChild(item);
    });
  }

  const _dropdownInstancias = {};
  function obterDropdown(id, opts) {
    if (!_dropdownInstancias[id]) _dropdownInstancias[id] = criarDropdown(id, opts);
    return _dropdownInstancias[id];
  }

  function popularFiltro(id, multiplo, opcoes, valorFn, textoFn, aoMudar, valoresIniciais) {
    const dd = obterDropdown(id, { multiplo });
    dd.aoMudar = aoMudar;
    dd.popular(opcoes.map((o) => ({ valor: valorFn(o), texto: textoFn(o) })), valoresIniciais);
    return dd;
  }

  function selecionados(id) {
    return obterDropdown(id, { multiplo: true }).get();
  }

  // ---------------------------------------------------------------- dados de evolucao (compartilhado)

  let evolucaoCache = null;

  async function buscarEvolucao(forcar) {
    if (evolucaoCache && !forcar) return evolucaoCache;
    try {
      const resp = await fetch("/api/historico/evolucao");
      evolucaoCache = await resp.json();
      return evolucaoCache;
    } catch (err) {
      toast("Erro ao carregar evolucao: " + err, "err");
      return { periodos: [], cdds: [], serie: [] };
    }
  }

  function linhaEvolucao(dados, periodoId, cdd) {
    return dados.serie.find((r) => r.periodo_id === periodoId && r.cdd === cdd) || null;
  }

  // ---------------------------------------------------------------- evolucao do panorama (aba Historico)

  async function carregarEvolucaoPanorama() {
    const dados = await buscarEvolucao();
    const vazio = document.getElementById("evolucao-panorama-vazio");
    const bloco = document.getElementById("evolucao-panorama-bloco");
    if (dados.periodos.length < 2) {
      vazio.style.display = "block";
      bloco.style.display = "none";
      return;
    }
    vazio.style.display = "none";
    bloco.style.display = "block";

    popularFiltro("panorama-sel-periodos", true, dados.periodos, (p) => p.id, rotuloCurtoPeriodo, atualizarGraficoPanorama);
    popularFiltro("panorama-sel-unidades", true, dados.cdds, (c) => c, nomeBonito, atualizarGraficoPanorama);
    atualizarGraficoPanorama();
  }

  function atualizarGraficoPanorama() {
    const dados = evolucaoCache;
    const periodosSel = selecionados("panorama-sel-periodos").map(Number);
    const unidadesSel = selecionados("panorama-sel-unidades");
    const periodosFiltrados = dados.periodos.filter((p) => periodosSel.includes(p.id));

    const series = unidadesSel.map((cdd, i) => {
      const valores = {};
      periodosFiltrados.forEach((p) => {
        const linha = linhaEvolucao(dados, p.id, cdd);
        valores[p.id] = linha ? linha.panorama_medio : null;
      });
      return { nome: nomeBonito(cdd), cor: corParaIndice(i), valores };
    });

    const valoresMedia = {};
    periodosFiltrados.forEach((p) => {
      const vals = unidadesSel
        .map((cdd) => linhaEvolucao(dados, p.id, cdd))
        .filter(Boolean)
        .map((l) => l.panorama_medio);
      valoresMedia[p.id] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    series.push({ nome: "Media (selecao)", cor: "#ffffff", destaque: true, valores: valoresMedia });

    renderizarGrafico("panorama-grafico", "panorama-legenda", periodosFiltrados, series, { maxY: 110, sufixo: " pts" });
  }

  // ---------------------------------------------------------------- evolucao dos KPIs (aba Analise de KPIs)

  async function carregarEvolucaoKpis() {
    const dados = await buscarEvolucao();
    const vazio = document.getElementById("evolucao-kpis-vazio");
    const blocos = document.getElementById("evolucao-kpis-blocos");
    if (dados.periodos.length < 2) {
      vazio.style.display = "block";
      blocos.style.display = "none";
      return;
    }
    vazio.style.display = "none";
    blocos.style.display = "block";

    ["armazem", "rota"].forEach((fonte) => {
      const campoKpis = fonte === "armazem" ? "kpis_armazem" : "kpis_rota";
      const nomesKpis = [];
      dados.serie.forEach((r) => {
        const k = r[campoKpis];
        if (k) Object.keys(k).forEach((n) => { if (!nomesKpis.includes(n)) nomesKpis.push(n); });
      });

      popularFiltro(`kpi-sel-metrica-${fonte}`, false, nomesKpis, (n) => n, (n) => n, () => atualizarGraficoKpi(fonte));
      popularFiltro(`kpi-sel-periodos-${fonte}`, true, dados.periodos, (p) => p.id, rotuloCurtoPeriodo, () => atualizarGraficoKpi(fonte));
      popularFiltro(`kpi-sel-unidades-${fonte}`, true, dados.cdds, (c) => c, nomeBonito, () => atualizarGraficoKpi(fonte));
      atualizarGraficoKpi(fonte);
    });
  }

  function atualizarGraficoKpi(fonte) {
    const dados = evolucaoCache;
    const campoKpis = fonte === "armazem" ? "kpis_armazem" : "kpis_rota";
    const kpiSelecionado = obterDropdown(`kpi-sel-metrica-${fonte}`, { multiplo: false }).get()[0];
    const periodosSel = selecionados(`kpi-sel-periodos-${fonte}`).map(Number);
    const unidadesSel = selecionados(`kpi-sel-unidades-${fonte}`);
    const periodosFiltrados = dados.periodos.filter((p) => periodosSel.includes(p.id));

    const series = unidadesSel.map((cdd, i) => {
      const valores = {};
      periodosFiltrados.forEach((p) => {
        const linha = linhaEvolucao(dados, p.id, cdd);
        const kpiDado = linha && linha[campoKpis] && linha[campoKpis][kpiSelecionado];
        valores[p.id] = kpiDado ? kpiDado.pontos : null;
      });
      return { nome: nomeBonito(cdd), cor: corParaIndice(i), valores };
    });

    renderizarGrafico(`kpi-grafico-${fonte}`, `kpi-legenda-${fonte}`, periodosFiltrados, series, { maxY: 20, sufixo: " pts" });
  }

  // ---------------------------------------------------------------- filtro de periodo (aba ranking / kpis)

  function atualizarFiltroPeriodo(idSelecionado) {
    const aoEscolher = (valores) => { if (valores[0]) carregarExecucao(Number(valores[0])); };
    const lista = execucoesCache.slice().reverse();
    popularFiltro("sel-periodo-ranking", false, lista, (e) => e.id, (e) => e.rotulo, aoEscolher, [idSelecionado]);
    popularFiltro("sel-periodo-kpis", false, lista, (e) => e.id, (e) => e.rotulo, aoEscolher, [idSelecionado]);
  }

  // ---------------------------------------------------------------- execucoes (compartilhado)

  async function buscarExecucoes() {
    try {
      const resp = await fetch("/api/historico");
      const dados = await resp.json();
      execucoesCache = dados.execucoes || [];
      return execucoesCache;
    } catch (err) {
      toast("Nao foi possivel carregar os periodos: " + err, "err");
      return execucoesCache;
    }
  }

  function montarLinhaPeriodo(e) {
    const tr = document.createElement("tr");
    tdTexto(tr, e.rotulo);
    tdNum(tr, e.total_log20);
    tdTexto(tr, new Date(e.processado_em).toLocaleString("pt-BR"));
    const tdAcoes = el("td");
    const btnVer = el("button", "btn small", "Ver");
    btnVer.addEventListener("click", () => verExecucao(e.id));
    const btnExcel = el("a", "btn small", "Excel");
    btnExcel.href = `/api/execucao/${e.id}/excel`;
    const btnExcluir = el("button", "btn small danger", "Excluir");
    btnExcluir.addEventListener("click", () => excluirExecucao(e.id));
    tdAcoes.append(btnVer, " ", btnExcel, " ", btnExcluir);
    tr.appendChild(tdAcoes);
    return tr;
  }

  // ---------------------------------------------------------------- aba novo: periodos ja importados

  async function carregarImportados() {
    const lista = await buscarExecucoes();
    const tbody = document.querySelector("#tabela-importados tbody");
    tbody.innerHTML = "";
    lista.slice().reverse().forEach((e) => tbody.appendChild(montarLinhaPeriodo(e)));
    document.getElementById("importados-vazio").style.display = lista.length ? "none" : "block";
    document.getElementById("importados-wrap").style.display = lista.length ? "block" : "none";
  }

  async function carregarExecucao(id) {
    try {
      const resp = await fetch(`/api/execucao/${id}`);
      const dados = await resp.json();
      if (!dados.ok) { toast(dados.erro || "Execucao nao encontrada.", "err"); return null; }
      if (!execucoesCache.length) await buscarExecucoes();
      renderRanking(id, dados.rotulo_periodo, dados.linhas);
      renderKpis(id, dados.rotulo_periodo, dados.linhas, dados.kpis);
      return dados;
    } catch (err) {
      toast("Erro ao carregar execucao: " + err, "err");
      return null;
    }
  }

  async function verExecucao(id) {
    const dados = await carregarExecucao(id);
    if (dados) ativarAba("ranking");
  }

  async function excluirExecucao(id) {
    const alvo = execucoesCache.find((e) => Number(e.id) === Number(id));
    const rotulo = alvo ? alvo.rotulo : "este periodo";
    if (!confirm(`Excluir "${rotulo}" do historico? Essa acao nao pode ser desfeita.`)) return;
    try {
      await fetch(`/api/execucao/${id}`, { method: "DELETE" });
      toast("Periodo excluido.", "ok");
      await buscarExecucoes();
      evolucaoCache = null;
      carregarImportados();
      if (document.getElementById("panel-historico").classList.contains("active")) carregarEvolucaoPanorama();
      if (document.getElementById("panel-kpis").classList.contains("active")) carregarEvolucaoKpis();
      if (Number(id) === Number(execucaoAtualId)) {
        execucaoAtualId = null;
        document.getElementById("ranking-conteudo").style.display = "none";
        document.getElementById("ranking-vazio").style.display = "block";
        document.getElementById("kpis-conteudo").style.display = "none";
        document.getElementById("kpis-vazio").style.display = "block";
      } else {
        atualizarFiltroPeriodo(execucaoAtualId);
      }
    } catch (err) {
      toast("Erro ao excluir: " + err, "err");
    }
  }

  // ---------------------------------------------------------------- inicializacao
  // Ao abrir o programa, as abas Ranking / Analise de KPIs / Historico ja
  // vem preenchidas com o periodo mais recente, sem precisar clicar em nada.

  (async function inicializar() {
    const lista = await buscarExecucoes();
    carregarImportados();
    if (lista.length) {
      await carregarExecucao(lista[0].id); // lista vem do mais recente pro mais antigo
    }
    carregarEvolucaoPanorama();
    carregarEvolucaoKpis();
  })();
})();
