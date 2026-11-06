# Gera as planilhas fictícias que o importar.test.js e o eval 8 da profills-radar leem.
# Uso: uv run --no-project --with openpyxl python -I skills/profills-radar/scripts/fixtures/gerar-planilhas.py
# Todas as empresas são inventadas. O openpyxl grava texto inline (t="inlineStr"), como o OpenXML SDK;
# a aba "Mapa competitivo" é reescrita com texto compartilhado (sharedStrings.xml), como o Excel grava.

import datetime
import pathlib
import re
import sys
import zipfile

from openpyxl import Workbook

AQUI = pathlib.Path(sys.argv[0]).resolve().parent
RADAR = AQUI.parent.parent

COLUNAS_MAPA = [
    "ID", "Empresa / unidade", "Origem", "Papel no mercado", "Relação com GT", "Prioridade proposta",
    "Oferta localizada", "Aplicações divulgadas", "O que acompanhar", "Grupo e nomes relacionados",
    "Situação Brasil / ressalva", "Fonte da oferta", "Conferido em",
]
COLUNAS_CANAIS = [
    "ID empresa", "Empresa / unidade", "Canal", "Região / escopo", "URL", "Status da identificação",
    "Fonte do endereço", "Conferido em", "Observação",
]

D20 = datetime.datetime(2026, 8, 20, 12, 0)
MAPA = [
    ["F001", "Alfa Cartonagem", "Brasil", "Sistema e caixas", "Concorrente direto", "Alta",
     "Caixas cartonadas e envasadoras próprias.", "Leite e sucos.", "Lançamentos de formato e cases.",
     "Alfa Cartonagem; a Beta Envase é a divisão de envase do grupo.", "Operação no Brasil.", "https://alfa.example/", D20],
    ["F002", "Beta Envase", "Itália", "Envasadoras", "Concorrente direto", "Média",
     "Envasadoras e serviço técnico.", "Bebidas vegetais.", "Máquinas em operação.",
     "Divisão de envase da Alfa Cartonagem. Consolidar grupo com F001.", "Presença Brasil a verificar.", "https://beta.example/", D20],
    ["F003", "Gama Embalagens", "Chile", "Caixas", "Adjacente", "Adjacente",
     "Caixas para secos.", "Grãos.", "Novos formatos.", "Gama Embalagens.", "", "https://gama.example/", D20],
    ["F004", "Delta Máquinas", "China", "Envasadoras", "A confirmar", "Validação",
     "Envasadora anunciada em marketplace.", "Lácteos.", "Confirmar catálogo.",
     "Delta. Perfil comercial individual identificado; página corporativa não confirmada.", "", "", D20],
    ["F005", "Épsilon Pack", "Espanha", "Caixas", "Concorrente direto", "Alta",
     "Caixas e tampas.", "Sucos.", "Expansão ibérica.", "Épsilon Pack. Não confundir com Epsilon Tubos.", "", "https://epsilon.example/", D20],
    ["F006", "Zeta Papéis", "Japão", "Caixas", "Concorrente direto", "Urgente",
     "Papel cartão.", "Bebidas.", "Barreiras.", "Zeta Papéis.", "", "https://zeta.example/", "2026-08-21"],
    ["F007", "Eta Cartons", "Índia", "Caixas", "Concorrente direto", "Média",
     "Caixas para água.", "Água.", "White label.", "Eta Cartons.", "", "https://eta.example/", D20],
    ["F008", "Teta Líquidos", "Peru", "Caixas", "Concorrente direto", "Média",
     "Caixas para óleo.", "Óleo.", "Distribuição regional.", "Teta Líquidos.", "", "https://teta.example/", D20],
]
CANAIS = [
    ["F001", "Alfa Cartonagem", "Site", "Global", "https://alfa.example/", "Fonte primária localizada", "", D20, ""],
    ["F001", "Alfa Cartonagem", "LinkedIn", "Global", "https://www.linkedin.com/company/alfa-cartonagem", "Perfil corporativo localizado", "", D20, ""],
    ["F002", "Beta Envase", "LinkedIn", "Global", "https://br.linkedin.com/company/beta-envase/", "Perfil corporativo localizado", "", D20, ""],
    ["F003", "Gama Embalagens", "LinkedIn", "Global", "", "Não localizado", "", D20, ""],
    ["F004", "Delta Máquinas", "LinkedIn", "Representante comercial", "https://cn.linkedin.com/in/representante-ficticio-000", "Perfil profissional localizado", "", D20, "Pessoa fictícia."],
    ["F005", "Épsilon Pack", "LinkedIn", "Global", "https://www.linkedin.com/company/epsilon-pack", "Perfil corporativo localizado", "", D20, ""],
    ["F005", "Épsilon Pack", "LinkedIn", "Ibéria", "https://www.linkedin.com/company/epsilon-pack-iberia?trk=x", "Perfil corporativo localizado", "", D20, "Segundo perfil, regional."],
    ["F006", "Zeta Papéis", "LinkedIn", "Global", "https://www.linkedin.com/company/zeta-papeis", "Perfil corporativo localizado", "", D20, ""],
    ["F007", "Eta Cartons", "LinkedIn", "Global", "https://www.linkedin.com/company/eta-cartons", "Perfil corporativo localizado", "", D20, ""],
]


