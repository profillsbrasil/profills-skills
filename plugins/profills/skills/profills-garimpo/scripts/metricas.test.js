#!/usr/bin/env node
// metricas.test.js — a conta de uma coleta por rede, rodada pelo terminal como a garimpo roda.
// Uso: node plugins/profills/skills/profills-garimpo/scripts/metricas.test.js   (Node >= 18, sem dependência)

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const METRICAS = path.join(__dirname, 'metricas.js');

function coleta(rede, conta, meta, posts) {
  const pasta = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'metricas-test-')), 'catalog', 'raw', rede, conta, '2026-11-27');
  fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(path.join(pasta, 'meta.json'), JSON.stringify({ coletado_em: '2026-11-27', janela_dias: 7, status: 'ok', concluida: true, ...meta }));
  fs.writeFileSync(path.join(pasta, 'posts.json'), JSON.stringify(posts));
  return pasta;
}

function rodar(pasta) {
  const r = spawnSync(process.execPath, [METRICAS, pasta], { encoding: 'utf8' });
  return { ...JSON.parse(r.stdout), exit: r.status };
}

const postIg = (codigo, data, engajamento) => ({ post_id: `ig:${codigo}`, url: `https://www.instagram.com/p/${codigo}/`, data, formato: 'reel', idioma: 'pt', hook_categoria: 'question', hook_cabe_no_corte: null, engajamento });

const casos = [];
const caso = (nome, fn) => casos.push({ nome, fn });

caso('coleta do Instagram: rede e conta saem do caminho, o slug da empresa do meta.json', () => {
  const r = rodar(coleta('instagram', 'cetromaquinas', { slug: 'cetro', seguidores: 149000, seguidores_arredondado: true }, [
    postIg('DgPtVBofaaa', '2026-11-27', { likes: 9, comentarios: 0, reposts: 0, compartilhamentos: 0 }),
  ]));
  assert.deepStrictEqual([r.slug, r.rede, r.conta, r.exit], ['cetro', 'instagram', 'cetromaquinas', 0]);
});

caso('compartilhamentos fica fora do total e da taxa, que usam likes + comentários + reposts', () => {
  const r = rodar(coleta('instagram', 'natgeo', { slug: 'natgeo', seguidores: 100000 }, [
    postIg('DgP2ERfAMpP', '2026-11-27', { likes: 4013, comentarios: 27, reposts: 78, compartilhamentos: 41 }),
    postIg('DgNRXYmBz0x', '2026-11-26', { likes: 47, comentarios: 2, reposts: 0, compartilhamentos: 7 }),
  ]));
  assert.strictEqual(r.engajamento_total, 4013 + 27 + 78 + 47 + 2);
  assert.strictEqual(r.taxa_normalizada, Math.round(((4013 + 27 + 78 + 47 + 2) / 2 / 100000) * 100 * 1000) / 1000);
  assert.strictEqual(r.destaque_semana.post_id, 'ig:DgP2ERfAMpP');
});

caso('compartilhamentos ilegível tira o post da conta, como os outros contadores', () => {
  const r = rodar(coleta('instagram', 'natgeo', { slug: 'natgeo', seguidores: 100000 }, [
    postIg('DgP2ERfAMpP', '2026-11-27', { likes: 10, comentarios: 1, reposts: 0, compartilhamentos: 'vários' }),
  ]));
  assert.strictEqual(r.n_posts_com_engajamento_legivel, 0);
  assert.ok(r.avisos.some((a) => a.startsWith('engajamento_nao_numerico: post ig:DgP2ERfAMpP tem "compartilhamentos"')), r.avisos.join('\n'));
});

caso('o Instagram não cobra hook_cabe_no_corte; o LinkedIn cobra', () => {
  const semCorte = (rede, conta) => rodar(coleta(rede, conta, { slug: conta, seguidores: 1000 }, [postIg('AAAAAAAAAAA', '2026-11-27', { likes: 1, comentarios: 0, reposts: 0 })]))
    .avisos.some((a) => a.includes('hook_cabe_no_corte'));
  assert.strictEqual(semCorte('instagram', 'empresa.ig'), false);
  assert.strictEqual(semCorte('linkedin', 'empresa'), true);
});

caso('pasta fora de catalog/raw/<rede>/ avisa que a rede não sai do caminho', () => {
  const pasta = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'metricas-test-')), 'solta', '2026-11-27');
  fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(path.join(pasta, 'posts.json'), JSON.stringify([postIg('AAAAAAAAAAA', '2026-11-27', { likes: 1, comentarios: 0, reposts: 0 })]));
  const r = rodar(pasta);
  assert.strictEqual(r.rede, null);
  assert.ok(r.avisos.some((a) => a.startsWith('a pasta não está em catalog/raw/<rede>/<conta>/<data>')));
});

let falhas = 0;
for (const { nome, fn } of casos) {
  try {
    fn();
    console.log(`ok: ${nome}`);
  } catch (e) {
    falhas += 1;
    console.log(`FALHA: ${nome}\n  ${e.message.split('\n').join('\n  ')}`);
  }
}
console.log(`${casos.length - falhas}/${casos.length} casos passaram`);
process.exit(falhas ? 1 : 0);
