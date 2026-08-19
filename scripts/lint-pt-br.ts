#!/usr/bin/env bun

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRECTORIES = ["app", "components"];
const SCAN_EXTENSIONS = new Set([".tsx", ".jsx"]);
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "coverage",
  "test-results",
  "worktrees",
]);

// Palavras comuns escritas sem acentuação/cedilha em textos PT-BR exibidos na UI.
const PT_BR_CORRECTIONS: Record<string, string> = {
  email: "e-mail",
  calendario: "calendário",
  solicitacao: "solicitação",
  solicitacoes: "solicitações",
  necessario: "necessário",
  necessaria: "necessária",
  referencia: "referência",
  referencias: "referências",
  ultima: "última",
  ultimo: "último",
  duvida: "dúvida",
  duvidas: "dúvidas",
  ate: "até",
  nao: "não",
  voce: "você",
  voces: "vocês",
  sao: "são",
  ja: "já",
  tambem: "também",
  porem: "porém",
  alem: "além",
  ninguem: "ninguém",
  alguem: "alguém",
  configuracao: "configuração",
  configuracoes: "configurações",
  informacao: "informação",
  informacoes: "informações",
  usuario: "usuário",
  usuarios: "usuários",
  numero: "número",
  numeros: "números",
  codigo: "código",
  codigos: "códigos",
  historico: "histórico",
  obrigatorio: "obrigatório",
  obrigatoria: "obrigatória",
  disponivel: "disponível",
  disponiveis: "disponíveis",
  possivel: "possível",
  impossivel: "impossível",
  responsavel: "responsável",
  responsaveis: "responsáveis",
  permissao: "permissão",
  permissoes: "permissões",
  opcao: "opção",
  opcoes: "opções",
  acao: "ação",
  acoes: "ações",
  validacao: "validação",
  autenticacao: "autenticação",
  confirmacao: "confirmação",
  notificacao: "notificação",
  notificacoes: "notificações",
  servico: "serviço",
  servicos: "serviços",
  preco: "preço",
  precos: "preços",
  proximo: "próximo",
  proxima: "próxima",
  unico: "único",
  unica: "única",
  basico: "básico",
  basica: "básica",
  automatico: "automático",
  automatica: "automática",
  pagina: "página",
  paginas: "páginas",
  endereco: "endereço",
  enderecos: "endereços",
  telefone: "telefone",
  edicao: "edição",
  exclusao: "exclusão",
  criacao: "criação",
  atencao: "atenção",
  funcao: "função",
  funcoes: "funções",
  secao: "seção",
  secoes: "seções",
  conexao: "conexão",
  sessao: "sessão",
  regiao: "região",
  razao: "razão",
  facil: "fácil",
  dificil: "difícil",
  rapido: "rápido",
  rapida: "rápida",
  pratico: "prático",
  pratica: "prática",
  medico: "médico",
  publico: "público",
  gratis: "grátis",
  nivel: "nível",
  movel: "móvel",
  credito: "crédito",
  debito: "débito",
  beneficio: "benefício",
  beneficios: "benefícios",
  combinacao: "combinação",
  combinacoes: "combinações",
  modulo: "módulo",
  modulos: "módulos",
  cartao: "cartão",
  cartoes: "cartões",
  maximo: "máximo",
  maxima: "máxima",
  visao: "visão",
  metricas: "métricas",
  simulacoes: "simulações",
  confianca: "confiança",
  indice: "índice",
  comecar: "começar",
  atualizacao: "atualização",
  atualizacoes: "atualizações",
  relatorio: "relatório",
  relatorios: "relatórios",
  capitulo: "capítulo",
  capitulos: "capítulos",
  documentacao: "documentação",
  reuniao: "reunião",
  reunioes: "reuniões",
  periodo: "período",
  periodos: "períodos",
  experiencia: "experiência",
  experiencias: "experiências",
  operacao: "operação",
  operacoes: "operações",
  transferencia: "transferência",
  transferencias: "transferências",
};