def planilha(colunas_mapa):
    wb = Workbook()
    mapa = wb.active
    mapa.title = "Mapa competitivo"
    mapa.append(["Concorrentes fictícios: mapa competitivo"])
    mapa.append(["Referência", D20])
    mapa.append(["Entidades", len(MAPA)])
    mapa.append(["Escopo", "Empresas inventadas para teste."])
    indices = [COLUNAS_MAPA.index(c) for c in colunas_mapa]
    mapa.append(colunas_mapa)
    for linha in MAPA:
        mapa.append([linha[i] for i in indices])
    for celula in mapa["M"][5:]:
        celula.number_format = "yyyy-mm-dd hh:mm"
    canais = wb.create_sheet("Canais digitais")
    canais.append(["Canais digitais para acompanhamento"])
    canais.append(["Regra", "URL cadastrada não equivale a acesso completo."])
    canais.append(COLUNAS_CANAIS)
    for linha in CANAIS:
        canais.append(linha)
    return wb


def para_compartilhado(caminho, aba_xml):
    with zipfile.ZipFile(caminho) as z:
        arquivos = {n: z.read(n) for n in z.namelist()}
    textos = []

    def trocar(m):
        textos.append(m.group(3))
        return f'<c r="{m.group(1)}"{m.group(2)} t="s"><v>{len(textos) - 1}</v></c>'

    xml = re.sub(r'<c r="([A-Z]+\d+)"([^>]*?) t="inlineStr"><is><t[^>]*>(.*?)</t></is></c>', trocar, arquivos[aba_xml].decode())
    arquivos[aba_xml] = xml.encode()
    itens = "".join(f"<si><t>{t}</t></si>" for t in textos)
    arquivos["xl/sharedStrings.xml"] = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{len(textos)}" uniqueCount="{len(textos)}">{itens}</sst>'
    ).encode()
    rels = arquivos["xl/_rels/workbook.xml.rels"].decode()
    rels = rels.replace(
        "</Relationships>",
        '<Relationship Id="rIdCompartilhadas" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>',
    )
    arquivos["xl/_rels/workbook.xml.rels"] = rels.encode()
    tipos = arquivos["[Content_Types].xml"].decode()
    tipos = tipos.replace(
        "</Types>",
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>',
    )
    arquivos["[Content_Types].xml"] = tipos.encode()
    with zipfile.ZipFile(caminho, "w", zipfile.ZIP_DEFLATED) as z:
        for nome, dados in arquivos.items():
            z.writestr(nome, dados)


def gravar(wb, caminho):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    wb.save(caminho)
    para_compartilhado(caminho, "xl/worksheets/sheet1.xml")
    print(caminho)


gravar(planilha(COLUNAS_MAPA), RADAR / "evals" / "files" / "8" / "concorrentes-ficticios.xlsx")
gravar(planilha([c for c in COLUNAS_MAPA if c != "Prioridade proposta"]), AQUI / "sem-coluna-prioridade.xlsx")