// Termos que coincidem com o dicionário acima mas são válidos no contexto do projeto
// (nomes próprios, marcas, identificadores técnicos exibidos como texto literal).
const IGNORE_WORDS = new Set<string>([]);
const STRICT = process.env.LINT_PT_BR_STRICT === "1";

const WORD_REGEX = /\p{L}+/gu;
// Only treat content between an opening tag's ">" and a closing tag's "</" as
// JSX text — anchoring on "</" avoids matching code spans between sibling
// self-closing elements (e.g. `<Icon /> ... case "x": ... <Other />`).
const JSX_TEXT_REGEX = />([^<>{}]+?)<\//g;
const PHRASE_LITERAL_REGEX = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
const TEMPLATE_INTERPOLATION_REGEX = /\$\{[^{}]*\}/g;
const MAX_REGION_LENGTH = 200;
const CODE_LIKE_CHARS_REGEX = /[=()[\];`]/;

interface TextRegion {
  start: number;
  end: number;
}

interface Finding {
  filePath: string;
  line: number;
  column: number;
  word: string;
  suggestion: string;
  snippet: string;
}

async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function collectSourceFiles(startDirectory: string): Promise<string[]> {
  const results: string[] = [];
  if (!(await isDirectory(startDirectory))) {
    return results;
  }

  const stack: string[] = [startDirectory];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) {
          continue;
        }
        stack.push(absolute);
        continue;
      }
      if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name))) {
        results.push(absolute);
      }
    }
  }

  return results.sort((a, b) => a.localeCompare(b));
}

// A whole region that is a single SCREAMING_SNAKE_CASE identifier (e.g. an
// env var name shown inside `<code>`) is never real UI prose, even though it
// has no code-like punctuation to trip CODE_LIKE_CHARS_REGEX.
const CONSTANT_CASE_IDENTIFIER_REGEX = /^[A-Z0-9]+(?:_[A-Z0-9]+)+$/;

function isProseLike(group: string): boolean {
  const trimmed = group.trim();
  return (
    group.length <= MAX_REGION_LENGTH &&
    /\p{L}/u.test(group) &&
    !CODE_LIKE_CHARS_REGEX.test(group) &&
    !CONSTANT_CASE_IDENTIFIER_REGEX.test(trimmed)
  );
}

function findJsxTextRegions(content: string): TextRegion[] {
  const regions: TextRegion[] = [];
  for (const match of content.matchAll(JSX_TEXT_REGEX)) {
    const group = match[1];
    if (!group || !group.trim() || !isProseLike(group)) {
      continue;
    }
    const start = match.index + 1;
    regions.push({ start, end: start + group.length });
  }
  return regions;
}

// For template literals, exclude "${...}" interpolation spans (code, not display
// text) and keep only the static text segments around them.
function pushTemplateStaticRegions(
  regions: TextRegion[],
  group: string,
  groupStart: number,
): void {
  let cursor = 0;
  for (const interpolation of group.matchAll(TEMPLATE_INTERPOLATION_REGEX)) {
    if (interpolation.index > cursor) {
      const segment = group.slice(cursor, interpolation.index);
      if (/\p{L}/u.test(segment)) {
        regions.push({ start: groupStart + cursor, end: groupStart + interpolation.index });
      }
    }
    cursor = interpolation.index + interpolation[0].length;
  }
  if (cursor < group.length) {
    const segment = group.slice(cursor);
    if (/\p{L}/u.test(segment)) {
      regions.push({ start: groupStart + cursor, end: groupStart + group.length });
    }
  }
}

function findPhraseLiteralRegions(content: string): TextRegion[] {
  const regions: TextRegion[] = [];
  for (const match of content.matchAll(PHRASE_LITERAL_REGEX)) {
    const quote = match[1];
    const group = match[2];
    if (!group || !isProseLike(group)) {
      continue;
    }
    const start = match.index + quote.length;

    if (quote === "`") {
      pushTemplateStaticRegions(regions, group, start);
      continue;
    }

    if (!/\s/.test(group)) {
      continue;
    }
    regions.push({ start, end: start + group.length });
  }
  return regions;
}

function isWithinRegions(index: number, regions: TextRegion[]): boolean {
  return regions.some((region) => index >= region.start && index < region.end);
}

function buildLineStarts(content: string): number[] {
  const starts = [0];
  for (let i = 0; i < content.length; i += 1) {
    if (content[i] === "\n") {
      starts.push(i + 1);
    }
  }
  return starts;
}

function locate(
  index: number,
  lineStarts: number[],
): { line: number; column: number } {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (lineStarts[mid] <= index) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return { line: low + 1, column: index - lineStarts[low] + 1 };
}

function applyCase(original: string, suggestion: string): string {
  const firstChar = original.charAt(0);
  if (firstChar !== firstChar.toLowerCase() && firstChar === firstChar.toUpperCase()) {
    return suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
  }
  return suggestion;
}

function extractLineSnippet(content: string, lineStarts: number[], line: number): string {
  const start = lineStarts[line - 1] ?? 0;
  const end = lineStarts[line] !== undefined ? lineStarts[line] - 1 : content.length;
  return content.slice(start, end).trim();
}

async function scanFile(filePath: string): Promise<Finding[]> {
  const content = await fs.readFile(filePath, "utf8");
  const regions = [
    ...findJsxTextRegions(content),
    ...findPhraseLiteralRegions(content),
  ];
  if (regions.length === 0) {
    return [];
  }

  const lineStarts = buildLineStarts(content);
  const findings: Finding[] = [];
  const relativePath = path.relative(ROOT, filePath).split(path.sep).join("/");

  for (const match of content.matchAll(WORD_REGEX)) {
    const word = match[0];
    const index = match.index;
    if (!isWithinRegions(index, regions)) {
      continue;
    }

    // Skip path/identifier-like segments (e.g. "/email/templates/",
    // "sidebar-email-collapsed", "landing-email-orbs") and email-address
    // domains in examples (e.g. "convidado1@email.com") — Portuguese prose
    // never glues words to "/", "-" or "@" without surrounding whitespace.
    const charBefore = content.charAt(index - 1);
    const charAfter = content.charAt(index + word.length);
    if (["/", "-", "@"].includes(charBefore) || ["/", "-"].includes(charAfter)) {
      continue;
    }

    const lower = word.toLowerCase();
    if (IGNORE_WORDS.has(lower)) {
      continue;
    }

    const correction = PT_BR_CORRECTIONS[lower];
    if (!correction || correction.toLowerCase() === lower) {
      continue;
    }

    const { line, column } = locate(index, lineStarts);
    findings.push({
      filePath: relativePath,
      line,
      column,
      word,
      suggestion: applyCase(word, correction),
      snippet: extractLineSnippet(content, lineStarts, line),
    });
  }

  return findings;
}

async function run(): Promise<void> {
  const files: string[] = [];
  for (const directory of SCAN_DIRECTORIES) {
    files.push(...(await collectSourceFiles(path.join(ROOT, directory))));
  }

  const allFindings: Finding[] = [];
  for (const filePath of files) {
    allFindings.push(...(await scanFile(filePath)));
  }

  if (allFindings.length === 0) {
    console.info(`[lint:pt-br] OK — ${files.length} arquivo(s) verificado(s), nenhum erro de acentuação encontrado`);
    return;
  }

  console.warn(`[lint:pt-br] WARN — ${allFindings.length} possível(is) erro(s) de acentuação PT-BR encontrado(s)`);
  for (const finding of allFindings) {
    console.warn(
      `  - ${finding.filePath}:${finding.line}:${finding.column}  "${finding.word}" → "${finding.suggestion}"  |  ${finding.snippet}`,
    );
  }
  console.warn(
    "\nSe alguma destas palavras for um nome próprio/termo técnico válido neste contexto, adicione-a a IGNORE_WORDS em scripts/lint-pt-br.ts.",
  );
  if (STRICT) {
    process.exit(1);
  }
}

run().catch((error: unknown) => {
  console.error("[lint:pt-br] Fatal error:", error);
  process.exit(1);
});
